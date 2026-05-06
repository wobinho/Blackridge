import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await initDb();
  await seedDatabase(db);

  // Cars listed for sale by OTHER users (not the current user)
  const listings = db.prepare(`
    SELECT
      ml.id as listing_id,
      ml.item_id as car_id,
      ml.price,
      ml.listed_at,
      ml.seller_id,
      u.username as seller_name,
      u.brand_name as seller_brand,
      c.name as car_name,
      c.stat_speed, c.stat_handling, c.stat_durability, c.stat_acceleration,
      c.stat_stability, c.stat_weight, c.stat_braking, c.stat_control,
      c.stat_shift_speed, c.stat_efficiency, c.stat_grip, c.stat_cornering,
      c.wear, c.total_races, c.total_wins,
      ct.name as template_name, ct.archetype, ct.art, ct.model_code,
      c.color
    FROM market_listings ml
    JOIN users u ON u.id = ml.seller_id
    JOIN cars c ON c.id = ml.item_id
    JOIN car_templates ct ON ct.id = c.car_template_id
    WHERE ml.listing_type = 'car'
      AND ml.status = 'active'
      AND ml.seller_id != ?
    ORDER BY ml.listed_at DESC
    LIMIT 50
  `).all(session.id) as {
    listing_id: number;
    car_id: number;
    price: number;
    listed_at: number;
    seller_id: number;
    seller_name: string;
    seller_brand: string;
    car_name: string;
    stat_speed: number; stat_handling: number; stat_durability: number; stat_acceleration: number;
    stat_stability: number; stat_weight: number; stat_braking: number; stat_control: number;
    stat_shift_speed: number; stat_efficiency: number; stat_grip: number; stat_cornering: number;
    wear: number;
    total_races: number;
    total_wins: number;
    template_name: string;
    archetype: string;
    art: string | null;
    model_code: string;
    color: string;
  }[];

  const user = db.prepare(`SELECT credits FROM users WHERE id = ?`).get(session.id) as { credits: number };

  return NextResponse.json({ listings, credits: user.credits });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { listing_id } = body as { listing_id: number };

  if (typeof listing_id !== "number") {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const db = await initDb();
  await seedDatabase(db);

  const listing = db.prepare(`
    SELECT ml.id, ml.item_id as car_id, ml.price, ml.seller_id, ml.status, c.name as car_name
    FROM market_listings ml
    JOIN cars c ON c.id = ml.item_id
    WHERE ml.id = ? AND ml.listing_type = 'car' AND ml.status = 'active'
  `).get(listing_id) as { id: number; car_id: number; price: number; seller_id: number; status: string; car_name: string } | undefined;

  if (!listing) return NextResponse.json({ error: "Listing not found or no longer available" }, { status: 404 });
  if (listing.seller_id === session.id) return NextResponse.json({ error: "Cannot buy your own car" }, { status: 400 });

  const upgrades = db.prepare(`SELECT garage_cap FROM workshop_upgrades WHERE user_id = ?`).get(session.id) as { garage_cap: number } | undefined;
  const garageLevel = upgrades?.garage_cap ?? 0;
  const cap = 10 + garageLevel * 5;
  const carCount = (db.prepare(`SELECT COUNT(*) as cnt FROM cars WHERE user_id = ? AND status != 'sold'`).get(session.id) as { cnt: number }).cnt;

  if (carCount >= cap) {
    return NextResponse.json({ error: "Garage is full", cap, current: carCount }, { status: 400 });
  }

  const buyer = db.prepare(`SELECT credits FROM users WHERE id = ?`).get(session.id) as { credits: number };
  if (buyer.credits < listing.price) {
    return NextResponse.json({ error: "Insufficient credits", required: listing.price, have: buyer.credits }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);

  // Transfer credits
  db.prepare(`UPDATE users SET credits = credits - ? WHERE id = ?`).run(listing.price, session.id);
  db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ?`).run(listing.price, listing.seller_id);

  // Transfer car ownership
  db.prepare(`UPDATE cars SET user_id = ?, status = 'garage' WHERE id = ?`).run(session.id, listing.car_id);

  // Mark listing sold
  db.prepare(
    `UPDATE market_listings SET status = 'sold', buyer_id = ?, sold_at = ? WHERE id = ?`
  ).run(session.id, now, listing_id);

  db.prepare(
    `INSERT INTO activity_log (user_id, type, message, credits_delta, data) VALUES (?, 'market_buy', ?, ?, ?)`
  ).run(session.id, `Bought ${listing.car_name}`, -listing.price, JSON.stringify({ listing_id, car_id: listing.car_id, price: listing.price }));

  db.prepare(
    `INSERT INTO activity_log (user_id, type, message, credits_delta, data) VALUES (?, 'market_sale', ?, ?, ?)`
  ).run(listing.seller_id, `Sold ${listing.car_name}`, listing.price, JSON.stringify({ listing_id, car_id: listing.car_id, price: listing.price }));

  return NextResponse.json({ success: true, car_id: listing.car_id, cost: listing.price });
}
