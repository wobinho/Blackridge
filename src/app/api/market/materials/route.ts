import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";
import { getActualValue } from "@/lib/upgrades";

// Material IDs match seed order: 1=Steel,2=Aluminum,3=Carbon,4=Titanium,5=Polymer,6=Hardware,7=Electronics,8=Compounds,9=Fluids,10=Trims
// 12-slot pool configs (slots 0-3 base, 4-11 unlockable via upgrades)
// Format: [material_id, weight, qty_min, qty_max, price_multiplier]
const SLOT_POOLS: Array<Array<[number, number, number, number, number]>> = [
  // Slot 0 — cheap bulk (Steel, Hardware)
  [[1, 60, 15, 25, 0.9], [6, 40, 12, 20, 0.9]],
  // Slot 1 — common variety (Aluminum, Polymer)
  [[2, 50, 12, 18, 1.0], [5, 50, 10, 18, 1.0]],
  // Slot 2 — common mix (Steel, Fluids, Trims)
  [[1, 40, 10, 18, 0.9], [9, 35, 8, 14, 1.0], [10, 25, 6, 10, 1.1]],
  // Slot 3 — mid-tier (Compounds, Electronics)
  [[8, 50, 5, 10, 1.2], [7, 50, 3, 7, 1.3]],
  // Slot 4 — mid/rare (Carbon, Titanium)
  [[3, 55, 3, 6, 1.4], [4, 45, 1, 3, 1.8]],
  // Slot 5 — rare (Titanium, Electronics)
  [[4, 50, 2, 4, 1.7], [7, 30, 1, 3, 1.9], [3, 20, 2, 4, 1.5]],
  // Slot 6 — common bulk bonus (Aluminum, Compounds)
  [[2, 55, 8, 14, 1.0], [8, 45, 5, 10, 1.1]],
  // Slot 7 — mid bonus (Carbon, Hardware)
  [[3, 55, 3, 6, 1.3], [6, 45, 8, 14, 0.9]],
  // Slot 8 — mixed bonus (Steel, Polymer, Fluids)
  [[1, 40, 10, 18, 0.9], [5, 35, 8, 14, 1.0], [9, 25, 5, 10, 1.0]],
  // Slot 9 — rare bonus (Titanium, Electronics, Carbon)
  [[4, 45, 2, 4, 1.7], [7, 35, 1, 3, 1.9], [3, 20, 2, 4, 1.5]],
  // Slot 10 — mid bonus (Compounds, Carbon)
  [[8, 50, 4, 8, 1.2], [3, 30, 2, 5, 1.4], [7, 20, 1, 3, 1.8]],
  // Slot 11 — premium bonus (Titanium, Electronics, Carbon)
  [[4, 50, 2, 4, 1.8], [7, 30, 2, 4, 1.9], [3, 20, 3, 6, 1.5]],
];

const REFRESH_INTERVAL = 180; // 3 minutes

function pickFromPool(pool: Array<[number, number, number, number, number]>): [number, number, number, number, number] {
  const total = pool.reduce((s, p) => s + p[1], 0);
  let r = Math.random() * total;
  for (const entry of pool) {
    r -= entry[1];
    if (r <= 0) return entry;
  }
  return pool[pool.length - 1];
}

function applyRarityBoost(
  pool: Array<[number, number, number, number, number]>,
  boost: number
): Array<[number, number, number, number, number]> {
  if (boost === 0 || pool.length <= 1) return pool;
  const shift = boost * 10;
  return pool.map((entry, idx) => {
    const delta = idx === 0 ? -Math.min(shift * (pool.length - 1), entry[1] * 0.8) : shift;
    return [entry[0], Math.max(1, entry[1] + delta), entry[2], entry[3], entry[4]] as [number, number, number, number, number];
  });
}

