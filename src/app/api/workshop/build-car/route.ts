import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";

const CAR_BUILD_BASE_SECONDS = 3600; // 1 hour base

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    car_template_id,
    car_name,
    slot_index,
    engineer_id_1,
    engineer_id_2,
    part_engine_id,
    part_suspension_id,
    part_chassis_id,
    part_brakes_id,
    part_gearbox_id,
    part_tires_id,
  } = body;

  if (!car_template_id || !part_engine_id || !part_suspension_id || !part_chassis_id ||
      !part_brakes_id || !part_gearbox_id || !part_tires_id) {
    return NextResponse.json({ error: "All 6 part slots must be assigned." }, { status: 400 });
  }

  if (typeof slot_index !== "number") {
    return NextResponse.json({ error: "slot_index is required." }, { status: 400 });
  }

  const db = await initDb();

  // Verify slot is free
  const upgrades = db.prepare(
    `SELECT develop_slots FROM workshop_upgrades WHERE user_id = ?`
  ).get(session.id) as { develop_slots: number } | undefined;
  const slotsLevel = upgrades?.develop_slots ?? 0;
  const maxSlots = 2 + slotsLevel * 1;

  if (slot_index < 0 || slot_index >= maxSlots) {
    return NextResponse.json({ error: "Invalid slot index." }, { status: 400 });
  }

  const slotBusyPart = db.prepare(
    `SELECT id FROM crafting_queue WHERE user_id = ? AND slot_index = ? AND status = 'crafting'`
  ).get(session.id, slot_index);
  const slotBusyCar = db.prepare(
    `SELECT id FROM car_crafting_queue WHERE user_id = ? AND slot_index = ? AND status IN ('crafting','completed')`
  ).get(session.id, slot_index);

  if (slotBusyPart || slotBusyCar) {
    return NextResponse.json({ error: "Slot is already in use." }, { status: 409 });
  }

  // Verify blueprint ownership
  const blueprint = db.prepare(
    `SELECT id, quantity FROM user_blueprints WHERE user_id = ? AND car_template_id = ? AND quantity > 0`
  ).get(session.id, car_template_id) as { id: number; quantity: number } | undefined;

  if (!blueprint) {
    return NextResponse.json({ error: "You do not own this blueprint." }, { status: 400 });
  }

  // Verify all parts belong to user and are in inventory status
  const partIds = [part_engine_id, part_suspension_id, part_chassis_id, part_brakes_id, part_gearbox_id, part_tires_id];
  const partCategoryMap: Record<number, string> = {
    [part_engine_id]:     "engine",
    [part_suspension_id]: "suspension",
    [part_chassis_id]:    "chassis",
    [part_brakes_id]:     "brakes",
    [part_gearbox_id]:    "gearbox",
    [part_tires_id]:      "tires",
  };

  for (const [partId, expectedCat] of Object.entries(partCategoryMap)) {
    const part = db.prepare(
      `SELECT ip.id, pt.category FROM inventory_parts ip
       JOIN part_templates pt ON pt.id = ip.part_template_id
       WHERE ip.id = ? AND ip.user_id = ? AND ip.status = 'inventory'`
    ).get(Number(partId), session.id) as { id: number; category: string } | undefined;

    if (!part) {
      return NextResponse.json({ error: `Part ${partId} not found in your inventory.` }, { status: 400 });
    }
    if (part.category !== expectedCat) {
      return NextResponse.json({ error: `Part ${partId} is not a ${expectedCat}.` }, { status: 400 });
    }
  }

  // Validate engineers (optional, must belong to user and be idle)
  const validateEngineer = (engId: number | null) => {
    if (!engId) return true;
    const eng = db.prepare(
      `SELECT id FROM engineers WHERE id = ? AND user_id = ? AND status = 'idle'`
    ).get(engId, session.id);
    return !!eng;
  };

  if (!validateEngineer(engineer_id_1) || !validateEngineer(engineer_id_2)) {
    return NextResponse.json({ error: "One or more engineers are unavailable." }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);

  // Calculate build time (each assigned engineer reduces time by 15%)
  let buildTime = CAR_BUILD_BASE_SECONDS;
  if (engineer_id_1) buildTime = Math.round(buildTime * 0.85);
  if (engineer_id_2) buildTime = Math.round(buildTime * 0.85);
  const completesAt = now + buildTime;

  // Deduct blueprint
  db.prepare(
    `UPDATE user_blueprints SET quantity = quantity - 1 WHERE id = ?`
  ).run(blueprint.id);

  // Mark parts as equipped (taken out of inventory)
  for (const partId of partIds) {
    db.prepare(`UPDATE inventory_parts SET status = 'equipped' WHERE id = ?`).run(partId);
  }

  // Mark engineers as crafting
  if (engineer_id_1) db.prepare(`UPDATE engineers SET status = 'crafting' WHERE id = ?`).run(engineer_id_1);
  if (engineer_id_2) db.prepare(`UPDATE engineers SET status = 'crafting' WHERE id = ?`).run(engineer_id_2);

  // Find any placeholder engineer to satisfy NOT NULL FK constraints on legacy columns
  // We use the optional columns engineer_id_1_opt/2_opt for the actual logic
  const anyEng = db.prepare(`SELECT id FROM engineers WHERE user_id = ? LIMIT 1`).get(session.id) as { id: number } | undefined;
  const engPlaceholder = anyEng?.id ?? 1;

  // Insert car crafting queue entry
  db.prepare(
    `INSERT INTO car_crafting_queue
      (user_id, car_template_id, blueprint_id, engineer_id_1, engineer_id_2,
       part_engine_id, part_suspension_id, part_chassis_id, part_brakes_id, part_gearbox_id, part_tires_id,
       engineer_id_1_opt, engineer_id_2_opt,
       slot_index, status, started_at, completes_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'crafting', ?, ?)`
  ).run(
    session.id, car_template_id, blueprint.id,
    engineer_id_1 ?? engPlaceholder, engineer_id_2 ?? engPlaceholder,
    part_engine_id, part_suspension_id, part_chassis_id, part_brakes_id, part_gearbox_id, part_tires_id,
    engineer_id_1 ?? null, engineer_id_2 ?? null,
    slot_index, now, completesAt
  );

  return NextResponse.json({ ok: true, completes_at: completesAt });
}
