import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await initDb();
  await seedDatabase(db);

  const user = db.prepare(
    `SELECT id, level, prestige, credits FROM users WHERE id = ?`
  ).get(session.id) as { id: number; level: number; prestige: number; credits: number } | undefined;

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.level >= 10) return NextResponse.json({ error: "Already at max level" }, { status: 400 });

  const nextLevel = user.level + 1;
  const req = db.prepare(
    `SELECT prestige_cost, credits_cost FROM level_requirements WHERE level = ?`
  ).get(nextLevel) as { prestige_cost: number; credits_cost: number } | undefined;

  if (!req) return NextResponse.json({ error: "Level requirement not found" }, { status: 404 });

  if (user.prestige < req.prestige_cost) {
    return NextResponse.json({ error: `Need ${req.prestige_cost} prestige (have ${user.prestige})` }, { status: 400 });
  }
  if (user.credits < req.credits_cost) {
    return NextResponse.json({ error: `Need ${req.credits_cost.toLocaleString()} credits (have ${user.credits.toLocaleString()})` }, { status: 400 });
  }

  db.prepare(
    `UPDATE users SET level = ?, prestige = prestige - ?, credits = credits - ? WHERE id = ?`
  ).run(nextLevel, req.prestige_cost, req.credits_cost, session.id);

  db.prepare(
    `INSERT INTO activity_log (user_id, type, message, credits_delta, prestige_delta, data) VALUES (?, 'level_up', ?, ?, ?, ?)`
  ).run(
    session.id,
    `Advanced to Level ${nextLevel}`,
    -req.credits_cost,
    -req.prestige_cost,
    JSON.stringify({ from_level: user.level, to_level: nextLevel })
  );

  return NextResponse.json({ success: true, new_level: nextLevel });
}