function refreshSlots(
  db: ReturnType<typeof import("@/lib/db").getDb>,
  now: number,
  slotCount: number,
  rarityBoost: number
) {
  const materials = db.prepare(`SELECT id, base_value FROM materials`).all() as { id: number; base_value: number }[];
  const matValueMap = new Map(materials.map((m) => [m.id, m.base_value]));

  for (let i = 0; i < slotCount; i++) {
    const slot = db.prepare(
      `SELECT slot_index, refresh_at FROM market_material_slots WHERE slot_index = ?`
    ).get(i) as { slot_index: number; refresh_at: number } | undefined;

    if (slot && now < slot.refresh_at) continue; // still fresh

    const rawPool = SLOT_POOLS[i] ?? SLOT_POOLS[SLOT_POOLS.length - 1];
    const pool = applyRarityBoost(rawPool, rarityBoost);
    const [matId, , qMin, qMax, priceMult] = pickFromPool(pool);
    const qty = qMin + Math.floor(Math.random() * (qMax - qMin + 1));
    const baseVal = matValueMap.get(matId) ?? 20;
    const price = Math.round(baseVal * priceMult);

    db.prepare(
      `INSERT INTO market_material_slots (slot_index, material_id, quantity, price_per_unit, refresh_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(slot_index) DO UPDATE SET
         material_id = excluded.material_id,
         quantity = excluded.quantity,
         price_per_unit = excluded.price_per_unit,
         refresh_at = excluded.refresh_at`
    ).run(i, matId, qty, price, now + REFRESH_INTERVAL);
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await initDb();
  await seedDatabase(db);

  const marketUpgrades = db.prepare(
    `SELECT market_mat_slots, market_mat_rarity FROM workshop_upgrades WHERE user_id = ?`
  ).get(session.id) as { market_mat_slots: number; market_mat_rarity: number } | undefined;
  const slotCount = 4 + (marketUpgrades?.market_mat_slots ?? 0) * 2;
  const rarityBoost = marketUpgrades?.market_mat_rarity ?? 0;

  const now = Math.floor(Date.now() / 1000);
  refreshSlots(db, now, slotCount, rarityBoost);

  const slots = db.prepare(`
    SELECT mms.slot_index, mms.material_id, mms.quantity, mms.price_per_unit, mms.refresh_at,
           m.name, m.art, m.base_value, m.description
    FROM market_material_slots mms
    JOIN materials m ON m.id = mms.material_id
    WHERE mms.slot_index < ?
    ORDER BY mms.slot_index
  `).all(slotCount) as {
    slot_index: number;
    material_id: number;
    quantity: number;
    price_per_unit: number;
    refresh_at: number;
    name: string;
    art: string | null;
    base_value: number;
    description: string;
  }[];

  const user = db.prepare(`SELECT credits, xgear FROM users WHERE id = ?`).get(session.id) as { credits: number; xgear: number };

  return NextResponse.json({ slots, credits: user.credits, xgear: user.xgear, now });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { slot_index, quantity } = body as { slot_index: number; quantity: number };

  if (typeof slot_index !== "number" || typeof quantity !== "number" || quantity < 1) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const db = await initDb();
  await seedDatabase(db);

  const marketUpgrades = db.prepare(
    `SELECT market_mat_slots, market_mat_rarity FROM workshop_upgrades WHERE user_id = ?`
  ).get(session.id) as { market_mat_slots: number; market_mat_rarity: number } | undefined;
  const slotCount = 4 + (marketUpgrades?.market_mat_slots ?? 0) * 2;
  const rarityBoost = marketUpgrades?.market_mat_rarity ?? 0;

  const now = Math.floor(Date.now() / 1000);
  refreshSlots(db, now, slotCount, rarityBoost);

  if (slot_index >= slotCount) {
    return NextResponse.json({ error: "Slot not available" }, { status: 400 });
  }

  const slot = db.prepare(
    `SELECT mms.slot_index, mms.material_id, mms.quantity, mms.price_per_unit
     FROM market_material_slots mms WHERE mms.slot_index = ?`
  ).get(slot_index) as { slot_index: number; material_id: number; quantity: number; price_per_unit: number } | undefined;

  if (!slot) return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  if (quantity > slot.quantity) return NextResponse.json({ error: "Not enough stock", available: slot.quantity }, { status: 400 });

  const totalCost = slot.price_per_unit * quantity;
  const user = db.prepare(`SELECT credits FROM users WHERE id = ?`).get(session.id) as { credits: number };

  if (user.credits < totalCost) {
    return NextResponse.json({ error: "Insufficient credits", required: totalCost, have: user.credits }, { status: 400 });
  }

  // Check materials inventory cap
  const allUpgrades = db.prepare(
    `SELECT inventory_mats_size FROM workshop_upgrades WHERE user_id = ?`
  ).get(session.id) as { inventory_mats_size: number } | undefined;
  const matsSizeLevel = allUpgrades?.inventory_mats_size ?? 0;
  const matsCap = getActualValue("inventory_mats_size", matsSizeLevel);
  const currentMatCount = (db.prepare(
    `SELECT COALESCE(SUM(quantity), 0) as total FROM inventory_materials WHERE user_id = ?`
  ).get(session.id) as { total: number }).total;

  if (currentMatCount + quantity > matsCap) {
    return NextResponse.json({ error: "Materials inventory is full", cap: matsCap, current: currentMatCount }, { status: 400 });
  }

  db.prepare(`UPDATE users SET credits = credits - ? WHERE id = ?`).run(totalCost, session.id);
  db.prepare(
    `INSERT INTO inventory_materials (user_id, material_id, quantity) VALUES (?, ?, ?)
     ON CONFLICT(user_id, material_id) DO UPDATE SET quantity = quantity + excluded.quantity`
  ).run(session.id, slot.material_id, quantity);
  db.prepare(
    `UPDATE market_material_slots SET quantity = quantity - ? WHERE slot_index = ?`
  ).run(quantity, slot_index);

  const matName = (db.prepare(`SELECT name FROM materials WHERE id = ?`).get(slot.material_id) as { name: string } | undefined)?.name ?? "Material";
  db.prepare(
    `INSERT INTO activity_log (user_id, type, message, credits_delta, data) VALUES (?, 'market_buy', ?, ?, ?)`
  ).run(session.id, `Bought ${quantity}x ${matName}`, -totalCost, JSON.stringify({ material_id: slot.material_id, quantity, cost: totalCost }));

  return NextResponse.json({ success: true, cost: totalCost });
}
