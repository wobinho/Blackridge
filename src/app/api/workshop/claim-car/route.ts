import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { build_id } = body as { build_id: number };

  if (typeof build_id !== "number") {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const db = await initDb();

  const entry = db.prepare(
    `SELECT id, status, completes_at,
            engineer_id_1_opt, engineer_id_2_opt,
            part_engine_id, part_suspension_id, part_chassis_id,
            part_brakes_id, part_gearbox_id, part_tires_id,
            car_template_id
     FROM car_crafting_queue
     WHERE id = ? AND user_id = ?`
  ).get(build_id, session.id) as {
    id: number; status: string; completes_at: number;
    engineer_id_1_opt: number | null; engineer_id_2_opt: number | null;
    part_engine_id: number; part_suspension_id: number; part_chassis_id: number;
    part_brakes_id: number; part_gearbox_id: number; part_tires_id: number;
    car_template_id: number;
  } | undefined;

  if (!entry) return NextResponse.json({ error: "Build not found" }, { status: 404 });
  if (entry.status === "cancelled") return NextResponse.json({ error: "Build was cancelled" }, { status: 409 });

  const now = Math.floor(Date.now() / 1000);
  if (now < entry.completes_at) {
    return NextResponse.json({ error: "Not ready yet", remaining: entry.completes_at - now }, { status: 400 });
  }

  // Free engineers
  if (entry.engineer_id_1_opt) {
    db.prepare(`UPDATE engineers SET status = 'idle' WHERE id = ?`).run(entry.engineer_id_1_opt);
  }
  if (entry.engineer_id_2_opt && entry.engineer_id_2_opt !== entry.engineer_id_1_opt) {
    db.prepare(`UPDATE engineers SET status = 'idle' WHERE id = ?`).run(entry.engineer_id_2_opt);
  }

  // Fetch car template for base stats and name
  const tmpl = db.prepare(
    `SELECT name, base_speed, base_acceleration, base_handling, base_stability,
            base_durability, base_weight, base_braking, base_control,
            base_shift_speed, base_efficiency, base_grip, base_cornering
     FROM car_templates WHERE id = ?`
  ).get(entry.car_template_id) as {
    name: string;
    base_speed: number; base_acceleration: number; base_handling: number; base_stability: number;
    base_durability: number; base_weight: number; base_braking: number; base_control: number;
    base_shift_speed: number; base_efficiency: number; base_grip: number; base_cornering: number;
  } | undefined;

  if (!tmpl) return NextResponse.json({ error: "Car template not found" }, { status: 500 });

  // Aggregate part stats
  const partIds = [
    entry.part_engine_id, entry.part_suspension_id, entry.part_chassis_id,
    entry.part_brakes_id, entry.part_gearbox_id, entry.part_tires_id,
  ];

  let totalSpeed = tmpl.base_speed, totalAccel = tmpl.base_acceleration;
  let totalHandling = tmpl.base_handling, totalStability = tmpl.base_stability;
  let totalDurability = tmpl.base_durability, totalWeight = tmpl.base_weight;
  let totalBraking = tmpl.base_braking, totalControl = tmpl.base_control;
  let totalShift = tmpl.base_shift_speed, totalEff = tmpl.base_efficiency;
  let totalGrip = tmpl.base_grip, totalCornering = tmpl.base_cornering;

  for (const partId of partIds) {
    const p = db.prepare(
      `SELECT stat_speed, stat_acceleration, stat_handling, stat_stability,
              stat_durability, stat_weight, stat_braking, stat_control,
              stat_shift_speed, stat_efficiency, stat_grip, stat_cornering
       FROM inventory_parts WHERE id = ?`
    ).get(partId) as {
      stat_speed: number; stat_acceleration: number; stat_handling: number; stat_stability: number;
      stat_durability: number; stat_weight: number; stat_braking: number; stat_control: number;
      stat_shift_speed: number; stat_efficiency: number; stat_grip: number; stat_cornering: number;
    } | undefined;
    if (p) {
      totalSpeed += p.stat_speed; totalAccel += p.stat_acceleration;
      totalHandling += p.stat_handling; totalStability += p.stat_stability;
      totalDurability += p.stat_durability; totalWeight += p.stat_weight;
      totalBraking += p.stat_braking; totalControl += p.stat_control;
      totalShift += p.stat_shift_speed; totalEff += p.stat_efficiency;
      totalGrip += p.stat_grip; totalCornering += p.stat_cornering;
    }
  }

  // Insert car into garage
  let carId: number;
  try {
    const result = db.prepare(
      `INSERT INTO cars (user_id, car_template_id, name,
         stat_speed, stat_acceleration, stat_handling, stat_stability,
         stat_durability, stat_weight, stat_braking, stat_control,
         stat_shift_speed, stat_efficiency, stat_grip, stat_cornering)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      session.id, entry.car_template_id, tmpl.name,
      totalSpeed, totalAccel, totalHandling, totalStability,
      totalDurability, totalWeight, totalBraking, totalControl,
      totalShift, totalEff, totalGrip, totalCornering
    );
    carId = result.lastInsertRowid;
    if (!carId) throw new Error("Car INSERT returned no rowid");
  } catch (err) {
    console.error("[claim-car] Failed to insert car:", err);
    return NextResponse.json({ error: "Failed to create car" }, { status: 500 });
  }

  // Attach parts to the car
  const partSlotNames = ["engine", "suspension", "chassis", "brakes", "gearbox", "tires"];
  for (let i = 0; i < partIds.length; i++) {
    db.prepare(
      `INSERT OR IGNORE INTO car_parts (car_id, inventory_part_id, slot) VALUES (?, ?, ?)`
    ).run(carId, partIds[i], partSlotNames[i]);
    db.prepare(`UPDATE inventory_parts SET status = 'equipped' WHERE id = ?`).run(partIds[i]);
  }

  db.prepare(`DELETE FROM car_crafting_queue WHERE id = ?`).run(build_id);

  return NextResponse.json({ success: true, car_id: carId, car_name: tmpl.name });
}
