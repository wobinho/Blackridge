import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";

// 1 XGEAR per minute remaining (rounded up)
const XGEAR_PER_MINUTE = 1;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type, id } = body as { type: "part" | "car"; id: number };

  if (!type || !id || (type !== "part" && type !== "car")) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const db = await initDb();
  const now = Math.floor(Date.now() / 1000);

  // Fetch the queue entry
  let completes_at: number | null = null;
  let entryExists = false;

  if (type === "part") {
    const entry = db.prepare(
      `SELECT completes_at FROM crafting_queue WHERE id = ? AND user_id = ? AND status = 'crafting'`
    ).get(id, session.id) as { completes_at: number } | undefined;
    if (entry) { completes_at = entry.completes_at; entryExists = true; }
  } else {
    const entry = db.prepare(
      `SELECT completes_at FROM car_crafting_queue WHERE id = ? AND user_id = ? AND status = 'crafting'`
    ).get(id, session.id) as { completes_at: number } | undefined;
    if (entry) { completes_at = entry.completes_at; entryExists = true; }
  }

  if (!entryExists || completes_at === null) {
    return NextResponse.json({ error: "Build not found or already complete" }, { status: 404 });
  }

  const secondsRemaining = Math.max(0, completes_at - now);
  if (secondsRemaining === 0) {
    return NextResponse.json({ error: "Build is already complete" }, { status: 400 });
  }

  const minutesRemaining = Math.ceil(secondsRemaining / 60);
  const cost = minutesRemaining * XGEAR_PER_MINUTE;

  // Check user has enough XGEAR
  const user = db.prepare(`SELECT xgear FROM users WHERE id = ?`).get(session.id) as { xgear: number } | undefined;
  if (!user || user.xgear < cost) {
    return NextResponse.json({ error: "Not enough XGEAR", cost, have: user?.xgear ?? 0 }, { status: 400 });
  }

  // Deduct XGEAR and set completes_at to now (instant complete)
  db.prepare(`UPDATE users SET xgear = xgear - ? WHERE id = ?`).run(cost, session.id);

  if (type === "part") {
    db.prepare(`UPDATE crafting_queue SET completes_at = ?, status = 'completed' WHERE id = ?`).run(now, id);
  } else {
    db.prepare(`UPDATE car_crafting_queue SET completes_at = ?, status = 'completed' WHERE id = ?`).run(now, id);
  }

  return NextResponse.json({ ok: true, cost, xgear_remaining: user.xgear - cost });
}
