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
    `SELECT cq.id, cq.part_id, cq.engineer_id, cq.status, cq.started_at, pt.base_materials
     FROM crafting_queue cq
     JOIN part_templates pt ON pt.id = cq.part_id
     WHERE cq.id = ? AND cq.user_id = ?`
  ).get(queue_id, session.id) as {
    id: number;
    part_id: number;
    engineer_id: number | null;
    status: string;
    started_at: number;
    base_materials: string;
  } | undefined;

  if (!entry) return NextResponse.json({ error: "Craft job not found" }, { status: 404 });
  if (entry.status !== "crafting") return NextResponse.json({ error: "Job cannot be cancelled" }, { status: 409 });

  // Refund 50% of materials
  const ingredients = JSON.parse(entry.base_materials) as { material_id: number; qty: number }[];
  for (const ing of ingredients) {
    const refundQty = Math.floor(ing.qty * 0.5);
    if (refundQty > 0) {
      db.prepare(
        `INSERT INTO inventory_materials (user_id, material_id, quantity) VALUES (?, ?, ?)
         ON CONFLICT(user_id, material_id) DO UPDATE SET quantity = quantity + excluded.quantity`
      ).run(session.id, ing.material_id, refundQty);
    }
  }

  // Free engineer
  if (entry.engineer_id) {
    db.prepare(`UPDATE engineers SET status = 'idle' WHERE id = ?`).run(entry.engineer_id);
  }

  db.prepare(`UPDATE crafting_queue SET status = 'cancelled' WHERE id = ?`).run(queue_id);

  return NextResponse.json({ success: true, refunded: true });
}
