import type { DbWrapper } from "./db";

export async function seedDatabase(db: DbWrapper): Promise<void> {
  db.prepare(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`).run();

  const seeded = db.prepare("SELECT value FROM meta WHERE key = 'seeded'").get();

  // Art slug backfill — runs once on existing seeded databases that predate the art column
  const artMigrated = db.prepare("SELECT value FROM meta WHERE key = 'art_slugs_v1'").get();
  if (!artMigrated) {
    const driverSlugs: Record<string, string> = {
      "Marco Venti": "marco_venti", "Jin-ho Park": "jin-ho_park", "Aisha Okafor": "aisha_okafor",
      "Rex Dalton": "rex_dalton", "Yuki Tanaka": "yuki_tanaka", "Carlos Reyes": "carlos_reyes",
      "Emma Fischer": "emma_fischer", "Luca Romano": "luca_romano",
    };
    for (const [name, art] of Object.entries(driverSlugs)) {
      db.prepare("UPDATE driver_templates SET art = ? WHERE name = ? AND (art IS NULL OR art = '')").run(art, name);
    }

    const carSlugs: Record<string, string> = {
      "Blackridge Apex": "blackridge_apex", "Blackridge Vortex": "blackridge_vortex",
      "Blackridge Phantom": "blackridge_phantom", "Blackridge Raptor": "blackridge_raptor",
      "Blackridge Zenith X": "blackridge_zenith_x",
    };
    for (const [name, art] of Object.entries(carSlugs)) {
      db.prepare("UPDATE car_templates SET art = ? WHERE name = ? AND (art IS NULL OR art = '')").run(art, name);
    }

    const partSlugs: Record<string, string> = {
      "T1 Inline-4 Block": "t1_inline4_block", "T2 V6 Performance": "t2_v6_performance",
      "T3 V8 Beast": "t3_v8_beast", "T1 Steel Frame": "t1_steel_frame",
      "T2 Carbon Monocoque": "t2_carbon_monocoque", "T1 Standard Wing": "t1_standard_wing",
      "T2 Active Aero Kit": "t2_active_aero_kit", "T1 Standard Compound": "t1_standard_compound",
      "T2 Sport Compound": "t2_sport_compound", "T1 Disc Brakes": "t1_disc_brakes",
      "T2 Carbon Ceramics": "t2_carbon_ceramics", "T1 Coilover Kit": "t1_coilover_kit",
    };
    for (const [name, art] of Object.entries(partSlugs)) {
      db.prepare("UPDATE part_templates SET art = ? WHERE name = ? AND (art IS NULL OR art = '')").run(art, name);
    }

    db.prepare("INSERT INTO meta (key, value) VALUES ('art_slugs_v1', '1')").run();
  }

  // Backfill: give any user without drivers a starter driver
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

  if (seeded) return;

  // --- Driver Templates ---
  const insertDriver = db.prepare(`
    INSERT OR IGNORE INTO driver_templates (name, nationality, portrait, art, base_speed, base_skill, base_stamina, base_aggression, rarity, unlock_cost, bio)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const drivers = [
    ["Marco Venti",  "Italian",  null, "marco_venti",  72, 68, 75, 80, "rare",      2500,  "A fiery Italian with an aggressive racing style honed on mountain roads."],
    ["Jin-ho Park",  "Korean",   null, "jin-ho_park",  80, 85, 65, 60, "epic",      6000,  "Precision personified. Jin-ho calculates every apex to the millimeter."],
    ["Aisha Okafor", "Nigerian", null, "aisha_okafor", 65, 70, 90, 55, "rare",      3000,  "Known for her relentless pace and ability to preserve tyres unlike anyone else."],
    ["Rex Dalton",   "American", null, "rex_dalton",   85, 60, 55, 95, "epic",      5500,  "The Wrecking Ball. Rex wins races but doesn't always finish them cleanly."],
    ["Yuki Tanaka",  "Japanese", null, "yuki_tanaka",  60, 90, 80, 45, "legendary", 15000, "A legend of the circuit. Yuki's technical mastery is unmatched."],
    ["Carlos Reyes", "Mexican",  null, "carlos_reyes", 55, 55, 60, 65, "common",    800,   "A hungry rookie still finding his rhythm on the track."],
    ["Emma Fischer", "German",   null, "emma_fischer", 70, 75, 70, 70, "rare",      3500,  "Balanced and methodical. Emma rarely makes mistakes."],
    ["Luca Romano",  "Italian",  null, "luca_romano",  50, 50, 55, 60, "common",    500,   "Fresh off the kart circuit. Raw potential waiting to be unlocked."],
  ];

  for (const d of drivers) insertDriver.run(...d);

  // --- Materials ---
  const insertMaterial = db.prepare(`
    INSERT OR IGNORE INTO materials (name, description, image, rarity, base_value)
    VALUES (?, ?, ?, ?, ?)
  `);

  const materials = [
    ["Carbon Fiber Sheet", "Lightweight structural material for chassis and aerodynamics.", "/assets/parts/placeholder-1x1.svg", "uncommon", 50],
    ["Steel Alloy Block", "High-grade steel for engine components.", "/assets/parts/placeholder-1x1.svg", "common", 20],
    ["Titanium Rod", "Ultra-light, ultra-strong. Used in high-performance builds.", "/assets/parts/placeholder-1x1.svg", "rare", 150],
    ["Rubber Compound", "Specialized rubber for tyre manufacturing.", "/assets/parts/placeholder-1x1.svg", "common", 15],
    ["Aluminum Sheet", "Versatile alloy for body panels and brakes.", "/assets/parts/placeholder-1x1.svg", "common", 25],
    ["Ceramic Disc", "Heat-resistant ceramic for high-performance brakes.", "/assets/parts/placeholder-1x1.svg", "uncommon", 80],
    ["Silicon Chip", "Advanced microprocessor for ECU and electronics.", "/assets/parts/placeholder-1x1.svg", "rare", 200],
    ["Kevlar Weave", "Bulletproof-grade fiber for safety cells.", "/assets/parts/placeholder-1x1.svg", "epic", 500],
  ];

  for (const m of materials) insertMaterial.run(...m);

  // --- Part Templates ---
  const insertPart = db.prepare(`
    INSERT OR IGNORE INTO part_templates (name, category, tier, image, art, stat_speed, stat_handling, stat_durability, stat_acceleration, craft_time, sell_price, ingredients, base_materials)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const parts = [
    ["T1 Inline-4 Block",   "engine",       1, null, "t1_inline4_block",     10, 0,  5,  8,  300,  800,  "[]", JSON.stringify([{material_id:2,qty:4},{material_id:5,qty:2}])],
    ["T2 V6 Performance",   "engine",       2, null, "t2_v6_performance",    20, 0,  8,  15, 600,  2000, "[]", JSON.stringify([{material_id:2,qty:6},{material_id:1,qty:2},{material_id:7,qty:1}])],
    ["T3 V8 Beast",         "engine",       3, null, "t3_v8_beast",          35, 0,  10, 25, 1200, 5000, "[]", JSON.stringify([{material_id:3,qty:3},{material_id:1,qty:4},{material_id:7,qty:2}])],
    ["T1 Steel Frame",      "chassis",      1, null, "t1_steel_frame",       0,  8,  15, 0,  400,  600,  "[]", JSON.stringify([{material_id:2,qty:5},{material_id:5,qty:3}])],
    ["T2 Carbon Monocoque", "chassis",      2, null, "t2_carbon_monocoque",  0,  18, 20, 5,  800,  2500, "[]", JSON.stringify([{material_id:1,qty:5},{material_id:8,qty:1}])],
    ["T1 Standard Wing",    "aerodynamics", 1, null, "t1_standard_wing",     5,  10, 0,  2,  200,  400,  "[]", JSON.stringify([{material_id:1,qty:3},{material_id:4,qty:1}])],
    ["T2 Active Aero Kit",  "aerodynamics", 2, null, "t2_active_aero_kit",   8,  22, 0,  5,  500,  1800, "[]", JSON.stringify([{material_id:1,qty:5},{material_id:7,qty:1},{material_id:3,qty:1}])],
    ["T1 Standard Compound","tyres",        1, null, "t1_standard_compound", 5,  12, 8,  5,  150,  300,  "[]", JSON.stringify([{material_id:4,qty:4}])],
    ["T2 Sport Compound",   "tyres",        2, null, "t2_sport_compound",    10, 20, 6,  10, 300,  800,  "[]", JSON.stringify([{material_id:4,qty:6},{material_id:5,qty:1}])],
    ["T1 Disc Brakes",      "brakes",       1, null, "t1_disc_brakes",       0,  8,  10, 3,  200,  400,  "[]", JSON.stringify([{material_id:5,qty:3},{material_id:6,qty:1}])],
    ["T2 Carbon Ceramics",  "brakes",       2, null, "t2_carbon_ceramics",   0,  15, 12, 8,  450,  1500, "[]", JSON.stringify([{material_id:6,qty:4},{material_id:1,qty:2}])],
    ["T1 Coilover Kit",     "suspension",   1, null, "t1_coilover_kit",      0,  14, 8,  4,  300,  500,  "[]", JSON.stringify([{material_id:2,qty:4},{material_id:4,qty:2}])],
  ];

  for (const p of parts) insertPart.run(...p);

  // --- Car Templates ---
  const insertCar = db.prepare(`
    INSERT OR IGNORE INTO car_templates (name, model_code, image, art, tier, base_speed, base_handling, description, unlock_level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const carTemplates = [
    ["Blackridge Apex",     "BR-APEX", null, "blackridge_apex",     1, 50, 50, "The entry-level Blackridge. Accessible, balanced, and ready to race.", 1],
    ["Blackridge Vortex",   "BR-VRTX", null, "blackridge_vortex",   2, 65, 60, "Mid-range performance with distinctive aggressive styling.", 3],
    ["Blackridge Phantom",  "BR-PHNT", null, "blackridge_phantom",  3, 78, 72, "Track-focused, lightweight. Where engineering meets art.", 7],
    ["Blackridge Raptor",   "BR-RPTR", null, "blackridge_raptor",   4, 88, 80, "Uncompromising performance. Built for champions.", 12],
    ["Blackridge Zenith X", "BR-ZNTH", null, "blackridge_zenith_x", 5, 98, 92, "The pinnacle of Blackridge engineering. One car. One legacy.", 20],
  ];

  for (const c of carTemplates) insertCar.run(...c);

  // --- Race Circuits ---
  const insertCircuit = db.prepare(`
    INSERT OR IGNORE INTO circuits (name, location, image, difficulty, laps, reward_credits, reward_materials, reward_prestige, unlock_level, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const circuits = [
    ["Ridgeport Oval", "Ridgeport, CA", "/assets/circuits/placeholder.svg", 1, 10, 300, JSON.stringify([{material_id:2,qty:2},{material_id:4,qty:1}]), 5, 1, "A simple oval track. Perfect for newcomers to find their feet."],
    ["Blackwater Bay Circuit", "Blackwater, FL", "/assets/circuits/placeholder.svg", 2, 15, 600, JSON.stringify([{material_id:1,qty:1},{material_id:2,qty:3}]), 12, 2, "Coastal winds make this technical circuit deceptively challenging."],
    ["Iron Peak Mountain Pass", "Iron Peak, CO", "/assets/circuits/placeholder.svg", 3, 8, 1200, JSON.stringify([{material_id:3,qty:1},{material_id:1,qty:2}]), 25, 5, "High altitude hairpins test driver skill and mechanical endurance."],
    ["Neon District Street Race", "Meridian City", "/assets/circuits/placeholder.svg", 4, 12, 2500, JSON.stringify([{material_id:6,qty:1},{material_id:7,qty:1}]), 50, 10, "Illegal? Maybe. Legendary? Absolutely."],
    ["Grand Prix de Blackridge", "Blackridge HQ", "/assets/circuits/placeholder.svg", 5, 20, 5000, JSON.stringify([{material_id:8,qty:1},{material_id:3,qty:2},{material_id:7,qty:1}]), 100, 18, "The ultimate stage. Only the best brands compete here."],
  ];

  for (const c of circuits) insertCircuit.run(...c);

  db.prepare("INSERT INTO meta (key, value) VALUES ('seeded', '1')").run();
}
