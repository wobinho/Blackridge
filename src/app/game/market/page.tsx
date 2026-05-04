"use server";

import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";
import { redirect } from "next/navigation";
import MarketClient from "./MarketClient";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythical" | "event";

export interface MarketMaterialSlot {
  slot_index: number;
  material_id: number;
  quantity: number;
  price_per_unit: number;
  refresh_at: number;
  name: string;
  art: string | null;
  rarity: Rarity;
  base_value: number;
  description: string | null;
}

export interface MarketPartListing {
  id: number;
  part_id: number;
  price: number;
  quantity: number;
  expires_at: number;
  name: string;
  category: string;
  tier: number;
  rarity: Rarity;
  stat_speed: number;
  stat_handling: number;
  stat_durability: number;
  stat_acceleration: number;
  sell_price: number;
  art: string | null;
}

export interface MarketCarListing {
  listing_id: number;
  car_id: number;
  price: number;
  listed_at: number;
  seller_name: string;
  seller_brand: string;
  car_name: string;
  speed: number;
  handling: number;
  durability: number;
  acceleration: number;
  total_races: number;
  total_wins: number;
  template_name: string;
  tier: number;
  art: string | null;
  model_code: string;
  color: string;
}

export interface GachaTemplate {
  id: number;
  name: string;
  nationality: string;
  art: string | null;
  rarity: "common" | "rare" | "epic" | "legendary";
  bio: string | null;
}

export interface GachaDriverTemplate extends GachaTemplate {
  base_speed: number;
  base_skill: number;
  base_stamina: number;
  base_aggression: number;
}

export interface GachaEngineerTemplate extends GachaTemplate {
  base_craft_speed: number;
  base_quality_bonus: number;
  base_race_bonus: number;
}

export interface MarketPageData {
  materialSlots: MarketMaterialSlot[];
  partListings: MarketPartListing[];
  carListings: MarketCarListing[];
  driverTemplates: GachaDriverTemplate[];
  engineerTemplates: GachaEngineerTemplate[];
  credits: number;
  xgear: number;
  partNextRefresh: number;
  matNextRefresh: number;
  serverNow: number;
  pity: { driver: number; engineer: number };
}

// 12-slot pool configs (slots 0-3 base, 4-11 unlockable via upgrades)
// Format: [material_id, weight, qty_min, qty_max, price_multiplier]
const SLOT_POOLS: Array<Array<[number, number, number, number, number]>> = [
  // Slot 0 — common bulk
  [[2, 60, 15, 25, 0.9], [4, 40, 12, 20, 0.9]],
  // Slot 1 — common variety
  [[4, 50, 12, 18, 1.0], [5, 50, 10, 18, 1.0]],
  // Slot 2 — common/uncommon
  [[5, 45, 10, 16, 1.0], [1, 35, 6, 10, 1.1], [2, 20, 14, 22, 0.9]],
  // Slot 3 — uncommon
  [[1, 50, 5, 10, 1.2], [6, 50, 3, 7, 1.2]],
  // Slot 4 — uncommon/rare (bonus tier 1)
  [[6, 40, 3, 6, 1.3], [3, 30, 2, 4, 1.5], [7, 30, 1, 3, 1.8]],
  // Slot 5 — rare/epic (bonus tier 1)
  [[3, 45, 2, 4, 1.6], [7, 35, 1, 3, 2.0], [8, 20, 1, 2, 2.5]],
  // Slot 6 — uncommon bulk (bonus tier 2)
  [[1, 55, 6, 12, 1.1], [6, 45, 4, 8, 1.2]],
  // Slot 7 — rare (bonus tier 2)
  [[3, 55, 2, 5, 1.5], [7, 45, 1, 3, 1.9]],
  // Slot 8 — common/uncommon mix (bonus tier 3)
  [[2, 40, 10, 18, 0.95], [5, 35, 8, 14, 1.0], [1, 25, 4, 8, 1.15]],
  // Slot 9 — rare/epic (bonus tier 3)
  [[7, 45, 2, 4, 1.8], [8, 35, 1, 3, 2.2], [3, 20, 2, 4, 1.6]],
  // Slot 10 — uncommon/rare (bonus tier 4)
  [[6, 50, 4, 8, 1.25], [3, 30, 2, 4, 1.6], [7, 20, 1, 2, 2.0]],
  // Slot 11 — epic tier (bonus tier 4)
  [[8, 50, 1, 3, 2.4], [7, 30, 2, 4, 2.0], [3, 20, 2, 3, 1.7]],
];
const MAT_REFRESH = 180;
const PART_REFRESH = 3600;

function pick<T>(pool: T[]): T { return pool[Math.floor(Math.random() * pool.length)]; }
function weightedPick<T extends [number, number, ...unknown[]]>(pool: T[]): T {
  const total = pool.reduce((s, p) => s + p[1], 0);
  let r = Math.random() * total;
  for (const entry of pool) { r -= entry[1]; if (r <= 0) return entry; }
  return pool[pool.length - 1];
}
// Shift weight from first (lowest rarity) entry toward later entries by rarityBoost level
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

