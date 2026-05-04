import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";

const REFRESH_INTERVAL = 3600; // 1 hour
const LISTING_COUNT = 8;

// Price multiplier for market parts (slight markup over craft sell_price)
const PRICE_MULT = 1.3;

function refreshPartListings(db: ReturnType<typeof import("@/lib/db").getDb>, now: number) {
  const oldest = db.prepare(
    `SELECT MIN(expires_at) as min_exp FROM market_part_listings`
  ).get() as { min_exp: number | null };

  // If any listing has expired (or no listings), refresh all
  if (oldest.min_exp !== null && now < oldest.min_exp) return;

  db.prepare(`DELETE FROM market_part_listings`).run();

  const allParts = db.prepare(`SELECT id, sell_price FROM part_templates`).all() as { id: number; sell_price: number }[];
  if (allParts.length === 0) return;

  // Pick random subset
  const shuffled = [...allParts].sort(() => Math.random() - 0.5);
  const picks = shuffled.slice(0, Math.min(LISTING_COUNT, shuffled.length));

  const insert = db.prepare(
    `INSERT INTO market_part_listings (part_id, price, quantity, listed_at, expires_at) VALUES (?, ?, ?, ?, ?)`
  );
  for (const part of picks) {
    const qty = 1 + Math.floor(Math.random() * 3); // 1-3
    const price = Math.round(part.sell_price * PRICE_MULT * (0.9 + Math.random() * 0.3));
    insert.run(part.id, price, qty, now, now + REFRESH_INTERVAL);
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await initDb();
  await seedDatabase(db);

  const now = Math.floor(Date.now() / 1000);
  refreshPartListings(db, now);

  const listings = db.prepare(`
    SELECT mpl.id, mpl.part_id, mpl.price, mpl.quantity, mpl.expires_at,
           pt.name, pt.category, pt.tier, pt.stat_speed, pt.stat_handling,
           pt.stat_durability, pt.stat_acceleration, pt.sell_price, pt.art
    FROM market_part_listings mpl
    JOIN part_templates pt ON pt.id = mpl.part_id
    ORDER BY pt.category, pt.tier
  `).all() as {
    id: number;
    part_id: number;
    price: number;
    quantity: number;
    expires_at: number;
    name: string;
    category: string;
    tier: number;
    stat_speed: number;
    stat_handling: number;
    stat_durability: number;
    stat_acceleration: number;
    sell_price: number;
    art: string | null;
  }[];

  const user = db.prepare(`SELECT credits FROM users WHERE id = ?`).get(session.id) as { credits: number };
  const nextRefresh = listings[0]?.expires_at ?? now + REFRESH_INTERVAL;

  return NextResponse.json({ listings, credits: user.credits, next_refresh: nextRefresh, now });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { listing_id, quantity } = body as { listing_id: number; quantity: number };

  if (typeof listing_id !== "number" || typeof quantity !== "number" || quantity < 1) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const db = await initDb();
  await seedDatabase(db);

  const listing = db.prepare(
    `SELECT mpl.id, mpl.part_id, mpl.price, mpl.quantity, mpl.expires_at, pt.name
     FROM market_part_listings mpl
     JOIN part_templates pt ON pt.id = mpl.part_id
     WHERE mpl.id = ?`
  ).get(listing_id) as { id: number; part_id: number; price: number; quantity: number; expires_at: number; name: string } | undefined;

  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  const now = Math.floor(Date.now() / 1000);
  if (now > listing.expires_at) return NextResponse.json({ error: "Listing has expired" }, { status: 410 });
  if (quantity > listing.quantity) return NextResponse.json({ error: "Not enough stock", available: listing.quantity }, { status: 400 });

  const totalCost = listing.price * quantity;
  const user = db.prepare(`SELECT credits FROM users WHERE id = ?`).get(session.id) as { credits: number };

  if (user.credits < totalCost) {
    return NextResponse.json({ error: "Insufficient credits", required: totalCost, have: user.credits }, { status: 400 });
  }

  db.prepare(`UPDATE users SET credits = credits - ? WHERE id = ?`).run(totalCost, session.id);
  db.prepare(
    `INSERT INTO inventory_parts (user_id, part_id, quantity, quality) VALUES (?, ?, ?, 80)
     ON CONFLICT(user_id, part_id) DO UPDATE SET quantity = quantity + excluded.quantity`
  ).run(session.id, listing.part_id, quantity);
  db.prepare(`UPDATE market_part_listings SET quantity = quantity - ? WHERE id = ?`).run(quantity, listing_id);

  db.prepare(
    `INSERT INTO activity_log (user_id, type, message, credits_delta, data) VALUES (?, 'market_buy', ?, ?, ?)`
  ).run(session.id, `Bought ${quantity}x ${listing.name}`, -totalCost, JSON.stringify({ part_id: listing.part_id, quantity, cost: totalCost }));

  return NextResponse.json({ success: true, cost: totalCost });
}
