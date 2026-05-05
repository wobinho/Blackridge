import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { seedDatabase, rollPartRarity, PART_RARITY_STAT_MULT, PART_RARITY_PRICE_MULT } from "@/lib/seed";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { queue_id } = body as { queue_id: number };

  if (typeof queue_id !== "number") {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const db = await initDb();
  await seedDatabase(db);

  const entry = db.prepare(
    `SELECT cq.id, cq.part_template_id, cq.engineer_id, cq.slot_index, cq.status, cq.completes_at
     FROM crafting_queue cq
     WHERE cq.id = ? AND cq.user_id = ?`
  ).get(queue_id, session.id) as {
    id: number;
    part_template_id: number;
    engineer_id: number | null;
    slot_index: number;
    status: string;
    completes_at: number;
  } | undefined;

  if (!entry) return NextResponse.json({ error: "Craft job not found" }, { status: 404 });
  if (entry.status !== "crafting" && entry.status !== "completed") return NextResponse.json({ error: "Job is not claimable" }, { status: 409 });

  const now = Math.floor(Date.now() / 1000);
  if (now < entry.completes_at) {
    return NextResponse.json({ error: "Not ready yet", remaining: entry.completes_at - now }, { status: 400 });
  }

  // Free engineer
  if (entry.engineer_id) {
    db.prepare(`UPDATE engineers SET status = 'idle' WHERE id = ?`).run(entry.engineer_id);
  }

  // Roll rarity at claim time
  const rarity = rollPartRarity();
  const statMult = PART_RARITY_STAT_MULT[rarity];
  const priceMult = PART_RARITY_PRICE_MULT[rarity];

  // Fetch base stats from template
  const tmpl = db.prepare(
    `SELECT name, sell_price,
            stat_speed, stat_acceleration, stat_handling, stat_stability,
            stat_durability, stat_weight, stat_braking, stat_control,
            stat_shift_speed, stat_efficiency, stat_grip, stat_cornering
     FROM part_templates WHERE id = ?`
  ).get(entry.part_template_id) as {
    name: string; sell_price: number;
    stat_speed: number; stat_acceleration: number; stat_handling: number; stat_stability: number;
    stat_durability: number; stat_weight: number; stat_braking: number; stat_control: number;
    stat_shift_speed: number; stat_efficiency: number; stat_grip: number; stat_cornering: number;
  } | undefined;

  if (!tmpl) return NextResponse.json({ error: "Part template not found" }, { status: 500 });

  const r = (v: number) => Math.round(v * statMult);

  // Insert a new inventory_parts instance (each craft = one unique instance)
  db.prepare(
    `INSERT INTO inventory_parts
       (user_id, part_template_id, rarity,
        stat_speed, stat_acceleration, stat_handling, stat_stability,
        stat_durability, stat_weight, stat_braking, stat_control,
        stat_shift_speed, stat_efficiency, stat_grip, stat_cornering,
        sale_price)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    session.id, entry.part_template_id, rarity,
    r(tmpl.stat_speed), r(tmpl.stat_acceleration), r(tmpl.stat_handling), r(tmpl.stat_stability),
    r(tmpl.stat_durability), r(tmpl.stat_weight), r(tmpl.stat_braking), r(tmpl.stat_control),
    r(tmpl.stat_shift_speed), r(tmpl.stat_efficiency), r(tmpl.stat_grip), r(tmpl.stat_cornering),
    Math.round(tmpl.sell_price * priceMult)
  );

  db.prepare(`DELETE FROM crafting_queue WHERE id = ?`).run(queue_id);

  db.prepare(
    `INSERT INTO activity_log (user_id, type, message, data) VALUES (?, 'craft_complete', ?, ?)`
  ).run(session.id, `Crafted ${rarity} ${tmpl.name}`, JSON.stringify({ part_template_id: entry.part_template_id, rarity }));

  return NextResponse.json({ success: true, rarity, part_name: tmpl.name });
}