export default async function MarketPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  const db = await initDb();
  await seedDatabase(db);

  const now = Math.floor(Date.now() / 1000);

  // --- Fetch user upgrade levels for market ---
  const marketUpgrades = db.prepare(
    `SELECT market_mat_slots, market_mat_rarity FROM workshop_upgrades WHERE user_id = ?`
  ).get(session.id) as { market_mat_slots: number; market_mat_rarity: number } | undefined;
  const matSlotCount = 4 + (marketUpgrades?.market_mat_slots ?? 0) * 2;
  const matRarityBoost = marketUpgrades?.market_mat_rarity ?? 0;

  // --- Material slot refresh (server-side) ---
  const matValues = db.prepare(`SELECT id, base_value FROM materials`).all() as { id: number; base_value: number }[];
  const matValMap = new Map(matValues.map((m) => [m.id, m.base_value]));

  for (let i = 0; i < matSlotCount; i++) {
    const slot = db.prepare(`SELECT slot_index, refresh_at FROM market_material_slots WHERE slot_index = ?`).get(i) as { slot_index: number; refresh_at: number } | undefined;
    if (slot && now < slot.refresh_at) continue;
    const rawPool = SLOT_POOLS[i] ?? SLOT_POOLS[SLOT_POOLS.length - 1];
    const pool = applyRarityBoost(rawPool, matRarityBoost);
    const [matId, , qMin, qMax, priceMult] = weightedPick(pool);
    const qty = qMin + Math.floor(Math.random() * (qMax - qMin + 1));
    const price = Math.round((matValMap.get(matId) ?? 20) * priceMult);
    db.prepare(
      `INSERT INTO market_material_slots (slot_index, material_id, quantity, price_per_unit, refresh_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(slot_index) DO UPDATE SET material_id=excluded.material_id,quantity=excluded.quantity,price_per_unit=excluded.price_per_unit,refresh_at=excluded.refresh_at`
    ).run(i, matId, qty, price, now + MAT_REFRESH);
  }

  // --- Part listing refresh ---
  const oldest = db.prepare(`SELECT MIN(expires_at) as min_exp FROM market_part_listings`).get() as { min_exp: number | null };
  if (oldest.min_exp === null || now >= oldest.min_exp) {
    db.prepare(`DELETE FROM market_part_listings`).run();
    const allParts = db.prepare(`SELECT id, sell_price FROM part_templates`).all() as { id: number; sell_price: number }[];
    const picks = [...allParts].sort(() => Math.random() - 0.5).slice(0, 8);
    for (const p of picks) {
      const qty = 1 + Math.floor(Math.random() * 3);
      const price = Math.round(p.sell_price * 1.3 * (0.9 + Math.random() * 0.3));
      db.prepare(`INSERT INTO market_part_listings (part_id, price, quantity, listed_at, expires_at) VALUES (?, ?, ?, ?, ?)`)
        .run(p.id, price, qty, now, now + PART_REFRESH);
    }
  }

  // --- Fetch all market data ---
  const materialSlots = db.prepare(`
    SELECT mms.slot_index, mms.material_id, mms.quantity, mms.price_per_unit, mms.refresh_at,
           m.name, m.art, m.rarity, m.base_value, m.description
    FROM market_material_slots mms
    JOIN materials m ON m.id = mms.material_id
    WHERE mms.slot_index < ?
    ORDER BY mms.slot_index
  `).all(matSlotCount) as MarketMaterialSlot[];

  const partListings = db.prepare(`
    SELECT mpl.id, mpl.part_id, mpl.price, mpl.quantity, mpl.expires_at,
           pt.name, pt.category, pt.tier, pt.rarity, pt.stat_speed, pt.stat_handling,
           pt.stat_durability, pt.stat_acceleration, pt.sell_price, pt.art
    FROM market_part_listings mpl
    JOIN part_templates pt ON pt.id = mpl.part_id
    ORDER BY pt.category, pt.tier
  `).all() as MarketPartListing[];

  const carListings = db.prepare(`
    SELECT ml.id as listing_id, ml.item_id as car_id, ml.price, ml.listed_at,
           u.username as seller_name, u.brand_name as seller_brand,
           c.name as car_name, c.speed, c.handling, c.durability, c.acceleration,
           c.total_races, c.total_wins, c.color,
           ct.name as template_name, ct.tier, ct.art, ct.model_code
    FROM market_listings ml
    JOIN users u ON u.id = ml.seller_id
    JOIN cars c ON c.id = ml.item_id
    JOIN car_templates ct ON ct.id = c.template_id
    WHERE ml.listing_type = 'car' AND ml.status = 'active' AND ml.seller_id != ?
    ORDER BY ml.listed_at DESC LIMIT 50
  `).all(session.id) as MarketCarListing[];

  const driverTemplates = db.prepare(
    `SELECT id, name, nationality, art, rarity, bio, base_speed, base_skill, base_stamina, base_aggression FROM driver_templates ORDER BY rarity DESC, id`
  ).all() as GachaDriverTemplate[];

  const engineerTemplates = db.prepare(
    `SELECT id, name, nationality, art, rarity, bio, base_craft_speed, base_quality_bonus, base_race_bonus FROM engineer_templates ORDER BY rarity DESC, id`
  ).all() as GachaEngineerTemplate[];

  const user = db.prepare(`SELECT credits, xgear FROM users WHERE id = ?`).get(session.id) as { credits: number; xgear: number };

  // Pity counts
  const driverPity = db.prepare(`SELECT pity_count FROM gacha_pity WHERE user_id = ? AND banner = 'driver'`).get(session.id) as { pity_count: number } | undefined;
  const engineerPity = db.prepare(`SELECT pity_count FROM gacha_pity WHERE user_id = ? AND banner = 'engineer'`).get(session.id) as { pity_count: number } | undefined;

  const matNextRefresh = materialSlots[0]?.refresh_at ?? now + MAT_REFRESH;
  const partNextRefresh = partListings[0]?.expires_at ?? now + PART_REFRESH;

  return (
    <MarketClient
      data={{
        materialSlots,
        partListings,
        carListings,
        driverTemplates,
        engineerTemplates,
        credits: user.credits,
        xgear: user.xgear,
        partNextRefresh,
        matNextRefresh,
        serverNow: now,
        pity: { driver: driverPity?.pity_count ?? 0, engineer: engineerPity?.pity_count ?? 0 },
      }}
    />
  );
}
