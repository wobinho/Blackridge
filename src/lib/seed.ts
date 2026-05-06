import type { DbWrapper } from "./db";

// Rarity multipliers applied to base part stats at craft time
export const PART_RARITY_STAT_MULT: Record<string, number> = {
  common:    1.0,
  rare:      1.5,
  epic:      2.2,
  legendary: 3.5,
  mythical:  5.0,
};

// Rarity multipliers for sell price
export const PART_RARITY_PRICE_MULT: Record<string, number> = {
  common:    1,
  rare:      3,
  epic:      8,
  legendary: 20,
  mythical:  50,
};

// Rarity multipliers for craft time
export const PART_RARITY_TIME_MULT: Record<string, number> = {
  common:    1.0,
  rare:      2.0,
  epic:      4.0,
  legendary: 8.0,
  mythical:  16.0,
};

// Craft outcome probabilities (roll at claim time)
export const PART_RARITY_CHANCES = [
  { rarity: "common",    weight: 45 },
  { rarity: "rare",      weight: 25 },
  { rarity: "epic",      weight: 15 },
  { rarity: "legendary", weight: 10 },
  { rarity: "mythical",  weight: 5  },
];

export function rollPartRarity(): string {
  const total = PART_RARITY_CHANCES.reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * total;
  for (const { rarity, weight } of PART_RARITY_CHANCES) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return "common";
}

