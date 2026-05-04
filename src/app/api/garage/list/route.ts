import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { car_id, price } = body as { car_id: number; price: number };

  if (!car_id || typeof price !== "number" || price <= 0) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const db = await initDb();
  await seedDatabase(db);

  const car = db.prepare(
    `SELECT id, name, status FROM cars WHERE id = ? AND user_id = ?`
  ).get(car_id, session.id) as { id: number; name: string; status: string } | undefined;

  if (!car) return NextResponse.json({ error: "Car not found" }, { status: 404 });
  if (car.status !== "garage") return NextResponse.json({ error: "Car is not available for listing" }, { status: 400 });

  db.prepare(`UPDATE cars SET status = 'for_sale', sale_price = ? WHERE id = ?`).run(price, car_id);

  const result = db.prepare(
    `INSERT INTO market_listings (seller_id, listing_type, item_id, price) VALUES (?, 'car', ?, ?)`
  ).run(session.id, car_id, price);

  const listing_id = result.lastInsertRowid;

  db.prepare(
    `INSERT INTO activity_log (user_id, type, message, data) VALUES (?, 'car_listed', ?, ?)`
  ).run(session.id, `Listed ${car.name} for ${price.toLocaleString()} CR`, JSON.stringify({ car_id, price, listing_id }));

  return NextResponse.json({ success: true, listing_id });
}
