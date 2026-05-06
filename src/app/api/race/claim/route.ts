import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";

type PodiumReward = {
  position: number;
  credits_bonus: number;
  xgear_bonus: number;
  mat_count: number;
  prestige_bonus: number;
};

type NpcCar = {
  id: number;
  name: string;
  stat_speed: number;
  stat_acceleration: number;
  stat_handling: number;
  stat_stability: number;
  stat_durability: number;
  stat_weight: number;
  stat_braking: number;
  stat_control: number;
  stat_shift_speed: number;
  stat_efficiency: number;
  stat_grip: number;
  stat_cornering: number;
};

function npcPerformance(npc: NpcCar): number {
  return npc.stat_speed + npc.stat_acceleration + npc.stat_handling + npc.stat_stability
       + npc.stat_durability + npc.stat_weight + npc.stat_braking + npc.stat_control
       + npc.stat_shift_speed + npc.stat_efficiency + npc.stat_grip + npc.stat_cornering;
}

function applyRng(score: number, jitterPct: number): number {
  const jitter = (Math.random() * 2 - 1) * jitterPct;
  return score * (1 + jitter / 100);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { race_id } = body as { race_id: number };

  if (!race_id) return NextResponse.json({ error: "Missing race_id" }, { status: 400 });

  const db = await initDb();
  await seedDatabase(db);

  const now = Math.floor(Date.now() / 1000);

  const race = db.prepare(`
    SELECT r.id, r.user_id, r.circuit_id, r.driver_id, r.engineer_id, r.car_id,
           r.status, r.completes_at, r.npc_field,
           c.podium_rewards, c.field_size,
           d.speed as driver_speed, d.skill as driver_skill,
           car.stat_speed + car.stat_acceleration + car.stat_handling + car.stat_stability
             + car.stat_durability + car.stat_weight + car.stat_braking + car.stat_control
             + car.stat_shift_speed + car.stat_efficiency + car.stat_grip + car.stat_cornering
             as car_performance,
           COALESCE(e.race_bonus, 0) as engineer_bonus
    FROM races r
    JOIN circuits c ON c.id = r.circuit_id
    JOIN drivers d ON d.id = r.driver_id
    JOIN cars car ON car.id = r.car_id
    LEFT JOIN engineers e ON e.id = r.engineer_id
    WHERE r.id = ? AND r.user_id = ?
  `).get(race_id, session.id) as {
    id: number; user_id: number; circuit_id: number; driver_id: number;
    engineer_id: number | null; car_id: number; status: string; completes_at: number;
    npc_field: string; podium_rewards: string; field_size: number;
    driver_speed: number; driver_skill: number;
    car_performance: number;
    engineer_bonus: number;
  } | undefined;

  if (!race) return NextResponse.json({ error: "Race not found" }, { status: 404 });
  if (race.status === "completed") return NextResponse.json({ error: "Race already claimed" }, { status: 400 });
  if (now < race.completes_at) {
    return NextResponse.json({ error: "Race not yet complete", remaining: race.completes_at - now }, { status: 400 });
  }

  // Parse NPC field snapshot
  const npcField: NpcCar[] = (() => {
    try { return JSON.parse(race.npc_field) as NpcCar[]; } catch { return []; }
  })();

  // Player score: car performance + driver/engineer bonuses, then ±12% RNG
  const driverBoost = (race.driver_speed + race.driver_skill) * 0.12;
  const engBoost = race.engineer_bonus * 0.05;
  const playerRawScore = race.car_performance + driverBoost + engBoost;
  const playerScore = applyRng(playerRawScore, 12);

  // Each NPC gets ±15% jitter applied to their summed performance
  const npcScores = npcField.map((npc) => ({
    name: npc.name,
    score: applyRng(npcPerformance(npc), 15),
  }));

  // Position = how many NPCs beat the player + 1
  const npcsAhead = npcScores.filter((n) => n.score > playerScore).length;
  const position = Math.min(npcsAhead + 1, race.field_size);

  // Parse podium rewards
  const podiumRewards: PodiumReward[] = (() => {
    try { return JSON.parse(race.podium_rewards) as PodiumReward[]; } catch { return []; }
  })();

  const podium = podiumRewards.find((p) => p.position === position);

  const creditsEarned = podium?.credits_bonus ?? 0;
  const xgearEarned = podium?.xgear_bonus ?? 0;
  const prestigeEarned = podium?.prestige_bonus ?? 0;
  const matCount = podium?.mat_count ?? 0;

  // Give credits, xgear, prestige
  db.prepare(`UPDATE users SET credits = credits + ?, xgear = xgear + ?, prestige = prestige + ? WHERE id = ?`)
    .run(creditsEarned, xgearEarned, prestigeEarned, session.id);

  // Give random materials if podium
  const earnedMaterials: Array<{ name: string; qty: number }> = [];
  if (matCount > 0) {
    const allMaterials = db.prepare(`SELECT id, name FROM materials`).all() as { id: number; name: string }[];
    if (allMaterials.length > 0) {
      // Distribute matCount across random materials (1-3 qty per material type)
      let remaining = matCount;
      const matMap: Record<number, { name: string; qty: number }> = {};
      while (remaining > 0) {
        const mat = allMaterials[Math.floor(Math.random() * allMaterials.length)];
        const qty = Math.min(remaining, Math.ceil(Math.random() * 3));
        if (!matMap[mat.id]) matMap[mat.id] = { name: mat.name, qty: 0 };
        matMap[mat.id].qty += qty;
        remaining -= qty;
      }
      for (const [matId, { name, qty }] of Object.entries(matMap)) {
        db.prepare(
          `INSERT INTO inventory_materials (user_id, material_id, quantity)
           VALUES (?, ?, ?)
           ON CONFLICT(user_id, material_id) DO UPDATE SET quantity = quantity + ?`
        ).run(session.id, Number(matId), qty, qty);
        earnedMaterials.push({ name, qty });
      }
    }
  }

  // Update car and driver stats
  db.prepare(`UPDATE cars SET total_races = total_races + 1${position === 1 ? ", total_wins = total_wins + 1" : ""} WHERE id = ?`)
    .run(race.car_id);
  db.prepare(`UPDATE drivers SET races = races + 1${position === 1 ? ", wins = wins + 1" : ""} WHERE id = ?`)
    .run(race.driver_id);

  // Unlock resources
  db.prepare(`UPDATE drivers SET status = 'idle' WHERE id = ?`).run(race.driver_id);
  db.prepare(`UPDATE cars SET status = 'garage' WHERE id = ?`).run(race.car_id);
  if (race.engineer_id) {
    db.prepare(`UPDATE engineers SET status = 'idle' WHERE id = ?`).run(race.engineer_id);
  }

  const resultData = {
    position,
    field_size: race.field_size,
    credits_earned: creditsEarned,
    xgear_earned: xgearEarned,
    prestige_earned: prestigeEarned,
    materials: earnedMaterials,
  };

  db.prepare(`UPDATE races SET status = 'completed', result = ?, completed_at = ? WHERE id = ?`)
    .run(JSON.stringify(resultData), now, race.id);

  db.prepare(
    `INSERT INTO activity_log (user_id, type, message, credits_delta, prestige_delta, data) VALUES (?, 'race_complete', ?, ?, ?, ?)`
  ).run(
    session.id,
    `Finished P${position}/${race.field_size} at circuit ${race.circuit_id}`,
    creditsEarned,
    prestigeEarned,
    JSON.stringify(resultData)
  );

  return NextResponse.json({ success: true, ...resultData });
}