export async function seedDatabase(db: DbWrapper): Promise<void> {
  db.prepare(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`).run();

  const seeded = db.prepare("SELECT value FROM meta WHERE key = 'seeded_v2'").get();

  // Backfill: add entry_cost and field_size columns to circuits if missing
  const circuitColBackfill = db.prepare("SELECT value FROM meta WHERE key = 'circuit_entry_cost_backfill_v1'").get();
  if (!circuitColBackfill) {
    try { db.prepare("ALTER TABLE circuits ADD COLUMN entry_cost INTEGER NOT NULL DEFAULT 0").run(); } catch { /* already exists */ }
    try { db.prepare("ALTER TABLE circuits ADD COLUMN field_size INTEGER NOT NULL DEFAULT 5").run(); } catch { /* already exists */ }
    // Update existing circuit rows with correct values
    const circuitUpdates: [number, number, string][] = [
      [1000,  5,  "Ridgeport Oval"],
      [3000,  8,  "Blackwater Bay Circuit"],
      [5000,  10, "Iron Peak Mountain Pass"],
      [10000, 12, "Neon District Street Race"],
      [50000, 20, "Grand Prix de Blackridge"],
    ];
    for (const [ec, fs, name] of circuitUpdates) {
      db.prepare("UPDATE circuits SET entry_cost = ?, field_size = ? WHERE name = ?").run(ec, fs, name);
    }
    db.prepare("INSERT INTO meta (key, value) VALUES ('circuit_entry_cost_backfill_v1', '1')").run();
  }

  // Backfill: update podium_rewards for all circuits to match the correct reward spec
  const podiumRewardsBackfill = db.prepare("SELECT value FROM meta WHERE key = 'circuit_podium_rewards_backfill_v1'").get();
  if (!podiumRewardsBackfill) {
    const podiumUpdates: [string, string][] = [
      ["Ridgeport Oval", JSON.stringify([
        {position:1,credits_bonus:10000,xgear_bonus:2,mat_count:10,prestige_bonus:5},
        {position:2,credits_bonus:5000, xgear_bonus:0,mat_count:10,prestige_bonus:2},
        {position:3,credits_bonus:2000, xgear_bonus:0,mat_count:5, prestige_bonus:1},
      ])],
      ["Blackwater Bay Circuit", JSON.stringify([
        {position:1,credits_bonus:25000,xgear_bonus:3,mat_count:20,prestige_bonus:10},
        {position:2,credits_bonus:15000,xgear_bonus:0,mat_count:10,prestige_bonus:5},
        {position:3,credits_bonus:5000, xgear_bonus:0,mat_count:10,prestige_bonus:2},
      ])],
      ["Iron Peak Mountain Pass", JSON.stringify([
        {position:1,credits_bonus:40000,xgear_bonus:5,mat_count:30,prestige_bonus:20},
        {position:2,credits_bonus:20000,xgear_bonus:0,mat_count:20,prestige_bonus:8},
        {position:3,credits_bonus:10000,xgear_bonus:0,mat_count:10,prestige_bonus:4},
      ])],
      ["Neon District Street Race", JSON.stringify([
        {position:1,credits_bonus:75000,xgear_bonus:7,mat_count:50,prestige_bonus:35},
        {position:2,credits_bonus:30000,xgear_bonus:0,mat_count:30,prestige_bonus:15},
        {position:3,credits_bonus:15000,xgear_bonus:0,mat_count:10,prestige_bonus:6},
      ])],
      ["Grand Prix de Blackridge", JSON.stringify([
        {position:1,credits_bonus:500000,xgear_bonus:20,mat_count:100,prestige_bonus:100},
        {position:2,credits_bonus:150000,xgear_bonus:5, mat_count:50, prestige_bonus:40},
        {position:3,credits_bonus:50000, xgear_bonus:3, mat_count:20, prestige_bonus:15},
      ])],
    ];
    for (const [name, pod] of podiumUpdates) {
      db.prepare("UPDATE circuits SET podium_rewards = ? WHERE name = ?").run(pod, name);
    }
    db.prepare("INSERT INTO meta (key, value) VALUES ('circuit_podium_rewards_backfill_v1', '1')").run();
  }

  // Backfill: add npc_field column to races if missing
  const npcFieldBackfill = db.prepare("SELECT value FROM meta WHERE key = 'races_npc_field_backfill_v1'").get();
  if (!npcFieldBackfill) {
    try { db.prepare("ALTER TABLE races ADD COLUMN npc_field TEXT DEFAULT '[]'").run(); } catch { /* already exists */ }
    db.prepare("INSERT INTO meta (key, value) VALUES ('races_npc_field_backfill_v1', '1')").run();
  }

  // Backfill: create level_requirements table and seed if missing
  const levelReqBackfill = db.prepare("SELECT value FROM meta WHERE key = 'level_requirements_backfill_v1'").get();
  if (!levelReqBackfill) {
    db.prepare(`CREATE TABLE IF NOT EXISTS level_requirements (
      level INTEGER PRIMARY KEY, prestige_cost INTEGER NOT NULL DEFAULT 0, credits_cost INTEGER NOT NULL DEFAULT 0
    )`).run();
    const levelData: [number, number, number][] = [
      [2,50,100000],[3,100,200000],[4,200,300000],[5,300,500000],
      [6,400,750000],[7,500,1000000],[8,600,1500000],[9,700,2000000],[10,1000,5000000],
    ];
    for (const [lvl, pres, cred] of levelData) {
      db.prepare("INSERT OR IGNORE INTO level_requirements (level, prestige_cost, credits_cost) VALUES (?,?,?)").run(lvl, pres, cred);
    }
    db.prepare("INSERT INTO meta (key, value) VALUES ('level_requirements_backfill_v1', '1')").run();
  }

  // Backfill: create npc_cars table and seed data if missing
  const npcCarsBackfill = db.prepare("SELECT value FROM meta WHERE key = 'npc_cars_seed_backfill_v1'").get();
  if (!npcCarsBackfill) {
    db.prepare(`CREATE TABLE IF NOT EXISTS npc_cars (
      id INTEGER PRIMARY KEY AUTOINCREMENT, circuit_id INTEGER NOT NULL, name TEXT NOT NULL,
      stat_speed INTEGER NOT NULL DEFAULT 50, stat_handling INTEGER NOT NULL DEFAULT 50,
      stat_durability INTEGER NOT NULL DEFAULT 50, stat_acceleration INTEGER NOT NULL DEFAULT 50,
      description TEXT
    )`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_npc_cars_circuit ON npc_cars(circuit_id)`).run();
    // Seed NPC car data inline so it runs for existing DBs too (full data in main seed below)
    // We defer to the main seed block for new DBs; this backfill seeds for existing ones
    const _npcInsert = db.prepare(`INSERT INTO npc_cars (circuit_id, name, stat_speed, stat_handling, stat_durability, stat_acceleration, description) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const _getC = (n: string) => (db.prepare("SELECT id FROM circuits WHERE name = ?").get(n) as { id: number } | undefined)?.id;

    const _npcData: [string, string, number, number, number, number, string][] = [
      // Ridgeport Oval (10)
      ["Ridgeport Oval","Garrett #12",28,22,30,25,"Local oval regular."],
      ["Ridgeport Oval","Team Apex #7",35,28,28,30,"Amateur team."],
      ["Ridgeport Oval","Rookie Racer #3",22,18,35,20,"First season driver."],
      ["Ridgeport Oval","Sandy Cruz",32,24,32,28,"Weekend warrior."],
      ["Ridgeport Oval","Bolt Motorsport",38,30,25,34,"Small outfit."],
      ["Ridgeport Oval","Dale Vickers",26,20,38,22,"Veteran driver, old car."],
      ["Ridgeport Oval","Circuit Kings #2",40,32,26,36,"Local hotshoe."],
      ["Ridgeport Oval","Freeway Foxes",30,26,30,26,"Balanced backmarker."],
      ["Ridgeport Oval","Iron Fist #9",34,28,34,30,"Tough car."],
      ["Ridgeport Oval","Dusty Roads Co",24,22,40,20,"Built for endurance."],
      // Blackwater Bay Circuit (16)
      ["Blackwater Bay Circuit","Coastal Speed Co",48,40,35,44,"Seaside sports car."],
      ["Blackwater Bay Circuit","Bay Runners #1",55,45,38,50,"Regional contender."],
      ["Blackwater Bay Circuit","Storm Lap Racing",42,38,42,40,"Aggressive style."],
      ["Blackwater Bay Circuit","Tidal Force #4",60,50,32,55,"Fast but fragile."],
      ["Blackwater Bay Circuit","Crosswind Motors",45,44,44,42,"Handles wind well."],
      ["Blackwater Bay Circuit","Gulf Circuit Team",52,48,40,48,"Solid mid-field."],
      ["Blackwater Bay Circuit","Seabreeze #11",38,42,48,36,"Technical driver."],
      ["Blackwater Bay Circuit","Aqua Drift Co",58,46,36,52,"Flashy, real pace."],
      ["Blackwater Bay Circuit","Harbor Line Racing",43,40,45,41,"Consistent finisher."],
      ["Blackwater Bay Circuit","Tide Surge #6",65,52,30,60,"Top of the field."],
      ["Blackwater Bay Circuit","Windward Works",40,38,50,38,"Durable car."],
      ["Blackwater Bay Circuit","Breaker Point FC",50,46,38,46,"Local favorite."],
      ["Blackwater Bay Circuit","Saltflat Speed",44,42,42,42,"Balanced all-rounder."],
      ["Blackwater Bay Circuit","Bay Area Bolts",62,50,34,56,"Young team."],
      ["Blackwater Bay Circuit","Shoreline SC #8",36,36,52,34,"Finishes races."],
      ["Blackwater Bay Circuit","Lagoon Racers",54,44,40,50,"Mid-pack threat."],
      // Iron Peak Mountain Pass (20)
      ["Iron Peak Mountain Pass","Summit Racing #1",65,70,55,60,"Mountain specialist."],
      ["Iron Peak Mountain Pass","Alpine Works",72,65,50,68,"High altitude setup."],
      ["Iron Peak Mountain Pass","Peak Motorsport",58,68,60,55,"Technical team."],
      ["Iron Peak Mountain Pass","Crestline FC",80,72,48,75,"Front runner."],
      ["Iron Peak Mountain Pass","Ironside Racing",55,62,65,52,"Durable build."],
      ["Iron Peak Mountain Pass","Altitude Speed Co",75,68,52,70,"Quick and consistent."],
      ["Iron Peak Mountain Pass","Pinnacle Motors",60,75,58,57,"Handling specialist."],
      ["Iron Peak Mountain Pass","Ridge Runners #3",68,60,55,64,"Aggressive pacing."],
      ["Iron Peak Mountain Pass","Cliff Edge Racing",52,58,70,50,"Safer, slower."],
      ["Iron Peak Mountain Pass","Rockface FC #7",82,70,46,78,"Edge of the cliff."],
      ["Iron Peak Mountain Pass","Granite Works",64,66,60,60,"Mid-field regular."],
      ["Iron Peak Mountain Pass","Skyline Speed",70,64,55,66,"Good all-round."],
      ["Iron Peak Mountain Pass","Switchback SC",57,72,62,54,"Best handling here."],
      ["Iron Peak Mountain Pass","Cloud Cap Racing",76,66,50,72,"Strong pace."],
      ["Iron Peak Mountain Pass","Tundra Motorsport",50,60,72,48,"Built for survival."],
      ["Iron Peak Mountain Pass","Highpass FC #10",84,68,44,80,"Reckless but rapid."],
      ["Iron Peak Mountain Pass","Snowline Speed",62,64,58,58,"Reliable scorer."],
      ["Iron Peak Mountain Pass","Crater Works",54,70,66,52,"Technical brilliance."],
      ["Iron Peak Mountain Pass","Summit Sharks #2",78,72,50,74,"Top-three threat."],
      ["Iron Peak Mountain Pass","Iron Pass FC",66,62,60,62,"Veteran team."],
      // Neon District Street Race (24)
      ["Neon District Street Race","Night Shift Racing",80,75,60,78,"Street regulars."],
      ["Neon District Street Race","Volt Syndicate #1",95,80,55,90,"Electrifying pace."],
      ["Neon District Street Race","Urban Blur Co",72,70,65,70,"Lower speed, high style."],
      ["Neon District Street Race","Neon Kings #4",105,88,50,100,"Top tier machine."],
      ["Neon District Street Race","Grid Lock Racing",75,78,68,72,"Urban specialist."],
      ["Neon District Street Race","Street Phantom #9",90,82,58,86,"Deadly pace."],
      ["Neon District Street Race","District Drift FC",68,85,72,65,"Handling god."],
      ["Neon District Street Race","Midnight Works",98,78,52,94,"Fastest on the straight."],
      ["Neon District Street Race","Neon Outlaws",76,72,66,74,"Surprise package."],
      ["Neon District Street Race","Flash Motorsport #2",92,80,56,88,"Consistent front-runner."],
      ["Neon District Street Race","Circuit Ghosts",70,76,70,68,"Great car, no stars."],
      ["Neon District Street Race","Apex City Racing",100,84,52,96,"Clinical execution."],
      ["Neon District Street Race","Signal Break FC",78,74,64,76,"Punch above weight."],
      ["Neon District Street Race","Red Light District",88,76,60,84,"Gritty team."],
      ["Neon District Street Race","Voltage Drop SC",66,80,74,64,"Handling focused."],
      ["Neon District Street Race","Street Sovereign #5",102,86,54,98,"City champion."],
      ["Neon District Street Race","Lane Splitters",74,70,68,72,"Always in the mix."],
      ["Neon District Street Race","Grid Phantom Co",96,82,56,92,"Slippery and quick."],
      ["Neon District Street Race","Neon Rush #7",82,76,62,80,"Fun team."],
      ["Neon District Street Race","Megawatt Motors",108,90,48,104,"Absolute rocket."],
      ["Neon District Street Race","Cityblock FC",70,74,70,68,"Solid city car."],
      ["Neon District Street Race","Blacktop Syndicate",86,78,60,82,"Streetwise and fast."],
      ["Neon District Street Race","Urban Surge #3",94,84,54,90,"High energy outfit."],
      ["Neon District Street Race","Neon Storm Racing",78,72,64,76,"Veteran street team."],
      // Grand Prix de Blackridge (40)
      ["Grand Prix de Blackridge","Blackridge Works #1",120,110,90,115,"Factory team."],
      ["Grand Prix de Blackridge","Apex Dynasty",135,115,85,130,"Championship contender."],
      ["Grand Prix de Blackridge","Iron Throne FC",95,100,95,92,"Mid-field workhorse."],
      ["Grand Prix de Blackridge","Crimson Circuit #3",140,118,82,136,"On the limit every lap."],
      ["Grand Prix de Blackridge","Velocity Prime",105,108,92,102,"Technically brilliant."],
      ["Grand Prix de Blackridge","Grand Prix Ghosts",128,112,88,124,"Experienced outfit."],
      ["Grand Prix de Blackridge","Zero Drag Works",148,120,78,144,"Fastest straight-line."],
      ["Grand Prix de Blackridge","Carbon Crown Racing",98,106,96,95,"All-round package."],
      ["Grand Prix de Blackridge","Blackridge Elite #2",132,114,86,128,"Sister factory team."],
      ["Grand Prix de Blackridge","Speed Sovereign",115,110,90,112,"Consistent top-5."],
      ["Grand Prix de Blackridge","Formula Works FC",142,116,80,138,"Ex-formula team."],
      ["Grand Prix de Blackridge","Pinnacle Grand Prix",100,105,94,98,"Surgical in corners."],
      ["Grand Prix de Blackridge","Prestige Motors #4",125,112,88,122,"Well-organized."],
      ["Grand Prix de Blackridge","Apex Legion",138,118,83,134,"Hunting the title."],
      ["Grand Prix de Blackridge","Titanium Works",108,107,92,105,"Robust car."],
      ["Grand Prix de Blackridge","Blackridge Storm",145,119,79,141,"Brilliant in the dry."],
      ["Grand Prix de Blackridge","Circuit Sovereign #7",118,110,89,115,"Race craft over pace."],
      ["Grand Prix de Blackridge","Hyperion Racing",130,115,86,126,"Tech-forward outfit."],
      ["Grand Prix de Blackridge","Iron Dominion",92,102,98,90,"Toughest chassis."],
      ["Grand Prix de Blackridge","Onyx Motorsport",122,112,88,118,"Quiet team, loud results."],
      ["Grand Prix de Blackridge","Blackridge Legends #6",136,116,84,132,"Proven race winners."],
      ["Grand Prix de Blackridge","Apex Throne FC",102,106,94,100,"Technical team."],
      ["Grand Prix de Blackridge","Grand Prix Elite",144,120,80,140,"Pure pace."],
      ["Grand Prix de Blackridge","Velocity Kings #5",112,109,91,109,"Mid-pack royalty."],
      ["Grand Prix de Blackridge","Chrome Circuit",126,113,87,122,"Sleek machine."],
      ["Grand Prix de Blackridge","Steel Dominion #8",96,103,97,93,"Durability experts."],
      ["Grand Prix de Blackridge","Blackridge Thunder",140,117,81,136,"Thunder every straight."],
      ["Grand Prix de Blackridge","Apex Prestige",110,108,91,107,"Prestige pace."],
      ["Grand Prix de Blackridge","Grand Slam Racing",133,115,85,129,"All-or-nothing strategy."],
      ["Grand Prix de Blackridge","Zero Limits FC",147,121,77,143,"Fastest in qualifying."],
      ["Grand Prix de Blackridge","Meridian Works #9",104,106,93,101,"Solid all-rounder."],
      ["Grand Prix de Blackridge","Blackridge Circuit Co",120,111,90,116,"Home circuit advantage."],
      ["Grand Prix de Blackridge","Summit Grand Prix",128,113,87,124,"Altitude specialists."],
      ["Grand Prix de Blackridge","Apex Finale",138,117,83,134,"Saves best for big shows."],
      ["Grand Prix de Blackridge","Omega Works FC",115,109,90,112,"Late-season form."],
      ["Grand Prix de Blackridge","Neon Circuit GP #10",142,119,79,138,"Street DNA meets GP."],
      ["Grand Prix de Blackridge","Iron Grand Prix",100,105,95,98,"Mountain-hardened."],
      ["Grand Prix de Blackridge","Velocity Sovereign",130,114,86,126,"Waiting for a win."],
      ["Grand Prix de Blackridge","Blackridge Champion",150,122,80,146,"The defending champion."],
      ["Grand Prix de Blackridge","Apex Unlimited",106,108,92,103,"No limits on ambition."],
    ];

    for (const [circuitName, name, spd, hdl, dur, acc, desc] of _npcData) {
      const cid = _getC(circuitName);
      if (cid) _npcInsert.run(cid, name, spd, hdl, dur, acc, desc);
    }

    db.prepare("INSERT INTO meta (key, value) VALUES ('npc_cars_seed_backfill_v1', '1')").run();
  }

  // Backfill: add 8 missing stat columns to npc_cars and repopulate with full 12-stat data
  const npcStats12Backfill = db.prepare("SELECT value FROM meta WHERE key = 'npc_cars_12stats_backfill_v3'").get();
  if (!npcStats12Backfill) {
    // Add missing columns (safe to call even if they already exist via schema.sql on fresh DB)
    const existingCols = (db.prepare("PRAGMA table_info(npc_cars)").all() as { name: string }[]).map(c => c.name);
    const newCols: [string, string][] = [
      ["stat_acceleration", "INTEGER NOT NULL DEFAULT 50"],
      ["stat_stability",    "INTEGER NOT NULL DEFAULT 50"],
      ["stat_weight",       "INTEGER NOT NULL DEFAULT 50"],
      ["stat_braking",      "INTEGER NOT NULL DEFAULT 50"],
      ["stat_control",      "INTEGER NOT NULL DEFAULT 50"],
      ["stat_shift_speed",  "INTEGER NOT NULL DEFAULT 50"],
      ["stat_efficiency",   "INTEGER NOT NULL DEFAULT 50"],
      ["stat_grip",         "INTEGER NOT NULL DEFAULT 50"],
      ["stat_cornering",    "INTEGER NOT NULL DEFAULT 50"],
    ];
    for (const [col, def] of newCols) {
      if (!existingCols.includes(col)) {
        db.prepare(`ALTER TABLE npc_cars ADD COLUMN ${col} ${def}`).run();
      }
    }

    // Wipe and re-seed with full 12-stat data so the DB matches the new schema
    db.prepare("DELETE FROM npc_cars").run();
    db.prepare("DELETE FROM sqlite_sequence WHERE name = 'npc_cars'").run();

    const _ins12 = db.prepare(`
      INSERT INTO npc_cars
        (circuit_id, name, stat_speed, stat_acceleration, stat_handling, stat_stability,
         stat_durability, stat_weight, stat_braking, stat_control,
         stat_shift_speed, stat_efficiency, stat_grip, stat_cornering, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const _getC2 = (n: string) => (db.prepare("SELECT id FROM circuits WHERE name = ?").get(n) as { id: number } | undefined)?.id;

    // [circuit, name, spd, accel, hdl, stab, dur, wght, brk, ctrl, shift, eff, grip, corn, desc]
    type NpcRow12 = [string, string, number, number, number, number, number, number, number, number, number, number, number, number, string];
    const _npc12: NpcRow12[] = [
      // ── Ridgeport Oval ──────────────────────────────────────────────────────────
      ["Ridgeport Oval","Garrett #12",     56,50,44,40,60,64,40,36,44,36,36,40,"Local oval regular. Consistent but slow."],
      ["Ridgeport Oval","Team Apex #7",    70,60,56,50,56,60,52,44,56,48,44,48,"Amateur team with decent speed."],
      ["Ridgeport Oval","Rookie Racer #3", 44,40,36,32,70,76,30,28,36,32,28,32,"First season driver. Survives more than wins."],
      ["Ridgeport Oval","Sandy Cruz",      64,56,48,44,64,68,44,40,52,44,40,44,"Weekend warrior with a tuned street car."],
      ["Ridgeport Oval","Bolt Motorsport", 76,68,60,52,50,56,56,48,60,52,50,52,"Small outfit with a quick machine."],
      ["Ridgeport Oval","Dale Vickers",    52,44,40,36,76,80,32,28,40,32,32,32,"Veteran driver, old slow car."],
      ["Ridgeport Oval","Circuit Kings #2",80,72,64,56,52,56,60,52,64,56,52,56,"Local hotshoe. Dangerous on the straight."],
      ["Ridgeport Oval","Freeway Foxes",   60,52,52,44,60,64,44,40,48,40,40,44,"Balanced backmarker team."],
      ["Ridgeport Oval","Iron Fist #9",    68,60,56,48,68,72,48,44,56,48,44,48,"Tough car, average driver."],
      ["Ridgeport Oval","Dusty Roads Co",  48,40,44,36,80,84,28,24,36,28,24,28,"Built for endurance, not speed."],
      // ── Blackwater Bay Circuit ──────────────────────────────────────────────────
      ["Blackwater Bay Circuit","Coastal Speed Co",  96,88,80,72,70,72,72,64,80,72,68,72,"Seaside team with a quick sports car."],
      ["Blackwater Bay Circuit","Bay Runners #1",    110,100,90,80,76,76,84,76,88,80,80,84,"Regional contender. Knows every corner."],
      ["Blackwater Bay Circuit","Storm Lap Racing",  84,80,76,68,84,88,64,56,72,64,60,64,"Aggressive style, tends to overcook corners."],
      ["Blackwater Bay Circuit","Tidal Force #4",    120,110,100,88,64,64,92,80,100,88,88,92,"Fast but fragile. All or nothing."],
      ["Blackwater Bay Circuit","Crosswind Motors",  90,84,88,80,88,88,72,64,80,72,72,76,"Handles the bay wind better than most."],
      ["Blackwater Bay Circuit","Gulf Circuit Team", 104,96,96,88,80,80,80,72,88,80,76,80,"Solid mid-field presence."],
      ["Blackwater Bay Circuit","Seabreeze #11",     76,72,84,76,96,96,56,52,68,60,56,60,"Technical driver, slower car."],
      ["Blackwater Bay Circuit","Aqua Drift Co",     116,104,92,84,72,72,88,76,96,88,88,92,"Flashy livery, real pace."],
      ["Blackwater Bay Circuit","Harbor Line Racing", 86,82,80,72,90,92,68,60,76,68,64,68,"Consistent finisher, never spectacular."],
      ["Blackwater Bay Circuit","Tide Surge #6",     130,120,104,92,60,60,100,88,108,96,100,104,"Top of the field. Hard to beat on raw pace."],
      ["Blackwater Bay Circuit","Windward Works",    80,76,76,68,100,104,56,48,64,56,52,56,"Durable car, cautious team."],
      ["Blackwater Bay Circuit","Breaker Point FC",  100,92,92,84,76,76,76,68,84,76,72,76,"Local favorite with a loyal crew."],
      ["Blackwater Bay Circuit","Saltflat Speed",    88,84,84,76,84,84,68,60,76,68,64,68,"Balanced all-rounder."],
      ["Blackwater Bay Circuit","Bay Area Bolts",    124,112,100,88,68,68,96,84,104,92,92,96,"Young team, big talent."],
      ["Blackwater Bay Circuit","Shoreline SC #8",   72,68,72,64,104,108,48,44,60,52,44,48,"Slow but finishes races others don't."],
      ["Blackwater Bay Circuit","Lagoon Racers",     108,100,88,80,80,80,80,72,88,80,76,80,"Mid-pack threat on a good day."],
      // ── Iron Peak Mountain Pass ─────────────────────────────────────────────────
      ["Iron Peak Mountain Pass","Summit Racing #1",  130,120,140,136,110,108,124,120,116,112,124,128,"Mountain specialist. Pinpoint braking."],
      ["Iron Peak Mountain Pass","Alpine Works",      144,136,130,124,100,100,136,128,130,124,120,124,"High altitude setup, fast on the climbs."],
      ["Iron Peak Mountain Pass","Peak Motorsport",   116,110,136,132,120,116,112,108,110,104,116,120,"Technical team focused on the technical sections."],
      ["Iron Peak Mountain Pass","Crestline FC",      160,150,144,140,96,92,144,136,144,136,136,140,"Front runner. Scares everyone at the hairpins."],
      ["Iron Peak Mountain Pass","Ironside Racing",   110,104,124,120,130,128,104,100,104,100,108,112,"Durable build suits the rough mountain surface."],
      ["Iron Peak Mountain Pass","Altitude Speed Co", 150,140,136,132,104,100,136,128,136,128,128,132,"Quick and consistent up top."],
      ["Iron Peak Mountain Pass","Pinnacle Motors",   120,114,150,148,116,112,116,112,116,112,132,136,"Handling specialist. Brilliant through the bends."],
      ["Iron Peak Mountain Pass","Ridge Runners #3",  136,128,120,116,110,108,124,116,124,116,116,120,"Aggressive pacing from the gun."],
      ["Iron Peak Mountain Pass","Cliff Edge Racing", 104,100,116,112,140,140,96,92,100,96,104,108,"Safer, slower, but always there at the end."],
      ["Iron Peak Mountain Pass","Rockface FC #7",    164,156,140,136,92,88,152,144,148,140,140,144,"Flat-out pace. Edge of the cliff every lap."],
      ["Iron Peak Mountain Pass","Granite Works",     128,120,132,128,120,116,116,112,120,116,116,120,"Mid-field mountain regular."],
      ["Iron Peak Mountain Pass","Skyline Speed",     140,132,128,124,110,108,128,120,128,120,120,124,"Good all-round package."],
      ["Iron Peak Mountain Pass","Switchback SC",     114,108,144,144,124,120,108,104,110,108,128,132,"The best handling car in the field."],
      ["Iron Peak Mountain Pass","Cloud Cap Racing",  152,144,132,128,100,96,140,132,140,132,124,128,"Strong pace on the long straights."],
      ["Iron Peak Mountain Pass","Tundra Motorsport", 100,96,120,116,144,144,88,84,96,92,100,104,"Built for survival, not speed."],
      ["Iron Peak Mountain Pass","Highpass FC #10",   168,160,136,132,88,84,156,148,152,144,140,144,"Highest speed car here. Reckless but rapid."],
      ["Iron Peak Mountain Pass","Snowline Speed",    124,116,128,124,116,112,116,108,116,110,112,116,"Reliable points scorer."],
      ["Iron Peak Mountain Pass","Crater Works",      108,104,140,140,132,128,100,96,104,100,124,128,"Technical brilliance in a slow car."],
      ["Iron Peak Mountain Pass","Summit Sharks #2",  156,148,144,140,100,96,144,136,144,136,132,136,"Top-three threat every race."],
      ["Iron Peak Mountain Pass","Iron Pass FC",      132,124,124,120,120,116,120,116,120,116,116,120,"Veteran mountain team. Never surprised."],
      // ── Neon District Street Race ───────────────────────────────────────────────
      ["Neon District Street Race","Night Shift Racing",  160,156,150,144,120,116,144,140,148,144,136,140,"Street regulars. Own the neon quarter."],
      ["Neon District Street Race","Volt Syndicate #1",   190,180,160,152,110,104,170,164,176,168,160,164,"Electrifying pace through the city grid."],
      ["Neon District Street Race","Urban Blur Co",       144,140,140,136,130,128,132,128,136,132,128,132,"Lower speed, high style."],
      ["Neon District Street Race","Neon Kings #4",      210,200,176,168,100,96,190,184,196,188,180,184,"Top tier street machine. Almost unbeatable."],
      ["Neon District Street Race","Grid Lock Racing",    150,144,156,152,136,132,140,136,144,140,140,144,"Technical urban specialist."],
      ["Neon District Street Race","Street Phantom #9",   180,172,164,156,116,112,164,156,168,160,156,160,"Ghost of the street circuit. Deadly pace."],
      ["Neon District Street Race","District Drift FC",   136,130,170,168,144,140,128,124,132,128,156,160,"Handling god. Corners at impossible speeds."],
      ["Neon District Street Race","Midnight Works",      196,188,156,148,104,100,180,172,184,176,164,168,"Fastest car on the longest straight."],
      ["Neon District Street Race","Neon Outlaws",        152,148,144,140,132,128,140,136,144,140,132,136,"Underground team with a surprise package."],
      ["Neon District Street Race","Flash Motorsport #2", 184,176,160,152,112,108,168,160,172,164,156,160,"Consistent front-runner."],
      ["Neon District Street Race","Circuit Ghosts",      140,136,152,148,140,136,132,128,136,132,136,140,"No star drivers, just a great car."],
      ["Neon District Street Race","Apex City Racing",   200,192,168,160,104,100,184,176,188,180,168,172,"Apex every corner. Clinical execution."],
      ["Neon District Street Race","Signal Break FC",     156,152,148,144,128,124,144,140,148,144,136,140,"Mid-field but punch above their weight."],
      ["Neon District Street Race","Red Light District",  176,168,152,148,120,116,160,152,164,156,144,148,"Gritty team, tough to pass."],
      ["Neon District Street Race","Voltage Drop SC",     132,128,160,160,148,144,124,120,128,124,148,152,"Handling focused in the city twisties."],
      ["Neon District Street Race","Street Sovereign #5",204,196,172,164,108,104,188,180,192,184,172,176,"City champion. Defends hard."],
      ["Neon District Street Race","Lane Splitters",      148,144,140,136,136,132,136,132,140,136,128,132,"Never the fastest but always in the mix."],
      ["Neon District Street Race","Grid Phantom Co",     192,184,164,156,112,108,176,168,180,172,160,164,"Slippery, quick, hard to catch."],
      ["Neon District Street Race","Neon Rush #7",        164,160,152,148,124,120,152,144,156,148,144,148,"Fun team, decent pace."],
      ["Neon District Street Race","Megawatt Motors",    216,208,180,172,96,92,200,192,204,196,184,188,"Absolute rocket. Fragile chassis."],
      ["Neon District Street Race","Cityblock FC",        140,136,148,144,140,136,132,128,136,132,132,136,"Solid city car. Strong at night races."],
      ["Neon District Street Race","Blacktop Syndicate",  172,164,156,152,120,116,160,152,164,156,144,148,"Streetwise and fast."],
      ["Neon District Street Race","Urban Surge #3",      188,180,168,160,108,104,172,164,176,168,160,164,"High energy outfit. Always racing hard."],
      ["Neon District Street Race","Neon Storm Racing",   156,152,144,140,128,124,144,136,148,140,132,136,"Veteran street team. Knows the tricks."],
      // ── Grand Prix de Blackridge ────────────────────────────────────────────────
      ["Grand Prix de Blackridge","Blackridge Works #1",  240,230,220,212,180,172,220,212,224,216,208,212,"Factory team. The benchmark everyone chases."],
      ["Grand Prix de Blackridge","Apex Dynasty",         270,260,230,220,170,160,248,240,256,248,236,240,"Championship contender every season."],
      ["Grand Prix de Blackridge","Iron Throne FC",        190,184,200,192,190,184,176,168,180,172,172,176,"Mid-field workhorse. Never beaten easily."],
      ["Grand Prix de Blackridge","Crimson Circuit #3",   280,272,236,228,164,156,260,252,268,260,248,252,"On the limit every lap. Spectacular to watch."],
      ["Grand Prix de Blackridge","Velocity Prime",       210,204,216,208,184,176,196,188,200,192,196,200,"Technically brilliant setup."],
      ["Grand Prix de Blackridge","Grand Prix Ghosts",    256,248,224,216,176,168,236,228,240,232,224,228,"Experienced outfit. Rarely makes mistakes."],
      ["Grand Prix de Blackridge","Zero Drag Works",      296,288,240,232,156,148,276,268,284,276,260,264,"Fastest straight-line speed in the field."],
      ["Grand Prix de Blackridge","Carbon Crown Racing",   196,190,212,204,192,184,180,172,184,176,180,184,"All-round package. Threat anywhere."],
      ["Grand Prix de Blackridge","Blackridge Elite #2",  264,256,228,220,172,164,244,236,252,244,232,236,"Sister team to the factory squad."],
      ["Grand Prix de Blackridge","Speed Sovereign",      230,224,220,212,180,172,212,204,216,208,204,208,"Consistent top-5 material."],
      ["Grand Prix de Blackridge","Formula Works FC",     284,276,232,224,160,152,264,256,272,264,252,256,"Ex-formula team. Aggressive setup."],
      ["Grand Prix de Blackridge","Pinnacle Grand Prix",  200,196,210,204,188,180,184,176,188,180,188,192,"Handlers. Slow but surgical through corners."],
      ["Grand Prix de Blackridge","Prestige Motors #4",   250,244,224,216,176,168,232,224,240,232,220,224,"Well-funded, well-organized."],
      ["Grand Prix de Blackridge","Apex Legion",          276,268,236,228,166,156,256,248,264,256,244,248,"Hunting the title every race."],
      ["Grand Prix de Blackridge","Titanium Works",       216,210,214,208,184,176,200,192,204,196,196,200,"Robust car, seasoned driver."],
      ["Grand Prix de Blackridge","Blackridge Storm",     290,282,238,230,158,148,270,262,278,270,256,260,"Wet weather nightmare. Brilliant in the dry."],
      ["Grand Prix de Blackridge","Circuit Sovereign #7", 236,230,220,212,178,168,220,212,224,216,208,212,"Race craft over raw pace."],
      ["Grand Prix de Blackridge","Hyperion Racing",      260,252,230,222,172,164,240,232,248,240,228,232,"Tech-forward outfit. Always evolving."],
      ["Grand Prix de Blackridge","Iron Dominion",         184,180,204,196,196,188,168,160,172,164,168,172,"Toughest chassis in the paddock."],
      ["Grand Prix de Blackridge","Onyx Motorsport",      244,236,224,216,176,168,224,216,232,224,212,216,"Quiet team, loud results."],
      ["Grand Prix de Blackridge","Blackridge Legends #6",272,264,232,224,168,160,252,244,260,252,240,244,"Living history. Proven race winners."],
      ["Grand Prix de Blackridge","Apex Throne FC",       204,200,212,204,188,180,188,180,192,184,180,184,"Technical team. Love the technical sectors."],
      ["Grand Prix de Blackridge","Grand Prix Elite",     288,280,240,232,160,152,268,260,276,268,256,260,"Pure pace. Nothing held back."],
      ["Grand Prix de Blackridge","Velocity Kings #5",    224,218,218,210,182,172,208,200,212,204,200,204,"Mid-pack royalty with upset potential."],
      ["Grand Prix de Blackridge","Chrome Circuit",       252,244,226,218,174,164,232,224,240,232,220,224,"Sleek machine with strong qualifying pace."],
      ["Grand Prix de Blackridge","Steel Dominion #8",     192,186,206,198,194,184,176,168,180,172,172,176,"Durability experts. Strong in long races."],
      ["Grand Prix de Blackridge","Blackridge Thunder",   280,272,234,226,162,152,260,252,268,260,248,252,"Thunder down every straight."],
      ["Grand Prix de Blackridge","Apex Prestige",        220,214,216,208,182,172,204,196,208,200,196,200,"Prestige name, prestige pace."],
      ["Grand Prix de Blackridge","Grand Slam Racing",    266,258,230,222,170,160,246,238,254,246,232,236,"All-or-nothing race strategy."],
      ["Grand Prix de Blackridge","Zero Limits FC",       294,286,242,234,154,144,274,266,282,274,260,264,"Name says it all. Fastest in qualifying."],
      ["Grand Prix de Blackridge","Meridian Works #9",    208,202,212,204,186,176,192,184,196,188,184,188,"Solid all-rounder from a rival city."],
      ["Grand Prix de Blackridge","Blackridge Circuit Co",240,232,222,214,180,172,220,212,228,220,208,212,"Home circuit advantage. Knows every inch."],
      ["Grand Prix de Blackridge","Summit Grand Prix",    256,248,226,218,174,164,236,228,244,236,224,228,"Altitude specialists adapting to the GP."],
      ["Grand Prix de Blackridge","Apex Finale",          276,268,234,226,166,156,256,248,264,256,244,248,"Always saves best for the big show."],
      ["Grand Prix de Blackridge","Omega Works FC",       230,224,218,210,180,172,212,204,220,212,200,204,"Late-season form. Dangerous."],
      ["Grand Prix de Blackridge","Neon Circuit GP #10",  284,276,238,230,158,148,264,256,272,264,252,256,"Street DNA meets GP engineering."],
      ["Grand Prix de Blackridge","Iron Grand Prix",      200,196,210,202,190,180,184,176,188,180,180,184,"Mountain-hardened machine."],
      ["Grand Prix de Blackridge","Velocity Sovereign",   260,252,228,220,172,164,240,232,248,240,228,232,"Top-5 every race. Waiting for a win."],
      ["Grand Prix de Blackridge","Blackridge Champion",  300,292,244,236,160,152,280,272,288,280,268,272,"The defending champion. The car to beat."],
      ["Grand Prix de Blackridge","Apex Unlimited",       212,206,216,208,184,176,196,188,200,192,192,196,"No limits on ambition. Sometimes on speed."],
    ];
    for (const [cn, n, spd, acc, hdl, stab, dur, wght, brk, ctrl, shift, eff, grip, corn, desc] of _npc12) {
      const cid = _getC2(cn);
      if (cid) _ins12.run(cid, n, spd, acc, hdl, stab, dur, wght, brk, ctrl, shift, eff, grip, corn, desc);
    }
    db.prepare("INSERT INTO meta (key, value) VALUES ('npc_cars_12stats_backfill_v3', '1')").run();
  }

  // Backfill: give any user without a workshop_upgrades row a default one
  const workshopBackfill = db.prepare("SELECT value FROM meta WHERE key = 'workshop_upgrades_backfill_v1'").get();
  if (!workshopBackfill) {
    const usersWithoutUpgrades = db.prepare(
      `SELECT u.id FROM users u WHERE NOT EXISTS (SELECT 1 FROM workshop_upgrades w WHERE w.user_id = u.id)`
    ).all() as { id: number }[];
    for (const user of usersWithoutUpgrades) {
      db.prepare(`INSERT OR IGNORE INTO workshop_upgrades (user_id) VALUES (?)`).run(user.id);
    }
    db.prepare("INSERT INTO meta (key, value) VALUES ('workshop_upgrades_backfill_v1', '1')").run();
  }

  // Backfill: migrate workshop_upgrades from absolute values to upgrade levels
  const workshopLevelMigration = db.prepare("SELECT value FROM meta WHERE key = 'workshop_upgrades_level_migration_v1'").get();
  if (!workshopLevelMigration) {
    db.prepare(`
      UPDATE workshop_upgrades SET
        develop_slots = MAX(0, develop_slots - 2),
        develop_speed = MAX(0, develop_speed - 1),
        inventory_size = 0,
        engineer_cap = MAX(0, (engineer_cap - 4) / 2),
        driver_cap = MAX(0, (driver_cap - 4) / 2),
        garage_cap = MAX(0, (garage_cap - 10) / 5)
    `).run();
    db.prepare("INSERT INTO meta (key, value) VALUES ('workshop_upgrades_level_migration_v1', '1')").run();
  }

  // Backfill: migrate garage_cap from old formula (base=10, inc=5) to new (base=20, inc=10)
  // Old value at level L = 10 + L*5. New level = MAX(0, floor((old_value - 20) / 10))
  // Since levels stored as upgrade counts (not absolute values), old level L → new level = MAX(0, floor((10 + L*5 - 20) / 10)) = MAX(0, floor((L*5 - 10) / 10))
  const garageMigration = db.prepare("SELECT value FROM meta WHERE key = 'garage_cap_formula_migration_v1'").get();
  if (!garageMigration) {
    db.prepare(`
      UPDATE workshop_upgrades SET
        garage_cap = MAX(0, (10 + garage_cap * 5 - 20) / 10)
    `).run();
    db.prepare("INSERT INTO meta (key, value) VALUES ('garage_cap_formula_migration_v1', '1')").run();
  }

  // Backfill: hard-reset all workshop_upgrade levels to 0 (corrects any corruption from old migrations)
  const workshopResetV2 = db.prepare("SELECT value FROM meta WHERE key = 'workshop_upgrades_reset_v2'").get();
  if (!workshopResetV2) {
    db.prepare(`
      UPDATE workshop_upgrades SET
        develop_slots = 0,
        develop_speed = 0,
        inventory_size = 0,
        inventory_mats_size = 0,
        engineer_cap = 0,
        driver_cap = 0,
        garage_cap = 0,
        market_mat_slots = 0
    `).run();
    db.prepare("INSERT INTO meta (key, value) VALUES ('workshop_upgrades_reset_v2', '1')").run();
  }

  // Backfill: ensure gacha_pity rows exist for all users
  const gachaPityBackfill = db.prepare("SELECT value FROM meta WHERE key = 'gacha_pity_backfill_v1'").get();
  if (!gachaPityBackfill) {
    const allUsers = db.prepare(`SELECT id FROM users`).all() as { id: number }[];
    for (const user of allUsers) {
      db.prepare(`INSERT OR IGNORE INTO gacha_pity (user_id, banner, pity_count) VALUES (?, 'driver', 0)`).run(user.id);
      db.prepare(`INSERT OR IGNORE INTO gacha_pity (user_id, banner, pity_count) VALUES (?, 'engineer', 0)`).run(user.id);
    }
    db.prepare("INSERT INTO meta (key, value) VALUES ('gacha_pity_backfill_v1', '1')").run();
  }

  // Backfill: give any user without a starter driver one
  const starterBackfill = db.prepare("SELECT value FROM meta WHERE key = 'starter_driver_backfill_v1'").get();
  if (!starterBackfill) {
    const usersWithoutDrivers = db.prepare(
      `SELECT u.id FROM users u WHERE NOT EXISTS (SELECT 1 FROM drivers d WHERE d.user_id = u.id)`
    ).all() as { id: number }[];
    if (usersWithoutDrivers.length > 0) {
      const commonTemplate = db.prepare("SELECT id FROM driver_templates WHERE rarity = 'common' LIMIT 1").get() as { id: number } | undefined;
      if (commonTemplate) {
        for (const user of usersWithoutDrivers) {
          db.prepare(
            "INSERT INTO drivers (user_id, template_id, speed, skill, stamina, aggression) SELECT ?, id, base_speed, base_skill, base_stamina, base_aggression FROM driver_templates WHERE id = ?"
          ).run(user.id, commonTemplate.id);
        }
      }
    }
    db.prepare("INSERT INTO meta (key, value) VALUES ('starter_driver_backfill_v1', '1')").run();
  }

  // Backfill: give any user without a starter engineer one
  const starterEngineerBackfill = db.prepare("SELECT value FROM meta WHERE key = 'starter_engineer_backfill_v1'").get();
  if (!starterEngineerBackfill) {
    const usersWithoutEngineers = db.prepare(
      `SELECT u.id FROM users u WHERE NOT EXISTS (SELECT 1 FROM engineers e WHERE e.user_id = u.id)`
    ).all() as { id: number }[];
    if (usersWithoutEngineers.length > 0) {
      const commonEngineer = db.prepare("SELECT id FROM engineer_templates WHERE rarity = 'common' LIMIT 1").get() as { id: number } | undefined;
      if (commonEngineer) {
        for (const user of usersWithoutEngineers) {
          db.prepare(
            `INSERT INTO engineers (user_id, template_id, craft_speed, quality_bonus, race_bonus)
             SELECT ?, id, base_craft_speed, base_quality_bonus, base_race_bonus FROM engineer_templates WHERE id = ?`
          ).run(user.id, commonEngineer.id);
        }
      }
    }
    db.prepare("INSERT INTO meta (key, value) VALUES ('starter_engineer_backfill_v1', '1')").run();
  }

  // Backfill: give any user without a starter materials kit some starting materials
  const starterMatsBackfill = db.prepare("SELECT value FROM meta WHERE key = 'starter_materials_backfill_v1'").get();
  if (!starterMatsBackfill) {
    const usersWithoutMats = db.prepare(
      `SELECT u.id FROM users u WHERE NOT EXISTS (SELECT 1 FROM inventory_materials im WHERE im.user_id = u.id)`
    ).all() as { id: number }[];
    if (usersWithoutMats.length > 0) {
      const matIds = db.prepare(`SELECT id, name FROM materials`).all() as { id: number; name: string }[];
      const starterQty: Record<string, number> = {
        "Steel": 10, "Aluminum": 8, "Carbon": 4, "Titanium": 2,
        "Polymer": 6, "Hardware": 8, "Electronics": 4, "Compounds": 4,
        "Fluids": 6, "Trims": 4,
      };
      for (const user of usersWithoutMats) {
        for (const mat of matIds) {
          const qty = starterQty[mat.name] ?? 2;
          db.prepare(`INSERT OR IGNORE INTO inventory_materials (user_id, material_id, quantity) VALUES (?, ?, ?)`)
            .run(user.id, mat.id, qty);
        }
      }
    }
    db.prepare("INSERT INTO meta (key, value) VALUES ('starter_materials_backfill_v1', '1')").run();
  }

  // Backfill: give all users 300 xgear starter
  const xgearBackfill = db.prepare("SELECT value FROM meta WHERE key = 'xgear_starter_backfill_v2'").get();
  if (!xgearBackfill) {
    db.prepare(`UPDATE users SET xgear = MAX(xgear, 300) WHERE xgear < 300`).run();
    db.prepare("INSERT INTO meta (key, value) VALUES ('xgear_starter_backfill_v2', '1')").run();
  }

  // Backfill: give user id=1 two of every blueprint for testing
  const blueprintBackfill = db.prepare("SELECT value FROM meta WHERE key = 'user1_blueprints_backfill_v1'").get();
  if (!blueprintBackfill) {
    const user1 = db.prepare("SELECT id FROM users WHERE id = 1").get() as { id: number } | undefined;
    if (user1) {
      const carTemplates = db.prepare("SELECT id FROM car_templates").all() as { id: number }[];
      for (const ct of carTemplates) {
        db.prepare(
          `INSERT INTO user_blueprints (user_id, car_template_id, quantity)
           VALUES (1, ?, 2)
           ON CONFLICT(user_id, car_template_id) DO UPDATE SET quantity = MAX(quantity, 2)`
        ).run(ct.id);
      }
    }
    db.prepare("INSERT INTO meta (key, value) VALUES ('user1_blueprints_backfill_v1', '1')").run();
  }

  if (seeded) return;

  // ============================================================
  // MATERIALS (10 types, no rarity)
  // ============================================================

  const insertMaterial = db.prepare(`
    INSERT OR IGNORE INTO materials (name, description, art, base_value)
    VALUES (?, ?, ?, ?)
  `);

  const materialsData: Array<[string, string, string, number]> = [
    ["Steel",       "Structural steel for frames and gearboxes.",               "steel",       15],
    ["Aluminum",    "Lightweight alloy for suspension components.",              "aluminum",    20],
    ["Carbon",      "Carbon fiber for chassis and tire compounds.",              "carbon",      60],
    ["Titanium",    "High-strength metal for engines and brakes.",               "titanium",   120],
    ["Polymer",     "Synthetic polymer for tire manufacturing.",                 "polymer",     18],
    ["Hardware",    "Nuts, bolts, and precision fasteners.",                     "hardware",    10],
    ["Electronics", "Sensors, chips, and electronic control units.",             "electronics", 45],
    ["Compounds",   "Chemical compounds for suspension and tire formulations.",  "compounds",   25],
    ["Fluids",      "Engine oils, brake fluid, and cooling liquids.",            "fluids",      12],
    ["Trims",       "Body trims, seals, and finishing materials for chassis.",   "trims",       22],
  ];

  for (const m of materialsData) insertMaterial.run(...m);

  // Fetch material IDs by name for recipe building
  const getMat = (name: string): number => {
    const row = db.prepare("SELECT id FROM materials WHERE name = ?").get(name) as { id: number } | undefined;
    if (!row) throw new Error(`Material not found: ${name}`);
    return row.id;
  };

  // ============================================================
  // PART TEMPLATES (6 categories, one template each)
  // Recipes: ENGINE=Titanium+Hardware+Fluids, SUSPENSION=Aluminum+Hardware+Compounds,
  //          CHASSIS=Carbon+Steel+Trims, BRAKES=Titanium+Electronics+Fluids,
  //          GEARBOX=Steel+Hardware+Electronics, TIRES=Carbon+Compounds+Polymer
  // ============================================================

  const insertPart = db.prepare(`
    INSERT OR IGNORE INTO part_templates
      (name, category, art,
       stat_speed, stat_acceleration, stat_handling, stat_stability,
       stat_durability, stat_weight, stat_braking, stat_control,
       stat_shift_speed, stat_efficiency, stat_grip, stat_cornering,
       craft_time, sell_price, recipe)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // [name, category, art, spd, acc, hdl, stb, dur, wgt, brk, ctl, shft, eff, grp, cor, craftTime, sellPrice, recipe_fn]
  type PartRow = [string, string, string, number, number, number, number, number, number, number, number, number, number, number, number, number, number, () => string];

  const partTemplates: PartRow[] = [
    [
      "Engine", "engine", "engine",
      20, 18, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      600, 1200,
      () => JSON.stringify([
        { material_id: getMat("Titanium"), qty: 3 },
        { material_id: getMat("Hardware"), qty: 4 },
        { material_id: getMat("Fluids"),   qty: 2 },
      ]),
    ],
    [
      "Suspension", "suspension", "suspension",
      0, 0, 18, 15, 0, 0, 0, 0, 0, 0, 0, 0,
      400, 800,
      () => JSON.stringify([
        { material_id: getMat("Aluminum"),  qty: 3 },
        { material_id: getMat("Hardware"),  qty: 3 },
        { material_id: getMat("Compounds"), qty: 2 },
      ]),
    ],
    [
      "Chassis", "chassis", "chassis",
      0, 0, 0, 0, 20, 15, 0, 0, 0, 0, 0, 0,
      500, 1000,
      () => JSON.stringify([
        { material_id: getMat("Carbon"), qty: 3 },
        { material_id: getMat("Steel"),  qty: 3 },
        { material_id: getMat("Trims"),  qty: 2 },
      ]),
    ],
    [
      "Brakes", "brakes", "brakes",
      0, 0, 0, 0, 0, 0, 20, 16, 0, 0, 0, 0,
      350, 700,
      () => JSON.stringify([
        { material_id: getMat("Titanium"),    qty: 2 },
        { material_id: getMat("Electronics"), qty: 2 },
        { material_id: getMat("Fluids"),      qty: 3 },
      ]),
    ],
    [
      "Gearbox", "gearbox", "gearbox",
      0, 0, 0, 0, 0, 0, 0, 0, 18, 16, 0, 0,
      450, 900,
      () => JSON.stringify([
        { material_id: getMat("Steel"),       qty: 4 },
        { material_id: getMat("Hardware"),    qty: 3 },
        { material_id: getMat("Electronics"), qty: 2 },
      ]),
    ],
    [
      "Tires", "tires", "tires",
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 18, 16,
      300, 600,
      () => JSON.stringify([
        { material_id: getMat("Carbon"),    qty: 2 },
        { material_id: getMat("Compounds"), qty: 3 },
        { material_id: getMat("Polymer"),   qty: 3 },
      ]),
    ],
  ];

  for (const [name, cat, art, spd, acc, hdl, stb, dur, wgt, brk, ctl, shft, eff, grp, cor, ct, sp, recipeFn] of partTemplates) {
    insertPart.run(name, cat, art, spd, acc, hdl, stb, dur, wgt, brk, ctl, shft, eff, grp, cor, ct, sp, recipeFn());
  }

  // ============================================================
  // CAR TEMPLATES (6 models across 3 archetypes)
  // base stats: sports lean speed/acceleration, luxury lean stability/control, classic lean durability/efficiency
  // ============================================================

  const insertCar = db.prepare(`
    INSERT OR IGNORE INTO car_templates
      (name, model_code, archetype, art, description,
       base_speed, base_acceleration, base_handling, base_stability,
       base_durability, base_weight, base_braking, base_control,
       base_shift_speed, base_efficiency, base_grip, base_cornering)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Sports Cars — fast and aggressive, lower stability and durability
  // Luxury Cars — smooth and controlled, lower raw speed
  // Classic Cars — tough and efficient, lower acceleration and grip
  const carTemplates = [
    // name, model_code, archetype, art, desc, spd, acc, hdl, stb, dur, wgt, brk, ctl, shft, eff, grp, cor
    ["Blackridge SC-1", "SC-1", "sports_car", "sc_1",
      "Entry-level sports car. Lightweight and eager.",
      25, 22, 14, 10, 10, 12, 12, 10, 14, 10, 16, 14],
    ["Blackridge SC-2", "SC-2", "sports_car", "sc_2",
      "Track-focused evolution. More downforce, more speed.",
      32, 28, 18, 12, 12, 10, 14, 12, 18, 12, 20, 18],
    ["Blackridge LC-1", "LC-1", "luxury_car", "lc_1",
      "Refined performance meets premium comfort.",
      18, 15, 16, 20, 15, 16, 16, 18, 14, 16, 14, 16],
    ["Blackridge LC-2", "LC-2", "luxury_car", "lc_2",
      "The flagship luxury experience. Precision in every detail.",
      22, 18, 20, 25, 18, 14, 20, 22, 16, 20, 16, 20],
    ["Blackridge CC-1", "CC-1", "classic_car", "cc_1",
      "A storied classic. Built to last and built to earn.",
      14, 12, 14, 16, 22, 18, 14, 14, 12, 20, 12, 12],
    ["Blackridge CC-2", "CC-2", "classic_car", "cc_2",
      "The refined classic. Heritage meets modern engineering.",
      16, 14, 16, 18, 26, 16, 16, 16, 14, 24, 14, 14],
  ];

  for (const c of carTemplates) insertCar.run(...c);

  // ============================================================
  // DRIVER TEMPLATES
  // ============================================================

  const insertDriver = db.prepare(`
    INSERT OR IGNORE INTO driver_templates (name, nationality, art, base_speed, base_skill, base_stamina, base_aggression, rarity, unlock_cost, bio)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const drivers = [
    ["Marco Venti",  "Italian",  "marco_venti",  72, 68, 75, 80, "rare",      2500,  "A fiery Italian with an aggressive racing style honed on mountain roads."],
    ["Jin-ho Park",  "Korean",   "jin-ho_park",  80, 85, 65, 60, "epic",      6000,  "Precision personified. Jin-ho calculates every apex to the millimeter."],
    ["Aisha Okafor", "Nigerian", "aisha_okafor", 65, 70, 90, 55, "rare",      3000,  "Known for her relentless pace and ability to preserve tyres unlike anyone else."],
    ["Rex Dalton",   "American", "rex_dalton",   85, 60, 55, 95, "epic",      5500,  "The Wrecking Ball. Rex wins races but doesn't always finish them cleanly."],
    ["Yuki Tanaka",  "Japanese", "yuki_tanaka",  60, 90, 80, 45, "legendary", 15000, "A legend of the circuit. Yuki's technical mastery is unmatched."],
    ["Carlos Reyes", "Mexican",  "carlos_reyes", 55, 55, 60, 65, "common",    800,   "A hungry rookie still finding his rhythm on the track."],
    ["Emma Fischer", "German",   "emma_fischer", 70, 75, 70, 70, "rare",      3500,  "Balanced and methodical. Emma rarely makes mistakes."],
    ["Luca Romano",  "Italian",  "luca_romano",  50, 50, 55, 60, "common",    500,   "Fresh off the kart circuit. Raw potential waiting to be unlocked."],
  ];

  for (const d of drivers) insertDriver.run(...d);

  // ============================================================
  // ENGINEER TEMPLATES
  // ============================================================

  const insertEngineer = db.prepare(`
    INSERT OR IGNORE INTO engineer_templates (name, nationality, art, base_craft_speed, base_quality_bonus, base_race_bonus, rarity, unlock_cost, bio)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const engineerTemplates = [
    ["Tomas Varga",   "Hungarian", "tomas_varga",   45, 48, 15, "common",    500,   "A steady wrench-turner fresh from vocational school. Reliable but slow."],
    ["Priya Nair",    "Indian",    "priya_nair",    55, 60, 18, "common",    800,   "Meticulous and detail-oriented. Her builds rarely fail quality checks."],
    ["Hans Brecker",  "German",    "hans_brecker",  70, 72, 25, "rare",      2500,  "Old-school precision engineering. Every bolt torqued to spec."],
    ["Sofia Matos",   "Brazilian", "sofia_matos",   65, 80, 22, "rare",      3000,  "Specializes in aerodynamic tuning. Her aero kits add real downforce."],
    ["Kenji Inoue",   "Japanese",  "kenji_inoue",   85, 75, 35, "epic",      6000,  "Lightning-fast assembly with near-zero defects. A workshop legend."],
    ["Ava Chen",      "Canadian",  "ava_chen",      75, 90, 30, "epic",      5500,  "Quality obsessive. Her parts routinely exceed spec by 10%."],
    ["Viktor Molnár", "Austrian",  "viktor_molnar", 95, 95, 50, "legendary", 15000, "The Architect. Viktor's builds have won championship titles across three continents."],
    ["Rosa Delgado",  "Spanish",   "rosa_delgado",  50, 52, 20, "common",    600,   "Hard worker still building her reputation. Potential waiting to emerge."],
  ];

  for (const e of engineerTemplates) insertEngineer.run(...e);

  // ============================================================
  // RACE CIRCUITS (5 circuits)
  // reward_materials reference new material IDs
  // ============================================================

  const insertCircuit = db.prepare(`
    INSERT OR IGNORE INTO circuits
      (name, location, art, difficulty, laps, reward_credits, reward_materials, reward_prestige,
       unlock_level, description, archetype, min_speed, min_handling, duration_seconds, podium_rewards,
       entry_cost, field_size)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const getMatId = (name: string): number => {
    const row = db.prepare("SELECT id FROM materials WHERE name = ?").get(name) as { id: number } | undefined;
    if (!row) throw new Error(`Material not found: ${name}`);
    return row.id;
  };

  // Podium rewards: {position, credits_bonus, xgear_bonus, mat_count, prestige_bonus}
  // mat_count = number of random materials awarded (0 = none)
  const podium1 = JSON.stringify([
    {position:1,credits_bonus:10000,xgear_bonus:2,mat_count:10,prestige_bonus:5},
    {position:2,credits_bonus:5000, xgear_bonus:0,mat_count:10,prestige_bonus:2},
    {position:3,credits_bonus:2000, xgear_bonus:0,mat_count:5, prestige_bonus:1},
  ]);
  const podium2 = JSON.stringify([
    {position:1,credits_bonus:25000,xgear_bonus:3,mat_count:20,prestige_bonus:10},
    {position:2,credits_bonus:15000,xgear_bonus:0,mat_count:10,prestige_bonus:5},
    {position:3,credits_bonus:5000, xgear_bonus:0,mat_count:10,prestige_bonus:2},
  ]);
  const podium3 = JSON.stringify([
    {position:1,credits_bonus:40000,xgear_bonus:5,mat_count:30,prestige_bonus:20},
    {position:2,credits_bonus:20000,xgear_bonus:0,mat_count:20,prestige_bonus:8},
    {position:3,credits_bonus:10000,xgear_bonus:0,mat_count:10,prestige_bonus:4},
  ]);
  const podium4 = JSON.stringify([
    {position:1,credits_bonus:75000,xgear_bonus:7,mat_count:50,prestige_bonus:35},
    {position:2,credits_bonus:30000,xgear_bonus:0,mat_count:30,prestige_bonus:15},
    {position:3,credits_bonus:15000,xgear_bonus:0,mat_count:10,prestige_bonus:6},
  ]);
  const podium5 = JSON.stringify([
    {position:1,credits_bonus:500000,xgear_bonus:20,mat_count:100,prestige_bonus:100},
    {position:2,credits_bonus:150000,xgear_bonus:5, mat_count:50, prestige_bonus:40},
    {position:3,credits_bonus:50000, xgear_bonus:3, mat_count:20, prestige_bonus:15},
  ]);

  const circuits = [
    // name, loc, art, diff, laps, base_credits, rewardFn, base_prestige, ul, desc, arch, ms, mh, dur, pod, entry_cost, field_size
    ["Ridgeport Oval",           "Ridgeport, CA",  "ridgeport_oval",           1, 10, 0,
      () => JSON.stringify([]),
      0,  1,  "A simple oval track. Perfect for newcomers to find their feet.",
      null, 0, 0, 120, podium1, 1000, 5],
    ["Blackwater Bay Circuit",   "Blackwater, FL", "blackwater_bay_circuit",   2, 15, 0,
      () => JSON.stringify([]),
      0, 2,  "Coastal winds make this technical circuit deceptively challenging.",
      null, 0, 0, 240, podium2, 3000, 8],
    ["Iron Peak Mountain Pass",  "Iron Peak, CO",  "iron_peak_mountain_pass",  3, 8,  0,
      () => JSON.stringify([]),
      0, 3,  "High altitude hairpins test driver skill and mechanical endurance.",
      null, 55, 50, 360, podium3, 5000, 10],
    ["Neon District Street Race","Meridian City",  "neon_district_street_race", 4, 12, 0,
      () => JSON.stringify([]),
      0, 5, "Illegal? Maybe. Legendary? Absolutely.",
      null, 70, 60, 480, podium4, 10000, 12],
    ["Grand Prix de Blackridge", "Blackridge HQ",  "grand_prix_de_blackridge",  5, 20, 0,
      () => JSON.stringify([]),
      0, 10, "The ultimate stage. Only the best brands compete here.",
      null, 85, 80, 600, podium5, 50000, 20],
  ];

  for (const [name, loc, art, diff, laps, cred, rewardFn, pres, ul, desc, arch, ms, mh, dur, pod, ec, fs] of circuits) {
    insertCircuit.run(name, loc, art, diff, laps, cred, (rewardFn as () => string)(), pres, ul, desc, arch, ms, mh, dur, pod, ec, fs);
  }

  // Backfill art for existing circuit rows that predate this column
  const updateCircuitArt = db.prepare(`UPDATE circuits SET art = ? WHERE name = ? AND (art IS NULL OR art = '')`);
  for (const [name, , art] of circuits) {
    updateCircuitArt.run(art as string, name as string);
  }

  // ============================================================
  // RECRUIT BANNERS
  // ============================================================

  const insertBanner = db.prepare(`
    INSERT OR IGNORE INTO recruit_banners (name, art, banner_type, description, is_event, active, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Check if banners already seeded
  const bannerCount = (db.prepare(`SELECT COUNT(*) as c FROM recruit_banners`).get() as { c: number }).c;
  if (bannerCount === 0) {
    const banners = [
      // name, art, type, desc, is_event, active, sort_order
      ["Standard Driver Recruit",   "banner_standard_driver",   "driver",   "Roll for a driver to join your team. Higher rarity drivers deliver better race performance.", 0, 1, 0],
      ["Standard Engineer Recruit", "banner_standard_engineer", "engineer", "Roll for an engineer to boost your workshop. Better engineers craft faster with higher quality.", 0, 1, 1],
    ];
    for (const b of banners) insertBanner.run(...b);
  }

  // ============================================================
  // MARKET: MATERIAL SLOTS (6 rotating slots)
  // ============================================================

  const insertMatSlot = db.prepare(`
    INSERT OR IGNORE INTO market_material_slots (slot_index, material_id, quantity, price_per_unit, refresh_at)
    VALUES (?, ?, ?, ?, 0)
  `);

  const matSlots = [
    [0, getMatId("Steel"),       20, 18],
    [1, getMatId("Hardware"),    18, 12],
    [2, getMatId("Aluminum"),    15, 22],
    [3, getMatId("Polymer"),     12, 20],
    [4, getMatId("Carbon"),       6, 70],
    [5, getMatId("Titanium"),     3, 140],
  ];

  for (const s of matSlots) insertMatSlot.run(...s);

  // ============================================================
  // MARKET: PART LISTINGS (initial 6 listings, one per category)
  // ============================================================

  const now = Math.floor(Date.now() / 1000);
  const insertPartListing = db.prepare(`
    INSERT OR IGNORE INTO market_part_listings (part_id, price, quantity, listed_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const getPartId = (name: string): number => {
    const row = db.prepare("SELECT id FROM part_templates WHERE name = ?").get(name) as { id: number } | undefined;
    if (!row) throw new Error(`Part not found: ${name}`);
    return row.id;
  };

  const partListings = [
    [getPartId("Engine"),     1400, 1, now, now + 3600],
    [getPartId("Suspension"),  900, 2, now, now + 3600],
    [getPartId("Chassis"),    1100, 1, now, now + 3600],
    [getPartId("Brakes"),      780, 2, now, now + 3600],
    [getPartId("Gearbox"),    1000, 1, now, now + 3600],
    [getPartId("Tires"),       680, 2, now, now + 3600],
  ];

  for (const p of partListings) insertPartListing.run(...p);

  // ============================================================
  // LEVEL REQUIREMENTS (prestige system, levels 2-10)
  // ============================================================

  const insertLevel = db.prepare(`
    INSERT OR IGNORE INTO level_requirements (level, prestige_cost, credits_cost)
    VALUES (?, ?, ?)
  `);

  const levelReqs: [number, number, number][] = [
    [2,   50,   100000],
    [3,   100,  200000],
    [4,   200,  300000],
    [5,   300,  500000],
    [6,   400,  750000],
    [7,   500,  1000000],
    [8,   600,  1500000],
    [9,   700,  2000000],
    [10,  1000, 5000000],
  ];

  for (const [lvl, pres, cred] of levelReqs) insertLevel.run(lvl, pres, cred);

  // ============================================================
  // NPC CARS per circuit
  // Pool sizes: Ridgeport=10, Blackwater=16, Iron Peak=20, Neon=24, Grand Prix=40
  // Stats are balanced around what a player car at that tier would look like.
  // ============================================================

  const insertNpc = db.prepare(`
    INSERT OR IGNORE INTO npc_cars
      (circuit_id, name, stat_speed, stat_acceleration, stat_handling, stat_stability,
       stat_durability, stat_weight, stat_braking, stat_control,
       stat_shift_speed, stat_efficiency, stat_grip, stat_cornering, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const getCircuitId = (name: string): number => {
    const row = db.prepare("SELECT id FROM circuits WHERE name = ?").get(name) as { id: number } | undefined;
    if (!row) throw new Error(`Circuit not found: ${name}`);
    return row.id;
  };

  // Helper to check if NPC cars already seeded for a circuit
  const npcExists = (circuitId: number): boolean => {
    const row = db.prepare("SELECT COUNT(*) as c FROM npc_cars WHERE circuit_id = ?").get(circuitId) as { c: number };
    return row.c > 0;
  };

  // [name, spd, accel, hdl, stab, dur, wght, brk, ctrl, shift, eff, grip, corn, desc]
  type NpcRow = [string, number, number, number, number, number, number, number, number, number, number, number, number, string];

  // --- Ridgeport Oval (10 NPC cars, beginner tier)
  const ridgeportId = getCircuitId("Ridgeport Oval");
  if (!npcExists(ridgeportId)) {
    const ridgeportNpcs: NpcRow[] = [
      ["Garrett #12",     54,50,44,40,60,64,40,36,44,36,36,40,"Local oval regular. Consistent but slow."],
      ["Team Apex #7",    70,60,56,50,56,60,52,44,56,48,44,48,"Amateur team with decent speed."],
      ["Rookie Racer #3", 44,40,36,32,70,76,30,28,36,32,28,32,"First season driver. Survives more than wins."],
      ["Sandy Cruz",      64,56,48,44,64,68,44,40,52,44,40,44,"Weekend warrior with a tuned street car."],
      ["Bolt Motorsport", 76,68,60,52,50,56,56,48,60,52,50,52,"Small outfit with a quick machine."],
      ["Dale Vickers",    52,44,40,36,76,80,32,28,40,32,32,32,"Veteran driver, old slow car."],
      ["Circuit Kings #2",80,72,64,56,52,56,60,52,64,56,52,56,"Local hotshoe. Dangerous on the straight."],
      ["Freeway Foxes",   60,52,52,44,60,64,44,40,48,40,40,44,"Balanced backmarker team."],
      ["Iron Fist #9",    68,60,56,48,68,72,48,44,56,48,44,48,"Tough car, average driver."],
      ["Dusty Roads Co",  48,40,44,36,80,84,28,24,36,28,24,28,"Built for endurance, not speed."],
    ];
    for (const [n,spd,acc,hdl,stab,dur,wght,brk,ctrl,shift,eff,grip,corn,desc] of ridgeportNpcs) {
      insertNpc.run(ridgeportId,n,spd,acc,hdl,stab,dur,wght,brk,ctrl,shift,eff,grip,corn,desc);
    }
  }

  // --- Blackwater Bay Circuit (16 NPC cars, intermediate tier)
  const blackwaterId = getCircuitId("Blackwater Bay Circuit");
  if (!npcExists(blackwaterId)) {
    const blackwaterNpcs: NpcRow[] = [
      ["Coastal Speed Co",  96,88,80,72,70,72,72,64,80,72,68,72,"Seaside team with a quick sports car."],
      ["Bay Runners #1",    110,100,90,80,76,76,84,76,88,80,80,84,"Regional contender. Knows every corner."],
      ["Storm Lap Racing",  84,80,76,68,84,88,64,56,72,64,60,64,"Aggressive style, tends to overcook corners."],
      ["Tidal Force #4",    120,110,100,88,64,64,92,80,100,88,88,92,"Fast but fragile. All or nothing."],
      ["Crosswind Motors",  90,84,88,80,88,88,72,64,80,72,72,76,"Handles the bay wind better than most."],
      ["Gulf Circuit Team", 104,96,96,88,80,80,80,72,88,80,76,80,"Solid mid-field presence."],
      ["Seabreeze #11",     76,72,84,76,96,96,56,52,68,60,56,60,"Technical driver, slower car."],
      ["Aqua Drift Co",     116,104,92,84,72,72,88,76,96,88,88,92,"Flashy livery, real pace."],
      ["Harbor Line Racing",86,82,80,72,90,92,68,60,76,68,64,68,"Consistent finisher, never spectacular."],
      ["Tide Surge #6",     130,120,104,92,60,60,100,88,108,96,100,104,"Top of the field. Hard to beat on raw pace."],
      ["Windward Works",    80,76,76,68,100,104,56,48,64,56,52,56,"Durable car, cautious team."],
      ["Breaker Point FC",  100,92,92,84,76,76,76,68,84,76,72,76,"Local favorite with a loyal crew."],
      ["Saltflat Speed",    88,84,84,76,84,84,68,60,76,68,64,68,"Balanced all-rounder."],
      ["Bay Area Bolts",    124,112,100,88,68,68,96,84,104,92,92,96,"Young team, big talent."],
      ["Shoreline SC #8",   72,68,72,64,104,108,48,44,60,52,44,48,"Slow but finishes races others don't."],
      ["Lagoon Racers",     108,100,88,80,80,80,80,72,88,80,76,80,"Mid-pack threat on a good day."],
    ];
    for (const [n,spd,acc,hdl,stab,dur,wght,brk,ctrl,shift,eff,grip,corn,desc] of blackwaterNpcs) {
      insertNpc.run(blackwaterId,n,spd,acc,hdl,stab,dur,wght,brk,ctrl,shift,eff,grip,corn,desc);
    }
  }

  // --- Iron Peak Mountain Pass (20 NPC cars, hard tier)
  const ironPeakId = getCircuitId("Iron Peak Mountain Pass");
  if (!npcExists(ironPeakId)) {
    const ironPeakNpcs: NpcRow[] = [
      ["Summit Racing #1",  130,120,140,136,110,108,124,120,116,112,124,128,"Mountain specialist. Pinpoint braking."],
      ["Alpine Works",      144,136,130,124,100,100,136,128,130,124,120,124,"High altitude setup, fast on the climbs."],
      ["Peak Motorsport",   116,110,136,132,120,116,112,108,110,104,116,120,"Technical team focused on the technical sections."],
      ["Crestline FC",      160,150,144,140,96,92,144,136,144,136,136,140,"Front runner. Scares everyone at the hairpins."],
      ["Ironside Racing",   110,104,124,120,130,128,104,100,104,100,108,112,"Durable build suits the rough mountain surface."],
      ["Altitude Speed Co", 150,140,136,132,104,100,136,128,136,128,128,132,"Quick and consistent up top."],
      ["Pinnacle Motors",   120,114,150,148,116,112,116,112,116,112,132,136,"Handling specialist. Brilliant through the bends."],
      ["Ridge Runners #3",  136,128,120,116,110,108,124,116,124,116,116,120,"Aggressive pacing from the gun."],
      ["Cliff Edge Racing", 104,100,116,112,140,140,96,92,100,96,104,108,"Safer, slower, but always there at the end."],
      ["Rockface FC #7",    164,156,140,136,92,88,152,144,148,140,140,144,"Flat-out pace. Edge of the cliff every lap."],
      ["Granite Works",     128,120,132,128,120,116,116,112,120,116,116,120,"Mid-field mountain regular."],
      ["Skyline Speed",     140,132,128,124,110,108,128,120,128,120,120,124,"Good all-round package."],
      ["Switchback SC",     114,108,144,144,124,120,108,104,110,108,128,132,"The best handling car in the field."],
      ["Cloud Cap Racing",  152,144,132,128,100,96,140,132,140,132,124,128,"Strong pace on the long straights."],
      ["Tundra Motorsport", 100,96,120,116,144,144,88,84,96,92,100,104,"Built for survival, not speed."],
      ["Highpass FC #10",   168,160,136,132,88,84,156,148,152,144,140,144,"Highest speed car here. Reckless but rapid."],
      ["Snowline Speed",    124,116,128,124,116,112,116,108,116,110,112,116,"Reliable points scorer."],
      ["Crater Works",      108,104,140,140,132,128,100,96,104,100,124,128,"Technical brilliance in a slow car."],
      ["Summit Sharks #2",  156,148,144,140,100,96,144,136,144,136,132,136,"Top-three threat every race."],
      ["Iron Pass FC",      132,124,124,120,120,116,120,116,120,116,116,120,"Veteran mountain team. Never surprised."],
    ];
    for (const [n,spd,acc,hdl,stab,dur,wght,brk,ctrl,shift,eff,grip,corn,desc] of ironPeakNpcs) {
      insertNpc.run(ironPeakId,n,spd,acc,hdl,stab,dur,wght,brk,ctrl,shift,eff,grip,corn,desc);
    }
  }

  // --- Neon District Street Race (24 NPC cars, elite tier)
  const neonId = getCircuitId("Neon District Street Race");
  if (!npcExists(neonId)) {
    const neonNpcs: NpcRow[] = [
      ["Night Shift Racing",  160,156,150,144,120,116,144,140,148,144,136,140,"Street regulars. Own the neon quarter."],
      ["Volt Syndicate #1",   190,180,160,152,110,104,170,164,176,168,160,164,"Electrifying pace through the city grid."],
      ["Urban Blur Co",       144,140,140,136,130,128,132,128,136,132,128,132,"Lower speed, high style."],
      ["Neon Kings #4",       210,200,176,168,100,96,190,184,196,188,180,184,"Top tier street machine. Almost unbeatable."],
      ["Grid Lock Racing",    150,144,156,152,136,132,140,136,144,140,140,144,"Technical urban specialist."],
      ["Street Phantom #9",   180,172,164,156,116,112,164,156,168,160,156,160,"Ghost of the street circuit. Deadly pace."],
      ["District Drift FC",   136,130,170,168,144,140,128,124,132,128,156,160,"Handling god. Corners at impossible speeds."],
      ["Midnight Works",      196,188,156,148,104,100,180,172,184,176,164,168,"Fastest car on the longest straight."],
      ["Neon Outlaws",        152,148,144,140,132,128,140,136,144,140,132,136,"Underground team with a surprise package."],
      ["Flash Motorsport #2", 184,176,160,152,112,108,168,160,172,164,156,160,"Consistent front-runner."],
      ["Circuit Ghosts",      140,136,152,148,140,136,132,128,136,132,136,140,"No star drivers, just a great car."],
      ["Apex City Racing",    200,192,168,160,104,100,184,176,188,180,168,172,"Apex every corner. Clinical execution."],
      ["Signal Break FC",     156,152,148,144,128,124,144,140,148,144,136,140,"Mid-field but punch above their weight."],
      ["Red Light District",  176,168,152,148,120,116,160,152,164,156,144,148,"Gritty team, tough to pass."],
      ["Voltage Drop SC",     132,128,160,160,148,144,124,120,128,124,148,152,"Handling focused in the city twisties."],
      ["Street Sovereign #5", 204,196,172,164,108,104,188,180,192,184,172,176,"City champion. Defends hard."],
      ["Lane Splitters",      148,144,140,136,136,132,136,132,140,136,128,132,"Never the fastest but always in the mix."],
      ["Grid Phantom Co",     192,184,164,156,112,108,176,168,180,172,160,164,"Slippery, quick, hard to catch."],
      ["Neon Rush #7",        164,160,152,148,124,120,152,144,156,148,144,148,"Fun team, decent pace."],
      ["Megawatt Motors",    216,208,180,172,96,92,200,192,204,196,184,188,"Absolute rocket. Fragile chassis."],
      ["Cityblock FC",        140,136,148,144,140,136,132,128,136,132,132,136,"Solid city car. Strong at night races."],
      ["Blacktop Syndicate",  172,164,156,152,120,116,160,152,164,156,144,148,"Streetwise and fast."],
      ["Urban Surge #3",      188,180,168,160,108,104,172,164,176,168,160,164,"High energy outfit. Always racing hard."],
      ["Neon Storm Racing",   156,152,144,140,128,124,144,136,148,140,132,136,"Veteran street team. Knows the tricks."],
    ];
    for (const [n,spd,acc,hdl,stab,dur,wght,brk,ctrl,shift,eff,grip,corn,desc] of neonNpcs) {
      insertNpc.run(neonId,n,spd,acc,hdl,stab,dur,wght,brk,ctrl,shift,eff,grip,corn,desc);
    }
  }

  // --- Grand Prix de Blackridge (40 NPC cars, championship tier)
  const grandPrixId = getCircuitId("Grand Prix de Blackridge");
  if (!npcExists(grandPrixId)) {
    const grandPrixNpcs: NpcRow[] = [
      ["Blackridge Works #1",  240,230,220,212,180,172,220,212,224,216,208,212,"Factory team. The benchmark everyone chases."],
      ["Apex Dynasty",         270,260,230,220,170,160,248,240,256,248,236,240,"Championship contender every season."],
      ["Iron Throne FC",        190,184,200,192,190,184,176,168,180,172,172,176,"Mid-field workhorse. Never beaten easily."],
      ["Crimson Circuit #3",   280,272,236,228,164,156,260,252,268,260,248,252,"On the limit every lap. Spectacular to watch."],
      ["Velocity Prime",       210,204,216,208,184,176,196,188,200,192,196,200,"Technically brilliant setup."],
      ["Grand Prix Ghosts",    256,248,224,216,176,168,236,228,240,232,224,228,"Experienced outfit. Rarely makes mistakes."],
      ["Zero Drag Works",      296,288,240,232,156,148,276,268,284,276,260,264,"Fastest straight-line speed in the field."],
      ["Carbon Crown Racing",  196,190,212,204,192,184,180,172,184,176,180,184,"All-round package. Threat anywhere."],
      ["Blackridge Elite #2",  264,256,228,220,172,164,244,236,252,244,232,236,"Sister team to the factory squad."],
      ["Speed Sovereign",      230,224,220,212,180,172,212,204,216,208,204,208,"Consistent top-5 material."],
      ["Formula Works FC",     284,276,232,224,160,152,264,256,272,264,252,256,"Ex-formula team. Aggressive setup."],
      ["Pinnacle Grand Prix",  200,196,210,204,188,180,184,176,188,180,188,192,"Handlers. Slow but surgical through corners."],
      ["Prestige Motors #4",   250,244,224,216,176,168,232,224,240,232,220,224,"Well-funded, well-organized."],
      ["Apex Legion",          276,268,236,228,166,156,256,248,264,256,244,248,"Hunting the title every race."],
      ["Titanium Works",       216,210,214,208,184,176,200,192,204,196,196,200,"Robust car, seasoned driver."],
      ["Blackridge Storm",     290,282,238,230,158,148,270,262,278,270,256,260,"Wet weather nightmare. Brilliant in the dry."],
      ["Circuit Sovereign #7", 236,230,220,212,178,168,220,212,224,216,208,212,"Race craft over raw pace."],
      ["Hyperion Racing",      260,252,230,222,172,164,240,232,248,240,228,232,"Tech-forward outfit. Always evolving."],
      ["Iron Dominion",        184,180,204,196,196,188,168,160,172,164,168,172,"Toughest chassis in the paddock."],
      ["Onyx Motorsport",      244,236,224,216,176,168,224,216,232,224,212,216,"Quiet team, loud results."],
      ["Blackridge Legends #6",272,264,232,224,168,160,252,244,260,252,240,244,"Living history. Proven race winners."],
      ["Apex Throne FC",       204,200,212,204,188,180,188,180,192,184,180,184,"Technical team. Love the technical sectors."],
      ["Grand Prix Elite",     288,280,240,232,160,152,268,260,276,268,256,260,"Pure pace. Nothing held back."],
      ["Velocity Kings #5",    224,218,218,210,182,172,208,200,212,204,200,204,"Mid-pack royalty with upset potential."],
      ["Chrome Circuit",       252,244,226,218,174,164,232,224,240,232,220,224,"Sleek machine with strong qualifying pace."],
      ["Steel Dominion #8",    192,186,206,198,194,184,176,168,180,172,172,176,"Durability experts. Strong in long races."],
      ["Blackridge Thunder",   280,272,234,226,162,152,260,252,268,260,248,252,"Thunder down every straight."],
      ["Apex Prestige",        220,214,216,208,182,172,204,196,208,200,196,200,"Prestige name, prestige pace."],
      ["Grand Slam Racing",    266,258,230,222,170,160,246,238,254,246,232,236,"All-or-nothing race strategy."],
      ["Zero Limits FC",       294,286,242,234,154,144,274,266,282,274,260,264,"Name says it all. Fastest in qualifying."],
      ["Meridian Works #9",    208,202,212,204,186,176,192,184,196,188,184,188,"Solid all-rounder from a rival city."],
      ["Blackridge Circuit Co",240,232,222,214,180,172,220,212,228,220,208,212,"Home circuit advantage. Knows every inch."],
      ["Summit Grand Prix",    256,248,226,218,174,164,236,228,244,236,224,228,"Altitude specialists adapting to the GP."],
      ["Apex Finale",          276,268,234,226,166,156,256,248,264,256,244,248,"Always saves best for the big show."],
      ["Omega Works FC",       230,224,218,210,180,172,212,204,220,212,200,204,"Late-season form. Dangerous."],
      ["Neon Circuit GP #10",  284,276,238,230,158,148,264,256,272,264,252,256,"Street DNA meets GP engineering."],
      ["Iron Grand Prix",      200,196,210,202,190,180,184,176,188,180,180,184,"Mountain-hardened machine."],
      ["Velocity Sovereign",   260,252,228,220,172,164,240,232,248,240,228,232,"Top-5 every race. Waiting for a win."],
      ["Blackridge Champion",  300,292,244,236,160,152,280,272,288,280,268,272,"The defending champion. The car to beat."],
      ["Apex Unlimited",       212,206,216,208,184,176,196,188,200,192,192,196,"No limits on ambition. Sometimes on speed."],
    ];
    for (const [n,spd,acc,hdl,stab,dur,wght,brk,ctrl,shift,eff,grip,corn,desc] of grandPrixNpcs) {
      insertNpc.run(grandPrixId,n,spd,acc,hdl,stab,dur,wght,brk,ctrl,shift,eff,grip,corn,desc);
    }
  }

  db.prepare("INSERT INTO meta (key, value) VALUES ('seeded_v2', '1')").run();
}
