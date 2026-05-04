import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";

type PodiumReward = { position: number; credits_bonus: number; prestige_bonus: number };
type MaterialReward = { material_id: number; qty: number };

function rollPosition(driverSpeed: number, driverSkill: number, carSpeed: number, carHandling: number, engineerBonus: number): number {
  // Composite performance score with slight randomness
  const score = (carSpeed * 0.4 + carHandling * 0.2 + driverSpeed * 0.2 + driverSkill * 0.15 + engineerBonus * 0.05);
  const roll = Math.random() * 100;
  // Higher score = better chance at top positions
  if (score >= 80) {
    if (roll < 50) return 1;
    if (roll < 80) return 2;
    if (roll < 95) return 3;
    return 4;
  } else if (score >= 60) {
    if (roll < 25) return 1;
    if (roll < 60) return 2;
    if (roll < 85) return 3;
    return 4;
  } else if (score >= 40) {
    if (roll < 10) return 1;
    if (roll < 35) return 2;
    if (roll < 65) return 3;
    return 4;
  } else {
    if (roll < 5) return 1;
    if (roll < 15) return 2;
    if (roll < 40) return 3;
    return 4;
  }
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

  // Fetch race with circuit/driver/car/engineer data
  const race = db.prepare(`
    SELECT r.id, r.user_id, r.circuit_id, r.driver_id, r.engineer_id, r.car_id,
           r.status, r.completes_at,
           c.reward_credits, c.reward_materials, c.reward_prestige, c.podium_rewards,
           d.speed as driver_speed, d.skill as driver_skill,
           car.stat_speed as car_speed, car.stat_handling as car_handling,
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
    reward_credits: number; reward_materials: string; reward_prestige: number; podium_rewards: string;
    driver_speed: number; driver_skill: number; car_speed: number; car_handling: number; engineer_bonus: number;
  } | undefined;

  if (!race) return NextResponse.json({ error: "Race not found" }, { status: 404 });
  if (race.status === "completed") return NextResponse.json({ error: "Race already claimed" }, { status: 400 });
  if (now < race.completes_at) {
    return NextResponse.json({ error: "Race not yet complete", remaining: race.completes_at - now }, { status: 400 });
  }

  // Calculate result
  const position = rollPosition(race.driver_speed, race.driver_skill, race.car_speed, race.car_handling, race.engineer_bonus);
  const baseCredits = race.reward_credits;
  const basePrestige = race.reward_prestige;

  const podiumRewards: PodiumReward[] = (() => {
    try { return JSON.parse(race.podium_rewards) as PodiumReward[]; } catch { return []; }
  })();
  const materialRewards: MaterialReward[] = (() => {
    try { return JSON.parse(race.reward_materials) as MaterialReward[]; } catch { return []; }
  })();

  const podium = podiumRewards.find((p) => p.position === position);
  const creditsEarned = baseCredits + (podium?.credits_bonus ?? 0);
  const prestigeEarned = basePrestige + (podium?.prestige_bonus ?? 0);

  // Give rewards
  db.prepare(`UPDATE users SET credits = credits + ?, prestige = prestige + ? WHERE id = ?`)
    .run(creditsEarned, prestigeEarned, session.id);

  // Give materials
  const earnedMaterials: Array<{ name: string; qty: number }> = [];
  if (position <= 3) {
    for (const mat of materialRewards) {
      db.prepare(
        `INSERT INTO inventory_materials (user_id, material_id, quantity)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id, material_id) DO UPDATE SET quantity = quantity + ?`
      ).run(session.id, mat.material_id, mat.qty, mat.qty);

      const matName = (db.prepare(`SELECT name FROM materials WHERE id = ?`).get(mat.material_id) as { name: string } | undefined)?.name ?? "Material";
      earnedMaterials.push({ name: matName, qty: mat.qty });
    }
  }

  // Update car stats: increment total_races, total_wins if position 1
  db.prepare(`UPDATE cars SET total_races = total_races + 1${position === 1 ? ", total_wins = total_wins + 1" : ""} WHERE id = ?`)
    .run(race.car_id);

  // Update driver stats
  db.prepare(`UPDATE drivers SET races = races + 1${position === 1 ? ", wins = wins + 1" : ""} WHERE id = ?`)
    .run(race.driver_id);

  // Unlock all: set driver/car/engineer back to idle
  db.prepare(`UPDATE drivers SET status = 'idle' WHERE id = ?`).run(race.driver_id);
  db.prepare(`UPDATE cars SET status = 'garage' WHERE id = ?`).run(race.car_id);
  if (race.engineer_id) {
    db.prepare(`UPDATE engineers SET status = 'idle' WHERE id = ?`).run(race.engineer_id);
  }

  const resultData = { position, credits_earned: creditsEarned, prestige_earned: prestigeEarned, materials: earnedMaterials };

  // Mark race completed
  db.prepare(`UPDATE races SET status = 'completed', result = ?, completed_at = ? WHERE id = ?`)
    .run(JSON.stringify(resultData), now, race.id);

  db.prepare(
    `INSERT INTO activity_log (user_id, type, message, credits_delta, prestige_delta, data) VALUES (?, 'race_complete', ?, ?, ?, ?)`
  ).run(session.id, `Finished P${position} at circuit ${race.circuit_id}`, creditsEarned, prestigeEarned, JSON.stringify(resultData));

  return NextResponse.json({ success: true, ...resultData });
}
