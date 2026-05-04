import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";

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
    `SELECT cq.id, cq.part_id, cq.engineer_id, cq.slot_index, cq.status, cq.completes_at, cq.quantity
     FROM crafting_queue cq
     WHERE cq.id = ? AND cq.user_id = ?`
  ).get(queue_id, session.id) as {
    id: number;
    part_id: number;
    engineer_id: number | null;
    slot_index: number;
    status: string;
    completes_at: number;
    quantity: number;
  } | undefined;

  if (!entry) return NextResponse.json({ error: "Craft job not found" }, { status: 404 });
  if (entry.status !== "crafting") return NextResponse.json({ error: "Job is not in progress" }, { status: 409 });

  const now = Math.floor(Date.now() / 1000);
  if (now < entry.completes_at) {
    return NextResponse.json({ error: "Not ready yet", remaining: entry.completes_at - now }, { status: 400 });
  }

  // Get engineer quality bonus for the part quality calculation
  let qualityBonus = 0;
  if (entry.engineer_id) {
    const eng = db.prepare(
      `SELECT quality_bonus FROM engineers WHERE id = ?`
    ).get(entry.engineer_id) as { quality_bonus: number } | undefined;
    if (eng) qualityBonus = eng.quality_bonus;
    db.prepare(`UPDATE engineers SET status = 'idle' WHERE id = ?`).run(entry.engineer_id);
  }

  // Quality: base 70, +0.3 per quality_bonus point, capped 100
  const quality = Math.min(100, Math.round(70 + qualityBonus * 0.3));

  // Add to inventory_parts (upsert by user+part, keeping max quality)
  const existing = db.prepare(
    `SELECT id, quantity FROM inventory_parts WHERE user_id = ? AND part_id = ?`
  ).get(session.id, entry.part_id) as { id: number; quantity: number } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE inventory_parts SET quantity = quantity + ?, quality = MAX(quality, ?) WHERE user_id = ? AND part_id = ?`
    ).run(entry.quantity, quality, session.id, entry.part_id);
  } else {
    db.prepare(
      `INSERT INTO inventory_parts (user_id, part_id, quantity, quality) VALUES (?, ?, ?, ?)`
    ).run(session.id, entry.part_id, entry.quantity, quality);
  }

  db.prepare(`UPDATE crafting_queue SET status = 'completed' WHERE id = ?`).run(queue_id);

  // Activity log
  const partName = (db.prepare(`SELECT name FROM part_templates WHERE id = ?`).get(entry.part_id) as { name: string } | undefined)?.name ?? "Part";
  db.prepare(
    `INSERT INTO activity_log (user_id, type, message, data) VALUES (?, 'craft_complete', ?, ?)`
  ).run(session.id, `Crafted ${partName}`, JSON.stringify({ part_id: entry.part_id, quality }));

  return NextResponse.json({ success: true, quality, part_id: entry.part_id });
}
