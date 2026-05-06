import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";

const SHARD_MARKET_REFRESH = 86400; // 24 hours in seconds
const SLOTS_PER_TYPE = 4;

const SHARD_PRICES: Record<string, number> = {
  common: 25,
  rare: 50,
  epic: 100,
  legendary: 250,
};

type SlotType = "driver" | "engineer";

function refreshShardMarket(db: ReturnType<typeof Object.create>, now: number) {
  for (const slotType of ["driver", "engineer"] as SlotType[]) {
    const table = slotType === "driver" ? "driver_templates" : "engineer_templates";

    // Check if any slot needs refresh
    const firstSlot = db.prepare(
      `SELECT refresh_at FROM shard_market_slots WHERE slot_type = ? AND slot_index = 0`
    ).get(slotType) as { refresh_at: number } | undefined;

    if (firstSlot && now < firstSlot.refresh_at) continue;

    // Pull templates by rarity (exclude mythical/event)
    const templates = db.prepare(
      `SELECT id, rarity FROM ${table} WHERE rarity IN ('common','rare','epic','legendary') ORDER BY RANDOM()`
    ).all() as { id: number; rarity: string }[];

    if (templates.length === 0) continue;

    // Pick 4 unique templates, weighted toward common/rare
    const picked: typeof templates = [];
    const byRarity: Record<string, typeof templates> = { common: [], rare: [], epic: [], legendary: [] };
    for (const t of templates) {
      if (byRarity[t.rarity]) byRarity[t.rarity].push(t);
    }

    // Fill slots: 2 common/rare, 1 epic, 1 legendary (fall back if not enough)
    const allShuffled = [...(byRarity.common), ...(byRarity.rare), ...(byRarity.epic), ...(byRarity.legendary)];
    const used = new Set<number>();
    for (const t of allShuffled) {
      if (picked.length >= SLOTS_PER_TYPE) break;
      if (!used.has(t.id)) {
        picked.push(t);
        used.add(t.id);
      }
    }

    for (let i = 0; i < SLOTS_PER_TYPE; i++) {
      const t = picked[i];
      if (!t) continue;
      db.prepare(
        `INSERT INTO shard_market_slots (slot_type, slot_index, template_id, rarity, price_shards, refresh_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(slot_type, slot_index) DO UPDATE SET
           template_id = excluded.template_id,
           rarity = excluded.rarity,
           price_shards = excluded.price_shards,
           refresh_at = excluded.refresh_at`
      ).run(slotType, i, t.id, t.rarity, SHARD_PRICES[t.rarity] ?? 25, now + SHARD_MARKET_REFRESH);
    }
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await initDb();
  await seedDatabase(db);

  const now = Math.floor(Date.now() / 1000);
  refreshShardMarket(db, now);

  const user = db.prepare(`SELECT recruit_shards FROM users WHERE id = ?`).get(session.id) as { recruit_shards: number } | undefined;

  const driverSlots = db.prepare(`
    SELECT sms.slot_type, sms.slot_index, sms.template_id, sms.rarity, sms.price_shards, sms.refresh_at,
           dt.name, dt.nationality, dt.art, dt.bio,
           dt.base_speed, dt.base_skill, dt.base_stamina, dt.base_aggression,
           CASE WHEN d.id IS NOT NULL THEN 1 ELSE 0 END as already_owned
    FROM shard_market_slots sms
    JOIN driver_templates dt ON dt.id = sms.template_id
    LEFT JOIN drivers d ON d.user_id = ? AND d.template_id = sms.template_id
    WHERE sms.slot_type = 'driver'
    ORDER BY sms.slot_index
  `).all(session.id);

  const engineerSlots = db.prepare(`
    SELECT sms.slot_type, sms.slot_index, sms.template_id, sms.rarity, sms.price_shards, sms.refresh_at,
           et.name, et.nationality, et.art, et.bio,
           et.base_craft_speed, et.base_quality_bonus, et.base_race_bonus,
           CASE WHEN e.id IS NOT NULL THEN 1 ELSE 0 END as already_owned
    FROM shard_market_slots sms
    JOIN engineer_templates et ON et.id = sms.template_id
    LEFT JOIN engineers e ON e.user_id = ? AND e.template_id = sms.template_id
    WHERE sms.slot_type = 'engineer'
    ORDER BY sms.slot_index
  `).all(session.id);

  const refreshAt = (driverSlots[0] as { refresh_at: number } | undefined)?.refresh_at ?? now + SHARD_MARKET_REFRESH;

  return NextResponse.json({
    recruit_shards: user?.recruit_shards ?? 0,
    driver_slots: driverSlots,
    engineer_slots: engineerSlots,
    refresh_at: refreshAt,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { slot_type, slot_index } = body as { slot_type: "driver" | "engineer"; slot_index: number };

  if ((slot_type !== "driver" && slot_type !== "engineer") || typeof slot_index !== "number") {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const db = await initDb();
  await seedDatabase(db);

  // Ensure workshop_upgrades row exists
  db.prepare("INSERT OR IGNORE INTO workshop_upgrades (user_id) VALUES (?)").run(session.id);

  const slot = db.prepare(
    `SELECT * FROM shard_market_slots WHERE slot_type = ? AND slot_index = ?`
  ).get(slot_type, slot_index) as { template_id: number; rarity: string; price_shards: number } | undefined;

  if (!slot) return NextResponse.json({ error: "Slot not found" }, { status: 404 });

  const user = db.prepare(`SELECT recruit_shards FROM users WHERE id = ?`).get(session.id) as { recruit_shards: number } | undefined;
  if (!user || user.recruit_shards < slot.price_shards) {
    return NextResponse.json({ error: "Insufficient recruit shards", required: slot.price_shards, have: user?.recruit_shards ?? 0 }, { status: 400 });
  }

  const instanceTable = slot_type === "driver" ? "drivers" : "engineers";
  const templateTable = slot_type === "driver" ? "driver_templates" : "engineer_templates";
  const capField = slot_type === "driver" ? "driver_cap" : "engineer_cap";

  // Check cap
  const upgrades = db.prepare(`SELECT ${capField} FROM workshop_upgrades WHERE user_id = ?`).get(session.id) as Record<string, number> | undefined;
  const capLevel = upgrades?.[capField] ?? 0;
  const cap = 4 + capLevel * 2;
  const currentCount = (db.prepare(`SELECT COUNT(*) as cnt FROM ${instanceTable} WHERE user_id = ?`).get(session.id) as { cnt: number }).cnt;

  if (currentCount >= cap) {
    return NextResponse.json({ error: `${slot_type === "driver" ? "Driver" : "Engineer"} roster is full`, cap, current: currentCount }, { status: 400 });
  }

  // Check already owned
  const existing = db.prepare(`SELECT id FROM ${instanceTable} WHERE user_id = ? AND template_id = ?`).get(session.id, slot.template_id);
  if (existing) return NextResponse.json({ error: "Already recruited" }, { status: 409 });

  const template = db.prepare(`SELECT name FROM ${templateTable} WHERE id = ?`).get(slot.template_id) as { name: string } | undefined;

  // Deduct shards
  db.prepare(`UPDATE users SET recruit_shards = recruit_shards - ? WHERE id = ?`).run(slot.price_shards, session.id);

  // Recruit
  if (slot_type === "driver") {
    db.prepare(
      `INSERT INTO drivers (user_id, template_id, speed, skill, stamina, aggression)
       SELECT ?, id, base_speed, base_skill, base_stamina, base_aggression FROM driver_templates WHERE id = ?`
    ).run(session.id, slot.template_id);
  } else {
    db.prepare(
      `INSERT INTO engineers (user_id, template_id, craft_speed, quality_bonus, race_bonus)
       SELECT ?, id, base_craft_speed, base_quality_bonus, base_race_bonus FROM engineer_templates WHERE id = ?`
    ).run(session.id, slot.template_id);
  }

  db.prepare(
    `INSERT INTO activity_log (user_id, type, message, data) VALUES (?, 'shard_recruit', ?, ?)`
  ).run(
    session.id,
    `Recruited ${template?.name ?? "Unknown"} via shards`,
    JSON.stringify({ slot_type, slot_index, template_id: slot.template_id, cost: slot.price_shards })
  );

  return NextResponse.json({ success: true, recruited: template?.name ?? "Unknown", cost: slot.price_shards });
}
