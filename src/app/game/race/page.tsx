"use server";

import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";
import { redirect } from "next/navigation";
import RaceClient from "./RaceClient";

export interface RaceCircuit {
  id: number;
  name: string;
  location: string;
  art: string | null;
  difficulty: number;
  laps: number;
  reward_credits: number;
  reward_materials: string;
  reward_prestige: number;
  unlock_level: number;
  description: string | null;
  archetype: string | null;
  min_speed: number;
  min_handling: number;
  duration_seconds: number;
  podium_rewards: string;
  entry_cost: number;
  field_size: number;
}

export interface ActiveRace {
  id: number;
  circuit_id: number;
  driver_id: number;
  engineer_id: number | null;
  car_id: number;
  status: string;
  started_at: number;
  completes_at: number;
  circuit_name: string;
  driver_name: string;
  car_name: string;
  engineer_name: string | null;
  npc_field: string;
  field_size: number;
  car_performance: number;
  driver_speed: number;
  driver_skill: number;
  engineer_bonus: number;
}

export interface UserDriver {
  id: number;
  template_id: number;
  name: string;
  speed: number;
  skill: number;
  stamina: number;
  aggression: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  status: string;
  wins: number;
  races: number;
}

export interface UserEngineer {
  id: number;
  template_id: number;
  name: string;
  craft_speed: number;
  quality_bonus: number;
  race_bonus: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  status: string;
}

export interface UserCar {
  id: number;
  name: string;
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
  status: string;
  total_races: number;
  total_wins: number;
  color: string;
  template_name: string;
  model_code: string;
  archetype: string;
}

export interface RacePageData {
  circuits: RaceCircuit[];
  activeRaces: ActiveRace[];
  userDrivers: UserDriver[];
  userEngineers: UserEngineer[];
  userCars: UserCar[];
  credits: number;
  xgear: number;
  serverNow: number;
}

export default async function RacePage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  const db = await initDb();
  await seedDatabase(db);

  const now = Math.floor(Date.now() / 1000);

  const circuits = db.prepare(`
    SELECT id, name, location, art, difficulty, laps, reward_credits, reward_materials,
           reward_prestige, unlock_level, description,
           COALESCE(archetype, NULL) as archetype,
           COALESCE(min_speed, 0) as min_speed,
           COALESCE(min_handling, 0) as min_handling,
           COALESCE(duration_seconds, 300) as duration_seconds,
           COALESCE(podium_rewards, '[]') as podium_rewards,
           COALESCE(entry_cost, 0) as entry_cost,
           COALESCE(field_size, 5) as field_size
    FROM circuits
    ORDER BY difficulty ASC, id ASC
  `).all() as RaceCircuit[];

  const activeRaces = db.prepare(`
    SELECT r.id, r.circuit_id, r.driver_id, r.engineer_id, r.car_id,
           r.status, r.started_at, r.completes_at,
           r.npc_field,
           c.name as circuit_name,
           c.field_size,
           dt.name as driver_name,
           car.name as car_name,
           et.name as engineer_name,
           car.stat_speed + car.stat_acceleration + car.stat_handling + car.stat_stability
             + car.stat_durability + car.stat_weight + car.stat_braking + car.stat_control
             + car.stat_shift_speed + car.stat_efficiency + car.stat_grip + car.stat_cornering
             as car_performance,
           d.speed as driver_speed,
           d.skill as driver_skill,
           COALESCE(e.race_bonus, 0) as engineer_bonus
    FROM races r
    JOIN circuits c ON c.id = r.circuit_id
    JOIN drivers d ON d.id = r.driver_id
    JOIN driver_templates dt ON dt.id = d.template_id
    JOIN cars car ON car.id = r.car_id
    LEFT JOIN engineers e ON e.id = r.engineer_id
    LEFT JOIN engineer_templates et ON et.id = e.template_id
    WHERE r.user_id = ? AND r.status IN ('scheduled', 'in_progress')
    ORDER BY r.started_at DESC
    LIMIT 20
  `).all(session.id) as ActiveRace[];

  const userDrivers = db.prepare(`
    SELECT d.id, d.template_id, dt.name, d.speed, d.skill, d.stamina, d.aggression,
           dt.rarity, d.status, d.wins, d.races
    FROM drivers d
    JOIN driver_templates dt ON dt.id = d.template_id
    WHERE d.user_id = ?
    ORDER BY dt.rarity DESC, d.speed DESC
  `).all(session.id) as UserDriver[];

  const userEngineers = db.prepare(`
    SELECT e.id, e.template_id, et.name, e.craft_speed, e.quality_bonus, e.race_bonus,
           et.rarity, e.status
    FROM engineers e
    JOIN engineer_templates et ON et.id = e.template_id
    WHERE e.user_id = ?
    ORDER BY et.rarity DESC, e.race_bonus DESC
  `).all(session.id) as UserEngineer[];

  const userCars = db.prepare(`
    SELECT c.id, c.name,
           c.stat_speed, c.stat_acceleration, c.stat_handling, c.stat_stability,
           c.stat_durability, c.stat_weight, c.stat_braking, c.stat_control,
           c.stat_shift_speed, c.stat_efficiency, c.stat_grip, c.stat_cornering,
           c.wear, c.status, c.total_races, c.total_wins, c.color,
           ct.name as template_name, ct.model_code, ct.archetype
    FROM cars c
    JOIN car_templates ct ON ct.id = c.car_template_id
    WHERE c.user_id = ? AND c.status NOT IN ('sold')
    ORDER BY c.stat_speed DESC
  `).all(session.id) as UserCar[];

  const user = db.prepare(`SELECT credits, xgear FROM users WHERE id = ?`).get(session.id) as { credits: number; xgear: number };

  return (
    <RaceClient
      data={{
        circuits,
        activeRaces,
        userDrivers,
        userEngineers,
        userCars,
        credits: user.credits,
        xgear: user.xgear,
        serverNow: now,
      }}
    />
  );
}
