"use server";

import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";
import { redirect } from "next/navigation";
import WorkshopClient from "./WorkshopClient";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythical" | "event";

export interface MaterialStock {
  id: number;
  name: string;
  art: string | null;
  rarity: Rarity;
  base_value: number;
  quantity: number;
}

export interface PartTemplate {
  id: number;
  name: string;
  category: string;
  tier: number;
  rarity: Rarity;
  art: string | null;
  stat_speed: number;
  stat_handling: number;
  stat_durability: number;
  stat_acceleration: number;
  craft_time: number;
  sell_price: number;
  base_materials: string; // JSON
}

export interface CraftSlot {
  queue_id: number | null;
  slot_index: number;
  status: "idle" | "crafting" | "completed";
  part_id: number | null;
  part_name: string | null;
  part_category: string | null;
  engineer_id: number | null;
  engineer_name: string | null;
  started_at: number | null;
  completes_at: number | null;
}

export interface InventoryPart {
  id: number;
  part_id: number;
  name: string;
  category: string;
  tier: number;
  rarity: Rarity;
  art: string | null;
  stat_speed: number;
  stat_handling: number;
  stat_durability: number;
  stat_acceleration: number;
  sell_price: number;
  quantity: number;
  quality: number;
}

export interface EngineerFull {
  id: number;
  template_id: number;
  nickname: string | null;
  level: number;
  xp: number;
  craft_speed: number;
  quality_bonus: number;
  race_bonus: number;
  status: "idle" | "crafting" | "racing";
  created_at: number;
  name: string;
  nationality: string;
  art: string | null;
  rarity: "common" | "rare" | "epic" | "legendary";
  bio: string | null;
}

export interface WorkshopUpgrades {
  develop_slots: number;
  develop_speed: number;
  inventory_size: number;
  engineer_cap: number;
  driver_cap: number;
  garage_cap: number;
  market_mat_slots: number;
  market_mat_rarity: number;
}

export interface WorkshopPageData {
  materials: MaterialStock[];
  partTemplates: PartTemplate[];
  craftSlots: CraftSlot[];
  inventory: InventoryPart[];
  engineers: EngineerFull[];
  upgrades: WorkshopUpgrades;
  credits: number;
}

export default async function WorkshopPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  const db = await initDb();
  await seedDatabase(db);

  const materials = db.prepare(
    `SELECT m.id, m.name, m.art, m.rarity, m.base_value,
            COALESCE(im.quantity, 0) as quantity
     FROM materials m
     LEFT JOIN inventory_materials im ON im.material_id = m.id AND im.user_id = ?
     ORDER BY m.base_value, m.id`
  ).all(session.id) as MaterialStock[];

  const partTemplates = db.prepare(
    `SELECT id, name, category, tier, rarity, art, stat_speed, stat_handling, stat_durability,
            stat_acceleration, craft_time, sell_price, base_materials
     FROM part_templates ORDER BY category, tier, rarity`
  ).all() as PartTemplate[];

  const upgradesRow = db.prepare(
    `SELECT develop_slots, develop_speed, inventory_size, engineer_cap, driver_cap, garage_cap, market_mat_slots, market_mat_rarity
     FROM workshop_upgrades WHERE user_id = ?`
  ).get(session.id) as WorkshopUpgrades | undefined;

  const upgrades: WorkshopUpgrades = upgradesRow ?? {
    develop_slots: 2, develop_speed: 1, inventory_size: 20,
    engineer_cap: 3, driver_cap: 5, garage_cap: 10,
    market_mat_slots: 0, market_mat_rarity: 0,
  };

  const activeJobs = db.prepare(
    `SELECT cq.id as queue_id, cq.slot_index, cq.status, cq.part_id,
            pt.name as part_name, pt.category as part_category,
            cq.engineer_id, e_tmpl.name as engineer_name,
            cq.started_at, cq.completes_at
     FROM crafting_queue cq
     JOIN part_templates pt ON pt.id = cq.part_id
     LEFT JOIN engineers eng ON eng.id = cq.engineer_id
     LEFT JOIN engineer_templates e_tmpl ON e_tmpl.id = eng.template_id
     WHERE cq.user_id = ? AND cq.status IN ('crafting', 'completed')
     ORDER BY cq.slot_index`
  ).all(session.id) as {
    queue_id: number;
    slot_index: number;
    status: string;
    part_id: number;
    part_name: string;
    part_category: string;
    engineer_id: number | null;
    engineer_name: string | null;
    started_at: number;
    completes_at: number;
  }[];

  const now = Math.floor(Date.now() / 1000);
  for (const job of activeJobs) {
    if (job.status === "crafting" && now >= job.completes_at) {
      db.prepare(`UPDATE crafting_queue SET status = 'completed' WHERE id = ?`).run(job.queue_id);
      job.status = "completed";
    }
  }

  const jobsBySlot = new Map(activeJobs.map((j) => [j.slot_index, j]));

  const craftSlots: CraftSlot[] = Array.from({ length: upgrades.develop_slots }, (_, i) => {
    const job = jobsBySlot.get(i);
    if (!job) {
      return { queue_id: null, slot_index: i, status: "idle", part_id: null, part_name: null, part_category: null, engineer_id: null, engineer_name: null, started_at: null, completes_at: null };
    }
    return {
      queue_id: job.queue_id,
      slot_index: i,
      status: job.status as "crafting" | "completed",
      part_id: job.part_id,
      part_name: job.part_name,
      part_category: job.part_category,
      engineer_id: job.engineer_id,
      engineer_name: job.engineer_name,
      started_at: job.started_at,
      completes_at: job.completes_at,
    };
  });

  const inventory = db.prepare(
    `SELECT ip.id, ip.part_id, pt.name, pt.category, pt.tier, pt.rarity, pt.art,
            pt.stat_speed, pt.stat_handling, pt.stat_durability, pt.stat_acceleration,
            pt.sell_price, ip.quantity, ip.quality
     FROM inventory_parts ip
     JOIN part_templates pt ON pt.id = ip.part_id
     WHERE ip.user_id = ? AND ip.for_sale = 0
     ORDER BY pt.category, pt.tier, pt.rarity`
  ).all(session.id) as InventoryPart[];

  const engineers = db.prepare(
    `SELECT e.id, e.template_id, e.nickname, e.level, e.xp,
            e.craft_speed, e.quality_bonus, e.race_bonus, e.status, e.created_at,
            t.name, t.nationality, t.art, t.rarity, t.bio
     FROM engineers e
     JOIN engineer_templates t ON t.id = e.template_id
     WHERE e.user_id = ?
     ORDER BY t.rarity DESC, e.level DESC`
  ).all(session.id) as EngineerFull[];

  const user = db.prepare(`SELECT credits FROM users WHERE id = ?`).get(session.id) as { credits: number };

  return (
    <WorkshopClient
      data={{
        materials,
        partTemplates,
        craftSlots,
        inventory,
        engineers,
        upgrades,
        credits: user.credits,
      }}
    />
  );
}
