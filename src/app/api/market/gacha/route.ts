import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";

const ROLL_COST_XGEAR = 100;

// Rarity pools with weights
const DRIVER_POOL_WEIGHTS = { common: 60, rare: 30, epic: 9, legendary: 1 };
const ENGINEER_POOL_WEIGHTS = { common: 60, rare: 30, epic: 9, legendary: 1 };

// Pity system: after 20 non-epic+ rolls, next is guaranteed epic or better
const PITY_THRESHOLD = 20;

type Rarity = "common" | "rare" | "epic" | "legendary";

function weightedRoll(weights: Record<Rarity, number>, pityCount: number): Rarity {
  // Soft pity: linear increase in epic chance after 15 rolls
  let epicBoost = 0;
  if (pityCount >= 15) epicBoost = (pityCount - 14) * 5;

  const w = { ...weights };
  w.epic = Math.min(w.epic + epicBoost, 60);
  w.common = Math.max(w.common - epicBoost, 5);

  // Hard pity at threshold
  if (pityCount >= PITY_THRESHOLD) return "epic";

  const total = Object.values(w).reduce((s, v) => s + v, 0);
  let r = Math.random() * total;
  for (const [rarity, weight] of Object.entries(w) as [Rarity, number][]) {
    r -= weight;
    if (r <= 0) return rarity;
  }
  return "common";
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { banner } = body as { banner: "driver" | "engineer" };

  if (banner !== "driver" && banner !== "engineer") {
    return NextResponse.json({ error: "Invalid banner" }, { status: 400 });
  }

  const db = await initDb();
  await seedDatabase(db);

  const user = db.prepare(`SELECT credits, xgear FROM users WHERE id = ?`).get(session.id) as { credits: number; xgear: number } | undefined;
  if (!user || user.xgear < ROLL_COST_XGEAR) {
    return NextResponse.json({ error: "Insufficient XGEAR", required: ROLL_COST_XGEAR, have: user?.xgear ?? 0 }, { status: 400 });
  }

  // Get pity count
  const pityRow = db.prepare(
    `SELECT pity_count FROM gacha_pity WHERE user_id = ? AND banner = ?`
  ).get(session.id, banner) as { pity_count: number } | undefined;

  let pityCount = pityRow?.pity_count ?? 0;

  // Ensure pity row exists
  if (!pityRow) {
    db.prepare(`INSERT OR IGNORE INTO gacha_pity (user_id, banner, pity_count) VALUES (?, ?, 0)`).run(session.id, banner);
  }

  const isDriverBanner = banner === "driver";
  const table = isDriverBanner ? "driver_templates" : "engineer_templates";
  const weights = isDriverBanner ? DRIVER_POOL_WEIGHTS : ENGINEER_POOL_WEIGHTS;

  // Get all templates grouped by rarity
  const templates = db.prepare(`SELECT id, name, rarity FROM ${table}`).all() as { id: number; name: string; rarity: Rarity }[];
  const byRarity: Record<Rarity, typeof templates> = { common: [], rare: [], epic: [], legendary: [] };
  for (const t of templates) {
    if (byRarity[t.rarity]) byRarity[t.rarity].push(t);
  }

  // Generate 10 results
  const results: Array<{ template_id: number; name: string; rarity: Rarity; is_new: boolean }> = [];

  for (let i = 0; i < 10; i++) {
    const rarity = weightedRoll(weights, pityCount);
    const pool = byRarity[rarity].length > 0 ? byRarity[rarity] : byRarity.common;
    const pick = pool[Math.floor(Math.random() * pool.length)];

    // Track pity: reset if epic or legendary
    if (rarity === "epic" || rarity === "legendary") {
      pityCount = 0;
    } else {
      pityCount++;
    }

    // Check if user already has this character
    const ownedTable = isDriverBanner ? "drivers" : "engineers";
    const owned = db.prepare(
      `SELECT id FROM ${ownedTable} WHERE user_id = ? AND template_id = ?`
    ).get(session.id, pick.id);

    results.push({ template_id: pick.id, name: pick.name, rarity, is_new: !owned });
  }

  // Deduct xgear
  db.prepare(`UPDATE users SET xgear = xgear - ? WHERE id = ?`).run(ROLL_COST_XGEAR, session.id);

  // Update pity
  db.prepare(`UPDATE gacha_pity SET pity_count = ? WHERE user_id = ? AND banner = ?`).run(pityCount, session.id, banner);

  db.prepare(
    `INSERT INTO activity_log (user_id, type, message, data) VALUES (?, 'gacha_roll', ?, ?)`
  ).run(session.id, `Rolled ${banner} banner`, JSON.stringify({ banner, cost: ROLL_COST_XGEAR }));

  return NextResponse.json({ success: true, results, roll_cost: ROLL_COST_XGEAR });
}

export async function PUT(req: NextRequest) {
  // Recruit the selected card from a completed roll
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { banner, template_id } = body as { banner: "driver" | "engineer"; template_id: number };

  if ((banner !== "driver" && banner !== "engineer") || typeof template_id !== "number") {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const db = await initDb();
  await seedDatabase(db);

  const isDriverBanner = banner === "driver";
  const templateTable = isDriverBanner ? "driver_templates" : "engineer_templates";
  const instanceTable = isDriverBanner ? "drivers" : "engineers";
  const capField = isDriverBanner ? "driver_cap" : "engineer_cap";

  const template = db.prepare(`SELECT * FROM ${templateTable} WHERE id = ?`).get(template_id) as Record<string, unknown> | undefined;
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  // Check cap
  const upgrades = db.prepare(`SELECT ${capField} FROM workshop_upgrades WHERE user_id = ?`).get(session.id) as Record<string, number> | undefined;
  const cap = upgrades?.[capField] ?? (isDriverBanner ? 5 : 3);
  const currentCount = (db.prepare(`SELECT COUNT(*) as cnt FROM ${instanceTable} WHERE user_id = ?`).get(session.id) as { cnt: number }).cnt;

  if (currentCount >= cap) {
    return NextResponse.json({ error: `${isDriverBanner ? "Driver" : "Engineer"} roster is full`, cap, current: currentCount }, { status: 400 });
  }

  // Check already owned
  const existing = db.prepare(`SELECT id FROM ${instanceTable} WHERE user_id = ? AND template_id = ?`).get(session.id, template_id);
  if (existing) return NextResponse.json({ error: "Already recruited", already_owned: true }, { status: 409 });

  // Insert instance
  if (isDriverBanner) {
    db.prepare(
      `INSERT INTO drivers (user_id, template_id, speed, skill, stamina, aggression)
       SELECT ?, id, base_speed, base_skill, base_stamina, base_aggression FROM driver_templates WHERE id = ?`
    ).run(session.id, template_id);
  } else {
    db.prepare(
      `INSERT INTO engineers (user_id, template_id, craft_speed, quality_bonus, race_bonus)
       SELECT ?, id, base_craft_speed, base_quality_bonus, base_race_bonus FROM engineer_templates WHERE id = ?`
    ).run(session.id, template_id);
  }

  const name = template.name as string;
  db.prepare(
    `INSERT INTO activity_log (user_id, type, message, data) VALUES (?, 'recruit', ?, ?)`
  ).run(session.id, `Recruited ${name}`, JSON.stringify({ banner, template_id }));

  return NextResponse.json({ success: true, recruited: name });
}
