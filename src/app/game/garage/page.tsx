"use server";

import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";
import { redirect } from "next/navigation";
import GarageClient from "./GarageClient";

export interface GarageCar {
  id: number;
  name: string;
  color: string;
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
  wear: number;
  status: "garage" | "racing" | "crafting" | "for_sale" | "sold";
  total_races: number;
  total_wins: number;
  sale_price: number | null;
  listing_id: number | null;
  template_name: string;
  model_code: string;
  archetype: string;
  created_at: number;
}

export interface GaragePageData {
  cars: GarageCar[];
  credits: number;
}

export default async function GaragePage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  const db = await initDb();
  await seedDatabase(db);

  const cars = db.prepare(`
    SELECT c.id, c.name, c.color,
           c.stat_speed, c.stat_acceleration, c.stat_handling, c.stat_stability,
           c.stat_durability, c.stat_weight, c.stat_braking, c.stat_control,
           c.stat_shift_speed, c.stat_efficiency, c.stat_grip, c.stat_cornering,
           c.wear, c.status, c.total_races, c.total_wins, c.sale_price,
           ml.id as listing_id,
           ct.name as template_name, ct.model_code, ct.archetype, ct.art, c.created_at
    FROM cars c
    JOIN car_templates ct ON ct.id = c.car_template_id
    LEFT JOIN market_listings ml ON ml.item_id = c.id AND ml.listing_type = 'car' AND ml.status = 'active'
    WHERE c.user_id = ? AND c.status != 'sold'
    ORDER BY c.created_at DESC
  `).all(session.id) as GarageCar[];

  const user = db.prepare(`SELECT credits FROM users WHERE id = ?`).get(session.id) as { credits: number };

  return <GarageClient data={{ cars, credits: user.credits }} />;
}
