"use server";

import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";
import { resolveArt } from "@/lib/resolveArt";
import { redirect } from "next/navigation";
import DriversClient from "./DriversClient";

export interface DriversPageData {
  drivers: DriverFull[];
  driverCap: number;
}

export interface DriverFull {
  id: number;
  template_id: number;
  nickname: string | null;
  level: number;
  xp: number;
  speed: number;
  skill: number;
  stamina: number;
  aggression: number;
  morale: number;
  wins: number;
  races: number;
  status: "idle" | "racing" | "injured" | "retired";
  created_at: number;
  // from driver_templates
  name: string;
  nationality: string;
  portrait: string | null;
  art: string | null;
  rarity: "common" | "rare" | "epic" | "legendary";
  bio: string | null;
  base_speed: number;
  base_skill: number;
  base_stamina: number;
  base_aggression: number;
  // resolved on the server — always a valid public URL
  resolvedPortrait: string;
}

export default async function DriversPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  const db = await initDb();
  await seedDatabase(db);

  const rows = db
    .prepare(
      `SELECT
        d.id, d.template_id, d.nickname, d.level, d.xp,
        d.speed, d.skill, d.stamina, d.aggression, d.morale,
        d.wins, d.races, d.status, d.created_at,
        t.name, t.nationality, t.portrait, t.art, t.rarity, t.bio,
        t.base_speed, t.base_skill, t.base_stamina, t.base_aggression
       FROM drivers d
       JOIN driver_templates t ON t.id = d.template_id
       WHERE d.user_id = ?
       ORDER BY t.rarity DESC, d.level DESC`
    )
    .all(session.id) as Omit<DriverFull, "resolvedPortrait">[];

  const drivers: DriverFull[] = rows.map((d) => ({
    ...d,
    resolvedPortrait: resolveArt(d.art, "drivers"),
  }));

  const upgradesRow = db.prepare(
    `SELECT driver_cap FROM workshop_upgrades WHERE user_id = ?`
  ).get(session.id) as { driver_cap: number } | undefined;

  const driverCapLevel = upgradesRow?.driver_cap ?? 0;
  const driverCap = 4 + driverCapLevel * 2;

  return <DriversClient data={{ drivers, driverCap }} />;
}
