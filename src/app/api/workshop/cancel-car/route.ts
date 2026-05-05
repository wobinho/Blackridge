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
    `SELECT id, status, blueprint_id,
            engineer_id_1_opt, engineer_id_2_opt,
            part_engine_id, part_suspension_id, part_chassis_id,
            part_brakes_id, part_gearbox_id, part_tires_id,
            car_template_id
     FROM car_crafting_queue
     WHERE id = ? AND user_id = ?`
  ).get(build_id, session.id) as {
    id: number; status: string; blueprint_id: number;
    engineer_id_1_opt: number | null; engineer_id_2_opt: number | null;
    part_engine_id: number; part_suspension_id: number; part_chassis_id: number;
    part_brakes_id: number; part_gearbox_id: number; part_tires_id: number;
    car_template_id: number;
  } | undefined;

  if (!entry) return NextResponse.json({ error: "Build not found" }, { status: 404 });
  if (entry.status !== "crafting") return NextResponse.json({ error: "Build cannot be cancelled" }, { status: 409 });

  // Free engineers
  if (entry.engineer_id_1_opt) {
    db.prepare(`UPDATE engineers SET status = 'idle' WHERE id = ?`).run(entry.engineer_id_1_opt);
  }
  if (entry.engineer_id_2_opt && entry.engineer_id_2_opt !== entry.engineer_id_1_opt) {
    db.prepare(`UPDATE engineers SET status = 'idle' WHERE id = ?`).run(entry.engineer_id_2_opt);
  }

  // Return parts to inventory
  const partIds = [
    entry.part_engine_id, entry.part_suspension_id, entry.part_chassis_id,
    entry.part_brakes_id, entry.part_gearbox_id, entry.part_tires_id,
  ];
  for (const partId of partIds) {
    db.prepare(`UPDATE inventory_parts SET status = 'inventory' WHERE id = ?`).run(partId);
  }

  // Restore blueprint
  db.prepare(`UPDATE user_blueprints SET quantity = quantity + 1 WHERE id = ?`).run(entry.blueprint_id);

  db.prepare(`UPDATE car_crafting_queue SET status = 'cancelled' WHERE id = ?`).run(build_id);

  return NextResponse.json({ success: true });
}
