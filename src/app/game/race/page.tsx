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
  speed: number;
  handling: number;
  durability: number;
  acceleration: number;
  status: string;
  total_races: number;
  total_wins: number;
  color: string;
  template_name: string;
  model_code: string;
  tier: number;
}

export interface RacePageData {
  circuits: RaceCircuit[];
  activeRaces: ActiveRace[];
  userDrivers: UserDriver[];
  userEngineers: UserEngineer[];
  userCars: UserCar[];
  credits: number;
  serverNow: number;
}

export default async function RacePage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  const db = await initDb();
  await seedDatabase(db);

  const now = Math.floor(Date.now() / 1000);

  const circuits = db.prepare(`
    SELECT id, name, location, difficulty, laps, reward_credits, reward_materials,
           reward_prestige, unlock_level, description,
           COALESCE(archetype, NULL) as archetype,
           COALESCE(min_speed, 0) as min_speed,
           COALESCE(min_handling, 0) as min_handling,
           COALESCE(duration_seconds, 300) as duration_seconds,
           COALESCE(podium_rewards, '[]') as podium_rewards
    FROM circuits
    ORDER BY difficulty ASC, id ASC
  `).all() as RaceCircuit[];

  const activeRaces = db.prepare(`
    SELECT r.id, r.circuit_id, r.driver_id, r.engineer_id, r.car_id,
           r.status, r.started_at, r.completes_at,
           c.name as circuit_name,
           dt.name as driver_name,
           car.name as car_name,
           et.name as engineer_name
    FROM races r
    JOIN circuits c ON c.id = r.circuit_id
    JOIN drivers d ON d.id = r.driver_id
    JOIN driver_templates dt ON dt.id = d.template_id
    JOIN cars car ON car.id = r.car_id
    LEFT JOIN engineers e ON e.id = r.engineer_id
    LEFT JOIN engineer_templates et ON et.id = e.template_id
    WHERE r.user_id = ? AND r.status IN ('scheduled', 'in_progress', 'completed')
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
    SELECT c.id, c.name, c.speed, c.handling, c.durability, c.acceleration,
           c.status, c.total_races, c.total_wins, c.color,
           ct.name as template_name, ct.model_code, ct.tier
    FROM cars c
    JOIN car_templates ct ON ct.id = c.template_id
    WHERE c.user_id = ? AND c.status NOT IN ('sold')
    ORDER BY c.speed DESC
  `).all(session.id) as UserCar[];

  const user = db.prepare(`SELECT credits FROM users WHERE id = ?`).get(session.id) as { credits: number };

  return (
    <RaceClient
      data={{
        circuits,
        activeRaces,
        userDrivers,
        userEngineers,
        userCars,
        credits: user.credits,
        serverNow: now,
      }}
    />
  );
}
