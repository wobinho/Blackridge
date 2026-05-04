"use server";

import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";
import { redirect } from "next/navigation";
import WorkshopClient from "./WorkshopClient";

export interface MaterialStock {
  id: number;
  name: string;
  art: string | null;
  base_value: number;
  quantity: number;
}

export interface PartTemplate {
  id: number;
  name: string;
  category: string;
  art: string | null;
  stat_speed: number;
  stat_acceleration: number;
  stat_handling: number;
  stat_stability: number;
  stat_durability: number;
  stat_weight: number;
  stat_braking: number;
  stat_control: number;
  stat_shift_speed: number;
  stat_efficiency: number;
  stat_grip: number;
  stat_cornering: number;
  craft_time: number;
  sell_price: number;
  recipe: string; // JSON
}

export interface CraftSlot {
  queue_id: number | null;
  slot_index: number;
  status: "idle" | "crafting" | "completed";
  part_template_id: number | null;
  part_name: string | null;
  part_category: string | null;
  engineer_id: number | null;
  engineer_name: string | null;
  started_at: number | null;
  completes_at: number | null;
}

export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythical";

export interface InventoryPart {
  id: number;
  part_template_id: number;
  name: string;
  category: string;
  art: string | null;
  rarity: Rarity;
  stat_speed: number;
  stat_acceleration: number;
  stat_handling: number;
  stat_stability: number;
  stat_durability: number;
  stat_weight: number;
  stat_braking: number;
  stat_control: number;
  stat_shift_speed: number;
  stat_efficiency: number;
  stat_grip: number;
  stat_cornering: number;
  sale_price: number | null;
  status: string;
  crafted_at: number;
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
    `SELECT m.id, m.name, m.art, m.base_value,
            COALESCE(im.quantity, 0) as quantity
     FROM materials m
     LEFT JOIN inventory_materials im ON im.material_id = m.id AND im.user_id = ?
     ORDER BY m.base_value, m.id`
  ).all(session.id) as MaterialStock[];

  const partTemplates = db.prepare(
    `SELECT id, name, category, art,
            stat_speed, stat_acceleration, stat_handling, stat_stability,
            stat_durability, stat_weight, stat_braking, stat_control,
            stat_shift_speed, stat_efficiency, stat_grip, stat_cornering,
            craft_time, sell_price, recipe
     FROM part_templates ORDER BY category`
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
    `SELECT cq.id as queue_id, cq.slot_index, cq.status, cq.part_template_id,
            pt.name as part_name, pt.category as part_category,
            cq.engineer_id, e_tmpl.name as engineer_name,
            cq.started_at, cq.completes_at
     FROM crafting_queue cq
     JOIN part_templates pt ON pt.id = cq.part_template_id
     LEFT JOIN engineers eng ON eng.id = cq.engineer_id
     LEFT JOIN engineer_templates e_tmpl ON e_tmpl.id = eng.template_id
     WHERE cq.user_id = ? AND cq.status IN ('crafting', 'completed')
     ORDER BY cq.slot_index`
  ).all(session.id) as {
    queue_id: number;
    slot_index: number;
    status: string;
    part_template_id: number;
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
      return { queue_id: null, slot_index: i, status: "idle", part_template_id: null, part_name: null, part_category: null, engineer_id: null, engineer_name: null, started_at: null, completes_at: null };
    }
    return {
      queue_id: job.queue_id,
      slot_index: i,
      status: job.status as "crafting" | "completed",
      part_template_id: job.part_template_id,
      part_name: job.part_name,
      part_category: job.part_category,
      engineer_id: job.engineer_id,
      engineer_name: job.engineer_name,
      started_at: job.started_at,
      completes_at: job.completes_at,
    };
  });

  const inventory = db.prepare(
    `SELECT ip.id, ip.part_template_id, pt.name, pt.category, pt.art,
            ip.rarity,
            ip.stat_speed, ip.stat_acceleration, ip.stat_handling, ip.stat_stability,
            ip.stat_durability, ip.stat_weight, ip.stat_braking, ip.stat_control,
            ip.stat_shift_speed, ip.stat_efficiency, ip.stat_grip, ip.stat_cornering,
            ip.sale_price, ip.status, ip.crafted_at
     FROM inventory_parts ip
     JOIN part_templates pt ON pt.id = ip.part_template_id
     WHERE ip.user_id = ? AND ip.status = 'inventory'
     ORDER BY ip.rarity DESC, pt.category`
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
