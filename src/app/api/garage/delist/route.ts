import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { listing_id } = body as { listing_id: number };

  if (!listing_id) return NextResponse.json({ error: "Missing listing_id" }, { status: 400 });

  const db = await initDb();
  await seedDatabase(db);

  const listing = db.prepare(`
    SELECT ml.id, ml.item_id as car_id, ml.seller_id, ml.status, c.name as car_name
    FROM market_listings ml
    JOIN cars c ON c.id = ml.item_id
    WHERE ml.id = ? AND ml.listing_type = 'car'
  `).get(listing_id) as { id: number; car_id: number; seller_id: number; status: string; car_name: string } | undefined;

  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  if (listing.seller_id !== session.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  if (listing.status !== "active") return NextResponse.json({ error: "Listing is not active" }, { status: 400 });

  db.prepare(`UPDATE market_listings SET status = 'cancelled' WHERE id = ?`).run(listing_id);
  db.prepare(`UPDATE cars SET status = 'garage', sale_price = NULL WHERE id = ?`).run(listing.car_id);

  db.prepare(
    `INSERT INTO activity_log (user_id, type, message, data) VALUES (?, 'car_delisted', ?, ?)`
  ).run(session.id, `Cancelled listing for ${listing.car_name}`, JSON.stringify({ listing_id, car_id: listing.car_id }));

  return NextResponse.json({ success: true });
}
