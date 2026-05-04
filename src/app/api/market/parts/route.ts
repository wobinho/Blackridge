import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { seedDatabase, rollPartRarity, PART_RARITY_STAT_MULT, PART_RARITY_PRICE_MULT } from "@/lib/seed";

const REFRESH_INTERVAL = 3600; // 1 hour
const LISTING_COUNT = 6;

const PRICE_MULT = 1.3;

function refreshPartListings(db: ReturnType<typeof import("@/lib/db").getDb>, now: number) {
  const oldest = db.prepare(
    `SELECT MIN(expires_at) as min_exp FROM market_part_listings`
  ).get() as { min_exp: number | null };

  if (oldest.min_exp !== null && now < oldest.min_exp) return;

  db.prepare(`DELETE FROM market_part_listings`).run();

  const allParts = db.prepare(`SELECT id, sell_price FROM part_templates`).all() as { id: number; sell_price: number }[];
  if (allParts.length === 0) return;

  const shuffled = [...allParts].sort(() => Math.random() - 0.5);
  const picks = shuffled.slice(0, Math.min(LISTING_COUNT, shuffled.length));

  const insert = db.prepare(
    `INSERT INTO market_part_listings (part_id, price, quantity, listed_at, expires_at) VALUES (?, ?, ?, ?, ?)`
  );
  for (const part of picks) {
    const qty = 1 + Math.floor(Math.random() * 3);
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
           pt.name, pt.category, pt.art,
           pt.stat_speed, pt.stat_acceleration, pt.stat_handling, pt.stat_stability,
           pt.stat_durability, pt.stat_weight, pt.stat_braking, pt.stat_control,
           pt.stat_shift_speed, pt.stat_efficiency, pt.stat_grip, pt.stat_cornering,
           pt.sell_price
    FROM market_part_listings mpl
    JOIN part_templates pt ON pt.id = mpl.part_id
    ORDER BY pt.category
  `).all() as {
    id: number;
    part_id: number;
    price: number;
    quantity: number;
    expires_at: number;
    name: string;
    category: string;
    art: string | null;
    stat_speed: number; stat_acceleration: number; stat_handling: number; stat_stability: number;
    stat_durability: number; stat_weight: number; stat_braking: number; stat_control: number;
    stat_shift_speed: number; stat_efficiency: number; stat_grip: number; stat_cornering: number;
    sell_price: number;
  }[];

  const user = db.prepare(`SELECT credits FROM users WHERE id = ?`).get(session.id) as { credits: number };
  const nextRefresh = listings[0]?.expires_at ?? now + REFRESH_INTERVAL;

  return NextResponse.json({ listings, credits: user.credits, next_refresh: nextRefresh, now });
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

  const listing = db.prepare(
    `SELECT mpl.id, mpl.part_id, mpl.price, mpl.quantity, mpl.expires_at, pt.name,
            pt.stat_speed, pt.stat_acceleration, pt.stat_handling, pt.stat_stability,
            pt.stat_durability, pt.stat_weight, pt.stat_braking, pt.stat_control,
            pt.stat_shift_speed, pt.stat_efficiency, pt.stat_grip, pt.stat_cornering,
            pt.sell_price
     FROM market_part_listings mpl
     JOIN part_templates pt ON pt.id = mpl.part_id
     WHERE mpl.id = ?`
  ).get(listing_id) as {
    id: number; part_id: number; price: number; quantity: number; expires_at: number; name: string;
    stat_speed: number; stat_acceleration: number; stat_handling: number; stat_stability: number;
    stat_durability: number; stat_weight: number; stat_braking: number; stat_control: number;
    stat_shift_speed: number; stat_efficiency: number; stat_grip: number; stat_cornering: number;
    sell_price: number;
  } | undefined;

  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  const now = Math.floor(Date.now() / 1000);
  if (now > listing.expires_at) return NextResponse.json({ error: "Listing has expired" }, { status: 410 });
  if (listing.quantity < 1) return NextResponse.json({ error: "Out of stock" }, { status: 400 });

  const totalCost = listing.price;
  const user = db.prepare(`SELECT credits FROM users WHERE id = ?`).get(session.id) as { credits: number };

  if (user.credits < totalCost) {
    return NextResponse.json({ error: "Insufficient credits", required: totalCost, have: user.credits }, { status: 400 });
  }

  // Roll rarity for the purchased part instance
  const rarity = rollPartRarity();
  const statMult = PART_RARITY_STAT_MULT[rarity];
  const priceMult = PART_RARITY_PRICE_MULT[rarity];
  const r = (v: number) => Math.round(v * statMult);

  db.prepare(`UPDATE users SET credits = credits - ? WHERE id = ?`).run(totalCost, session.id);

  db.prepare(
    `INSERT INTO inventory_parts
       (user_id, part_template_id, rarity,
        stat_speed, stat_acceleration, stat_handling, stat_stability,
        stat_durability, stat_weight, stat_braking, stat_control,
        stat_shift_speed, stat_efficiency, stat_grip, stat_cornering,
        sale_price)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    session.id, listing.part_id, rarity,
    r(listing.stat_speed), r(listing.stat_acceleration), r(listing.stat_handling), r(listing.stat_stability),
    r(listing.stat_durability), r(listing.stat_weight), r(listing.stat_braking), r(listing.stat_control),
    r(listing.stat_shift_speed), r(listing.stat_efficiency), r(listing.stat_grip), r(listing.stat_cornering),
    Math.round(listing.sell_price * priceMult)
  );

  db.prepare(`UPDATE market_part_listings SET quantity = quantity - 1 WHERE id = ?`).run(listing_id);

  db.prepare(
    `INSERT INTO activity_log (user_id, type, message, credits_delta, data) VALUES (?, 'market_buy', ?, ?, ?)`
  ).run(session.id, `Bought ${rarity} ${listing.name}`, -totalCost, JSON.stringify({ part_id: listing.part_id, rarity, cost: totalCost }));

  return NextResponse.json({ success: true, cost: totalCost, rarity });
}
