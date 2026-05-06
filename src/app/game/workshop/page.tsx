"use server";

import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";
import { getActualValue } from "@/lib/upgrades";
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
  slot_index: number;
  status: "idle" | "crafting" | "completed";
  // part build fields
  queue_id: number | null;
  part_template_id: number | null;
  part_name: string | null;
  part_category: string | null;
  engineer_id: number | null;
  engineer_name: string | null;
  started_at: number | null;
  completes_at: number | null;
  // car build fields (non-null when type === 'car')
  type: "idle" | "part" | "car";
  build_id: number | null;
  car_name: string | null;
  model_code: string | null;
  archetype: string | null;
  car_started_at: number | null;
  car_completes_at: number | null;
  car_engineer_name_1: string | null;
  car_engineer_name_2: string | null;
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
  inventory_mats_size: number;
  engineer_cap: number;
  driver_cap: number;
  garage_cap: number;
  market_mat_slots: number;
}

export interface CarBlueprint {
  car_template_id: number;
  name: string;
  model_code: string;
  archetype: string;
  description: string | null;
  base_speed: number;
  base_acceleration: number;
  base_handling: number;
  base_stability: number;
  base_durability: number;
  base_weight: number;
  base_braking: number;
  base_control: number;
  base_shift_speed: number;
  base_efficiency: number;
  base_grip: number;
  base_cornering: number;
  quantity: number;
}


export interface WorkshopPageData {
  materials: MaterialStock[];
  partTemplates: PartTemplate[];
  craftSlots: CraftSlot[];
  inventory: InventoryPart[];
  engineers: EngineerFull[];
  upgrades: WorkshopUpgrades;
  credits: number;
  xgear: number;
  blueprints: CarBlueprint[];
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
    `SELECT develop_slots, develop_speed, inventory_size, inventory_mats_size, engineer_cap, driver_cap, garage_cap, market_mat_slots
     FROM workshop_upgrades WHERE user_id = ?`
  ).get(session.id) as WorkshopUpgrades | undefined;

  const upgrades: WorkshopUpgrades = upgradesRow ?? {
    develop_slots: 0, develop_speed: 0, inventory_size: 0, inventory_mats_size: 0,
    engineer_cap: 0, driver_cap: 0, garage_cap: 0,
    market_mat_slots: 0,
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

  const rawCarBuilds = db.prepare(
    `SELECT ccq.id as build_id, ct.name as car_name, ct.model_code, ct.archetype,
            ccq.status, ccq.started_at, ccq.completes_at, ccq.slot_index,
            et1.name as engineer_name_1, et2.name as engineer_name_2
     FROM car_crafting_queue ccq
     JOIN car_templates ct ON ct.id = ccq.car_template_id
     LEFT JOIN engineers e1 ON e1.id = ccq.engineer_id_1_opt
     LEFT JOIN engineer_templates et1 ON et1.id = e1.template_id
     LEFT JOIN engineers e2 ON e2.id = ccq.engineer_id_2_opt
     LEFT JOIN engineer_templates et2 ON et2.id = e2.template_id
     WHERE ccq.user_id = ? AND ccq.status IN ('crafting', 'completed')
     ORDER BY ccq.started_at`
  ).all(session.id) as {
    build_id: number; car_name: string; model_code: string; archetype: string;
    status: string; started_at: number; completes_at: number; slot_index: number;
    engineer_name_1: string | null; engineer_name_2: string | null;
  }[];

  for (const build of rawCarBuilds) {
    if (build.status === "crafting" && now >= build.completes_at) {
      db.prepare(`UPDATE car_crafting_queue SET status = 'completed' WHERE id = ?`).run(build.build_id);
      build.status = "completed";
    }
  }

  const jobsBySlot = new Map(activeJobs.map((j) => [j.slot_index, j]));
  const carBuildsBySlot = new Map(rawCarBuilds.map((b) => [b.slot_index, b]));

  const maxSlots = getActualValue("develop_slots", upgrades.develop_slots);
  const craftSlots: CraftSlot[] = Array.from({ length: maxSlots }, (_, i) => {
    const job = jobsBySlot.get(i);
    const carBuild = carBuildsBySlot.get(i);

    if (carBuild) {
      return {
        slot_index: i,
        type: "car",
        status: carBuild.status as "crafting" | "completed",
        // part fields empty
        queue_id: null, part_template_id: null, part_name: null, part_category: null,
        engineer_id: null, engineer_name: null, started_at: null, completes_at: null,
        // car fields
        build_id: carBuild.build_id,
        car_name: carBuild.car_name,
        model_code: carBuild.model_code,
        archetype: carBuild.archetype,
        car_started_at: carBuild.started_at,
        car_completes_at: carBuild.completes_at,
        car_engineer_name_1: carBuild.engineer_name_1,
        car_engineer_name_2: carBuild.engineer_name_2,
      };
    }

    if (job) {
      return {
        slot_index: i,
        type: "part",
        status: job.status as "crafting" | "completed",
        queue_id: job.queue_id,
        part_template_id: job.part_template_id,
        part_name: job.part_name,
        part_category: job.part_category,
        engineer_id: job.engineer_id,
        engineer_name: job.engineer_name,
        started_at: job.started_at,
        completes_at: job.completes_at,
        // car fields empty
        build_id: null, car_name: null, model_code: null, archetype: null,
        car_started_at: null, car_completes_at: null,
        car_engineer_name_1: null, car_engineer_name_2: null,
      };
    }

    return {
      slot_index: i,
      type: "idle",
      status: "idle",
      queue_id: null, part_template_id: null, part_name: null, part_category: null,
      engineer_id: null, engineer_name: null, started_at: null, completes_at: null,
      build_id: null, car_name: null, model_code: null, archetype: null,
      car_started_at: null, car_completes_at: null,
      car_engineer_name_1: null, car_engineer_name_2: null,
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

  const user = db.prepare(`SELECT credits, xgear FROM users WHERE id = ?`).get(session.id) as { credits: number; xgear: number };

  const blueprints = db.prepare(
    `SELECT ct.id as car_template_id, ct.name, ct.model_code, ct.archetype, ct.description,
            ct.base_speed, ct.base_acceleration, ct.base_handling, ct.base_stability,
            ct.base_durability, ct.base_weight, ct.base_braking, ct.base_control,
            ct.base_shift_speed, ct.base_efficiency, ct.base_grip, ct.base_cornering,
            ub.quantity
     FROM user_blueprints ub
     JOIN car_templates ct ON ct.id = ub.car_template_id
     WHERE ub.user_id = ? AND ub.quantity > 0
     ORDER BY ct.archetype, ct.id`
  ).all(session.id) as CarBlueprint[];

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
        xgear: user.xgear,
        blueprints,
      }}
    />
  );
}
