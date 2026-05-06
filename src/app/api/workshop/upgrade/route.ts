import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";

// Upgrade config: cost formula per level and max level
const UPGRADE_CONFIG: Record<string, { maxLevel: number; baseCost: number; costScale: number; label: string }> = {
  develop_slots:       { maxLevel: 8,  baseCost: 2000,  costScale: 2.5,  label: "Develop Slots" },
  develop_speed:       { maxLevel: 10, baseCost: 3000,  costScale: 2.0,  label: "Develop Speed" },
  inventory_size:      { maxLevel: 12, baseCost: 1000,  costScale: 1.8,  label: "Inventory Size (Parts)" },
  inventory_mats_size: { maxLevel: 18, baseCost: 800,   costScale: 1.5,  label: "Inventory Size (Materials)" },
  engineer_cap:        { maxLevel: 23, baseCost: 2500,  costScale: 2.0,  label: "Engineer Capacity" },
  driver_cap:          { maxLevel: 23, baseCost: 2500,  costScale: 2.0,  label: "Driver Capacity" },
  garage_cap:          { maxLevel: 18, baseCost: 1500,  costScale: 1.6,  label: "Garage Capacity" },
  market_mat_slots:    { maxLevel: 4,  baseCost: 3000,  costScale: 2.2,  label: "Market Supply Lines" },
  market_mat_rarity:   { maxLevel: 5,  baseCost: 4000,  costScale: 2.8,  label: "Market Intel" },
};

function upgradeCost(field: string, currentLevel: number): number {
  const cfg = UPGRADE_CONFIG[field];
  if (!cfg) return Infinity;
  return Math.round(cfg.baseCost * Math.pow(cfg.costScale, currentLevel));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { field } = body as { field: string };

  if (!field || !UPGRADE_CONFIG[field]) {
    return NextResponse.json({ error: "Invalid upgrade field" }, { status: 400 });
  }

  const db = await initDb();
  await seedDatabase(db);

  const upgrades = db.prepare(
    `SELECT * FROM workshop_upgrades WHERE user_id = ?`
  ).get(session.id) as Record<string, number> | undefined;

  if (!upgrades) return NextResponse.json({ error: "Workshop not found" }, { status: 404 });

  const currentLevel = upgrades[field] as number;
  const cfg = UPGRADE_CONFIG[field];

  if (currentLevel >= cfg.maxLevel) {
    return NextResponse.json({ error: "Already at max level" }, { status: 400 });
  }

  const cost = upgradeCost(field, currentLevel);
  const user = db.prepare(`SELECT credits FROM users WHERE id = ?`).get(session.id) as { credits: number } | undefined;

  if (!user || user.credits < cost) {
    return NextResponse.json({ error: "Insufficient credits", required: cost, have: user?.credits ?? 0 }, { status: 400 });
  }

  db.prepare(`UPDATE users SET credits = credits - ? WHERE id = ?`).run(cost, session.id);
  db.prepare(`UPDATE workshop_upgrades SET ${field} = ${field} + 1 WHERE user_id = ?`).run(session.id);

  const newLevel = currentLevel + 1;

  db.prepare(
    `INSERT INTO activity_log (user_id, type, message, credits_delta, data) VALUES (?, 'upgrade', ?, ?, ?)`
  ).run(session.id, `Upgraded ${cfg.label} to level ${newLevel}`, -cost, JSON.stringify({ field, new_level: newLevel }));

  return NextResponse.json({ success: true, field, new_level: newLevel, cost_paid: cost });
}
