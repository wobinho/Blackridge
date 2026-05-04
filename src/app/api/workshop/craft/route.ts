import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { part_template_id, slot_index, engineer_id } = body as {
    part_template_id: number;
    slot_index: number;
    engineer_id?: number;
  };

  if (typeof part_template_id !== "number" || typeof slot_index !== "number") {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const db = await initDb();
  await seedDatabase(db);

  const upgrades = db.prepare(
    `SELECT develop_slots, develop_speed FROM workshop_upgrades WHERE user_id = ?`
  ).get(session.id) as { develop_slots: number; develop_speed: number } | undefined;

  const maxSlots = upgrades?.develop_slots ?? 2;
  const speedLevel = upgrades?.develop_speed ?? 1;

  if (slot_index < 0 || slot_index >= maxSlots) {
    return NextResponse.json({ error: "Invalid slot index" }, { status: 400 });
  }

  const existing = db.prepare(
    `SELECT id FROM crafting_queue WHERE user_id = ? AND slot_index = ? AND status = 'crafting'`
  ).get(session.id, slot_index);

  if (existing) {
    return NextResponse.json({ error: "Slot is already in use" }, { status: 409 });
  }

  const part = db.prepare(
    `SELECT id, name, craft_time, recipe FROM part_templates WHERE id = ?`
  ).get(part_template_id) as { id: number; name: string; craft_time: number; recipe: string } | undefined;

  if (!part) {
    return NextResponse.json({ error: "Part not found" }, { status: 404 });
  }

  let craftSpeedBonus = 0;
  if (engineer_id) {
    const eng = db.prepare(
      `SELECT id, craft_speed, status FROM engineers WHERE id = ? AND user_id = ?`
    ).get(engineer_id, session.id) as { id: number; craft_speed: number; status: string } | undefined;

    if (!eng) return NextResponse.json({ error: "Engineer not found" }, { status: 404 });
    if (eng.status !== "idle") return NextResponse.json({ error: "Engineer is busy" }, { status: 409 });

    craftSpeedBonus = eng.craft_speed;
    db.prepare(`UPDATE engineers SET status = 'crafting' WHERE id = ?`).run(engineer_id);
  }

  // Deduct materials from recipe
  const ingredients = JSON.parse(part.recipe) as { material_id: number; qty: number }[];
  for (const ing of ingredients) {
    const stock = db.prepare(
      `SELECT quantity FROM inventory_materials WHERE user_id = ? AND material_id = ?`
    ).get(session.id, ing.material_id) as { quantity: number } | undefined;

    if (!stock || stock.quantity < ing.qty) {
      if (engineer_id) {
        db.prepare(`UPDATE engineers SET status = 'idle' WHERE id = ?`).run(engineer_id);
      }
      return NextResponse.json({ error: "Insufficient materials" }, { status: 400 });
    }
  }

  for (const ing of ingredients) {
    db.prepare(
      `UPDATE inventory_materials SET quantity = quantity - ? WHERE user_id = ? AND material_id = ?`
    ).run(ing.qty, session.id, ing.material_id);
  }

  const engineerReduction = craftSpeedBonus > 0 ? (craftSpeedBonus / 10) * 0.05 : 0;
  const upgradeReduction = (speedLevel - 1) * 0.10;
  const totalReduction = Math.min(0.75, engineerReduction + upgradeReduction);
  const craftSeconds = Math.max(30, Math.round(part.craft_time * (1 - totalReduction)));

  const now = Math.floor(Date.now() / 1000);
  const completesAt = now + craftSeconds;

  const result = db.prepare(
    `INSERT INTO crafting_queue (user_id, part_template_id, engineer_id, slot_index, status, started_at, completes_at)
     VALUES (?, ?, ?, ?, 'crafting', ?, ?)`
  ).run(session.id, part_template_id, engineer_id ?? null, slot_index, now, completesAt);

  return NextResponse.json({
    success: true,
    queue_id: result.lastInsertRowid,
    completes_at: completesAt,
    craft_seconds: craftSeconds,
  });
}
