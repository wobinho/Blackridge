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

  // Backfill: give all users 200 xgear starter
  const xgearBackfill = db.prepare("SELECT value FROM meta WHERE key = 'xgear_starter_backfill_v1'").get();
  if (!xgearBackfill) {
    db.prepare(`UPDATE users SET xgear = MAX(xgear, 200) WHERE xgear < 200`).run();
    db.prepare("INSERT INTO meta (key, value) VALUES ('xgear_starter_backfill_v1', '1')").run();
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
      (name, location, difficulty, laps, reward_credits, reward_materials, reward_prestige,
       unlock_level, description, archetype, min_speed, min_handling, duration_seconds, podium_rewards)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const getMatId = (name: string): number => {
    const row = db.prepare("SELECT id FROM materials WHERE name = ?").get(name) as { id: number } | undefined;
    if (!row) throw new Error(`Material not found: ${name}`);
    return row.id;
  };

  const podium1 = JSON.stringify([{position:1,credits_bonus:200,prestige_bonus:3},{position:2,credits_bonus:100,prestige_bonus:1},{position:3,credits_bonus:50,prestige_bonus:0}]);
  const podium2 = JSON.stringify([{position:1,credits_bonus:400,prestige_bonus:6},{position:2,credits_bonus:200,prestige_bonus:3},{position:3,credits_bonus:100,prestige_bonus:1}]);
  const podium3 = JSON.stringify([{position:1,credits_bonus:800,prestige_bonus:12},{position:2,credits_bonus:400,prestige_bonus:6},{position:3,credits_bonus:200,prestige_bonus:3}]);
  const podium4 = JSON.stringify([{position:1,credits_bonus:1500,prestige_bonus:25},{position:2,credits_bonus:750,prestige_bonus:12},{position:3,credits_bonus:400,prestige_bonus:6}]);
  const podium5 = JSON.stringify([{position:1,credits_bonus:3000,prestige_bonus:50},{position:2,credits_bonus:1500,prestige_bonus:25},{position:3,credits_bonus:750,prestige_bonus:12}]);

  const circuits = [
    ["Ridgeport Oval",           "Ridgeport, CA",  1, 10, 300,
      () => JSON.stringify([{material_id:getMatId("Steel"),qty:3},{material_id:getMatId("Hardware"),qty:2}]),
      5,  1,  "A simple oval track. Perfect for newcomers to find their feet.",
      null, 0, 0, 120, podium1],
    ["Blackwater Bay Circuit",   "Blackwater, FL", 2, 15, 600,
      () => JSON.stringify([{material_id:getMatId("Aluminum"),qty:2},{material_id:getMatId("Compounds"),qty:2}]),
      12, 2,  "Coastal winds make this technical circuit deceptively challenging.",
      "sports_car", 0, 0, 240, podium2],
    ["Iron Peak Mountain Pass",  "Iron Peak, CO",  3, 8,  1200,
      () => JSON.stringify([{material_id:getMatId("Titanium"),qty:1},{material_id:getMatId("Carbon"),qty:1}]),
      25, 5,  "High altitude hairpins test driver skill and mechanical endurance.",
      null, 55, 50, 360, podium3],
    ["Neon District Street Race","Meridian City",  4, 12, 2500,
      () => JSON.stringify([{material_id:getMatId("Electronics"),qty:1},{material_id:getMatId("Fluids"),qty:2}]),
      50, 10, "Illegal? Maybe. Legendary? Absolutely.",
      "sports_car", 70, 60, 480, podium4],
    ["Grand Prix de Blackridge", "Blackridge HQ",  5, 20, 5000,
      () => JSON.stringify([{material_id:getMatId("Carbon"),qty:2},{material_id:getMatId("Titanium"),qty:1},{material_id:getMatId("Electronics"),qty:1}]),
      100, 18, "The ultimate stage. Only the best brands compete here.",
      null, 85, 80, 600, podium5],
  ];

  for (const [name, loc, diff, laps, cred, rewardFn, pres, ul, desc, arch, ms, mh, dur, pod] of circuits) {
    insertCircuit.run(name, loc, diff, laps, cred, (rewardFn as () => string)(), pres, ul, desc, arch, ms, mh, dur, pod);
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

  db.prepare("INSERT INTO meta (key, value) VALUES ('seeded_v2', '1')").run();
}
