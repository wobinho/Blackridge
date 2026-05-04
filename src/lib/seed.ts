import type { DbWrapper } from "./db";

// Rarity multipliers for materials base_value
const MAT_VALUE_MULT: Record<string, number> = {
  common:    1,
  uncommon:  2.5,
  rare:      6,
  epic:      15,
  legendary: 40,
  mythical:  100,
};

// Rarity multipliers for part stats and sell price
const PART_STAT_MULT: Record<string, number> = {
  common:    1,
  uncommon:  1.3,
  rare:      1.7,
  epic:      2.5,
  legendary: 4,
  mythical:  6,
};
const PART_PRICE_MULT: Record<string, number> = {
  common:    1,
  uncommon:  2,
  rare:      4,
  epic:      10,
  legendary: 25,
  mythical:  60,
};
const PART_TIME_MULT: Record<string, number> = {
  common:    1,
  uncommon:  1.5,
  rare:      2.5,
  epic:      5,
  legendary: 10,
  mythical:  20,
};

function raritySlug(base: string, rarity: string): string {
  return `${rarity}_${base}`;
}

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

  // Backfill: set art slugs on existing materials rows
  const materialArtBackfill = db.prepare("SELECT value FROM meta WHERE key = 'material_art_v1'").get();
  if (!materialArtBackfill) {
    const matSlugs: Record<string, string> = {
      "Carbon Fiber Sheet": "carbon_fiber_sheet",
      "Steel Alloy Block":  "steel_alloy_block",
      "Titanium Rod":       "titanium_rod",
      "Rubber Compound":    "rubber_compound",
      "Aluminum Sheet":     "aluminum_sheet",
      "Ceramic Disc":       "ceramic_disc",
      "Silicon Chip":       "silicon_chip",
      "Kevlar Weave":       "kevlar_weave",
    };
    for (const [name, baseSlug] of Object.entries(matSlugs)) {
      // existing seed rows have no rarity prefix — just set base slug
      db.prepare("UPDATE materials SET art = ? WHERE name = ? AND (art IS NULL OR art = '')").run(baseSlug, name);
    }
    db.prepare("INSERT INTO meta (key, value) VALUES ('material_art_v1', '1')").run();
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

  // Backfill: give all users 200 xgear as starter premium currency
  const xgearBackfill = db.prepare("SELECT value FROM meta WHERE key = 'xgear_starter_backfill_v1'").get();
  if (!xgearBackfill) {
    db.prepare(`UPDATE users SET xgear = MAX(xgear, 200) WHERE xgear < 200`).run();
    db.prepare("INSERT INTO meta (key, value) VALUES ('xgear_starter_backfill_v1', '1')").run();
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

  // Backfill: give any user without a workshop_upgrades row a default one
  const workshopBackfill = db.prepare("SELECT value FROM meta WHERE key = 'workshop_upgrades_backfill_v1'").get();
  if (!workshopBackfill) {
    const usersWithoutUpgrades = db.prepare(
      `SELECT u.id FROM users u WHERE NOT EXISTS (SELECT 1 FROM workshop_upgrades w WHERE w.user_id = u.id)`
    ).all() as { id: number }[];
    for (const user of usersWithoutUpgrades) {
      db.prepare(
        `INSERT OR IGNORE INTO workshop_upgrades (user_id) VALUES (?)`
      ).run(user.id);
    }
    db.prepare("INSERT INTO meta (key, value) VALUES ('workshop_upgrades_backfill_v1', '1')").run();
  }

  // Backfill: add market_mat_slots and market_mat_rarity columns if missing
  const marketUpgradesBackfill = db.prepare("SELECT value FROM meta WHERE key = 'market_mat_upgrades_backfill_v1'").get();
  if (!marketUpgradesBackfill) {
    try { db.prepare(`ALTER TABLE workshop_upgrades ADD COLUMN market_mat_slots INTEGER NOT NULL DEFAULT 0`).run(); } catch {}
    try { db.prepare(`ALTER TABLE workshop_upgrades ADD COLUMN market_mat_rarity INTEGER NOT NULL DEFAULT 0`).run(); } catch {}
    db.prepare("INSERT INTO meta (key, value) VALUES ('market_mat_upgrades_backfill_v1', '1')").run();
  }

  // Backfill: give any user without an engineer a starter engineer
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

  // Expand materials: seed all 8 base types × 6 rarities (common→mythical)
  const materialsRarityExpanded = db.prepare("SELECT value FROM meta WHERE key = 'materials_rarity_v1'").get();
  if (!materialsRarityExpanded) {
    const insertMaterialRarity = db.prepare(`
      INSERT OR IGNORE INTO materials (name, description, art, rarity, base_value)
      VALUES (?, ?, ?, ?, ?)
    `);

    // [base_slug, display_name, description, base_value]
    const baseMaterials: Array<[string, string, string, number]> = [
      ["carbon_fiber_sheet", "Carbon Fiber Sheet", "Lightweight structural material for chassis and aerodynamics.", 50],
      ["steel_alloy_block",  "Steel Alloy Block",  "High-grade steel for engine components.", 20],
      ["titanium_rod",       "Titanium Rod",        "Ultra-light, ultra-strong. Used in high-performance builds.", 150],
      ["rubber_compound",    "Rubber Compound",     "Specialized rubber for tyre manufacturing.", 15],
      ["aluminum_sheet",     "Aluminum Sheet",      "Versatile alloy for body panels and brakes.", 25],
      ["ceramic_disc",       "Ceramic Disc",        "Heat-resistant ceramic for high-performance brakes.", 80],
      ["silicon_chip",       "Silicon Chip",        "Advanced microprocessor for ECU and electronics.", 200],
      ["kevlar_weave",       "Kevlar Weave",        "Bulletproof-grade fiber for safety cells.", 500],
    ];

    const rarities: Array<[string, number]> = [
      ["common", 1], ["uncommon", 2.5], ["rare", 6], ["epic", 15], ["legendary", 40], ["mythical", 100],
    ];

    for (const [baseSlug, baseName, desc, baseVal] of baseMaterials) {
      for (const [rarity, mult] of rarities) {
        const name = rarity === "common" ? baseName : `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} ${baseName}`;
        const art = raritySlug(baseSlug, rarity);
        const value = Math.round(baseVal * mult);
        insertMaterialRarity.run(name, desc, art, rarity, value);
      }
    }

    db.prepare("INSERT INTO meta (key, value) VALUES ('materials_rarity_v1', '1')").run();
  }

  // Expand part_templates: seed rarity variants (uncommon→mythical) for each base part
  const partsRarityExpanded = db.prepare("SELECT value FROM meta WHERE key = 'parts_rarity_v1'").get();
  if (!partsRarityExpanded) {
    // Mark existing base parts as 'common'
    db.prepare(`UPDATE part_templates SET rarity = 'common' WHERE rarity IS NULL OR rarity = ''`).run();

    // We need material IDs by rarity for crafting recipes.
    // After materials_rarity_v1 migration above, we can look them up.
    // Helper: get material_id for a given base name + rarity
    const getMaterialId = (baseSlug: string, rarity: string): number | null => {
      const baseName = baseSlug.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      const name = rarity === "common" ? baseName : `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} ${baseName}`;
      const row = db.prepare("SELECT id FROM materials WHERE name = ? AND rarity = ?").get(name, rarity) as { id: number } | undefined;
      return row?.id ?? null;
    };

    const insertPart = db.prepare(`
      INSERT OR IGNORE INTO part_templates (name, category, tier, rarity, art, stat_speed, stat_handling, stat_durability, stat_acceleration, craft_time, sell_price, ingredients, base_materials)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Base part definitions (common tier) — [name_base, category, tier, stat_spd, stat_hdl, stat_dur, stat_acc, craft_time_s, sell_price, mat_slugs_w_qty]
    type PartDef = {
      nameBase: string;
      artBase: string;
      category: string;
      tier: number;
      spd: number; hdl: number; dur: number; acc: number;
      craftTime: number;
      sellPrice: number;
      mats: Array<{ slug: string; qty: number }>;
    };

    const baseParts: PartDef[] = [
      { nameBase: "Inline-4 Block",   artBase: "inline4_block",     category: "engine",       tier: 1, spd: 10, hdl: 0,  dur: 5,  acc: 8,  craftTime: 300,  sellPrice: 800,  mats: [{slug:"steel_alloy_block",qty:4},{slug:"aluminum_sheet",qty:2}] },
      { nameBase: "V6 Performance",   artBase: "v6_performance",    category: "engine",       tier: 2, spd: 20, hdl: 0,  dur: 8,  acc: 15, craftTime: 600,  sellPrice: 2000, mats: [{slug:"steel_alloy_block",qty:6},{slug:"carbon_fiber_sheet",qty:2},{slug:"silicon_chip",qty:1}] },
      { nameBase: "V8 Beast",         artBase: "v8_beast",          category: "engine",       tier: 3, spd: 35, hdl: 0,  dur: 10, acc: 25, craftTime: 1200, sellPrice: 5000, mats: [{slug:"titanium_rod",qty:3},{slug:"carbon_fiber_sheet",qty:4},{slug:"silicon_chip",qty:2}] },
      { nameBase: "Steel Frame",      artBase: "steel_frame",       category: "chassis",      tier: 1, spd: 0,  hdl: 8,  dur: 15, acc: 0,  craftTime: 400,  sellPrice: 600,  mats: [{slug:"steel_alloy_block",qty:5},{slug:"aluminum_sheet",qty:3}] },
      { nameBase: "Carbon Monocoque", artBase: "carbon_monocoque",  category: "chassis",      tier: 2, spd: 0,  hdl: 18, dur: 20, acc: 5,  craftTime: 800,  sellPrice: 2500, mats: [{slug:"carbon_fiber_sheet",qty:5},{slug:"kevlar_weave",qty:1}] },
      { nameBase: "Standard Wing",    artBase: "standard_wing",     category: "aerodynamics", tier: 1, spd: 5,  hdl: 10, dur: 0,  acc: 2,  craftTime: 200,  sellPrice: 400,  mats: [{slug:"carbon_fiber_sheet",qty:3},{slug:"rubber_compound",qty:1}] },
      { nameBase: "Active Aero Kit",  artBase: "active_aero_kit",   category: "aerodynamics", tier: 2, spd: 8,  hdl: 22, dur: 0,  acc: 5,  craftTime: 500,  sellPrice: 1800, mats: [{slug:"carbon_fiber_sheet",qty:5},{slug:"silicon_chip",qty:1},{slug:"titanium_rod",qty:1}] },
      { nameBase: "Standard Compound",artBase: "standard_compound", category: "tyres",        tier: 1, spd: 5,  hdl: 12, dur: 8,  acc: 5,  craftTime: 150,  sellPrice: 300,  mats: [{slug:"rubber_compound",qty:4}] },
      { nameBase: "Sport Compound",   artBase: "sport_compound",    category: "tyres",        tier: 2, spd: 10, hdl: 20, dur: 6,  acc: 10, craftTime: 300,  sellPrice: 800,  mats: [{slug:"rubber_compound",qty:6},{slug:"aluminum_sheet",qty:1}] },
      { nameBase: "Disc Brakes",      artBase: "disc_brakes",       category: "brakes",       tier: 1, spd: 0,  hdl: 8,  dur: 10, acc: 3,  craftTime: 200,  sellPrice: 400,  mats: [{slug:"aluminum_sheet",qty:3},{slug:"ceramic_disc",qty:1}] },
      { nameBase: "Carbon Ceramics",  artBase: "carbon_ceramics",   category: "brakes",       tier: 2, spd: 0,  hdl: 15, dur: 12, acc: 8,  craftTime: 450,  sellPrice: 1500, mats: [{slug:"ceramic_disc",qty:4},{slug:"carbon_fiber_sheet",qty:2}] },
      { nameBase: "Coilover Kit",     artBase: "coilover_kit",      category: "suspension",   tier: 1, spd: 0,  hdl: 14, dur: 8,  acc: 4,  craftTime: 300,  sellPrice: 500,  mats: [{slug:"steel_alloy_block",qty:4},{slug:"rubber_compound",qty:2}] },
    ];

    const expandRarities = ["uncommon", "rare", "epic", "legendary", "mythical"] as const;

    for (const part of baseParts) {
      for (const rarity of expandRarities) {
        const sm = PART_STAT_MULT[rarity];
        const pm = PART_PRICE_MULT[rarity];
        const tm = PART_TIME_MULT[rarity];

        const name = `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} ${part.nameBase}`;
        const art = raritySlug(part.artBase, rarity);

        const spd = Math.round(part.spd * sm);
        const hdl = Math.round(part.hdl * sm);
        const dur = Math.round(part.dur * sm);
        const acc = Math.round(part.acc * sm);
        const craftTime = Math.round(part.craftTime * tm);
        const sellPrice = Math.round(part.sellPrice * pm);

        // Build material requirements using same-rarity materials
        const matsJson = JSON.stringify(
          part.mats
            .map(m => {
              const id = getMaterialId(m.slug, rarity);
              return id ? { material_id: id, qty: m.qty } : null;
            })
            .filter(Boolean)
        );

        insertPart.run(name, part.category, part.tier, rarity, art, spd, hdl, dur, acc, craftTime, sellPrice, "[]", matsJson);
      }
    }

    db.prepare("INSERT INTO meta (key, value) VALUES ('parts_rarity_v1', '1')").run();
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

  // --- Materials (base common variants — full rarity expansion handled in backfill above) ---
  const insertMaterial = db.prepare(`
    INSERT OR IGNORE INTO materials (name, description, art, rarity, base_value)
    VALUES (?, ?, ?, ?, ?)
  `);

  const materials: Array<[string, string, string, string, number]> = [
    ["Carbon Fiber Sheet", "Lightweight structural material for chassis and aerodynamics.", "carbon_fiber_sheet", "uncommon", 50],
    ["Steel Alloy Block",  "High-grade steel for engine components.",                       "steel_alloy_block",  "common",   20],
    ["Titanium Rod",       "Ultra-light, ultra-strong. Used in high-performance builds.",   "titanium_rod",       "rare",     150],
    ["Rubber Compound",    "Specialized rubber for tyre manufacturing.",                    "rubber_compound",    "common",   15],
    ["Aluminum Sheet",     "Versatile alloy for body panels and brakes.",                   "aluminum_sheet",     "common",   25],
    ["Ceramic Disc",       "Heat-resistant ceramic for high-performance brakes.",           "ceramic_disc",       "uncommon", 80],
    ["Silicon Chip",       "Advanced microprocessor for ECU and electronics.",              "silicon_chip",       "rare",     200],
    ["Kevlar Weave",       "Bulletproof-grade fiber for safety cells.",                     "kevlar_weave",       "epic",     500],
  ];

  for (const m of materials) insertMaterial.run(...m);

  // --- Part Templates (common variants — rarity expansion handled in backfill above) ---
  const insertPart = db.prepare(`
    INSERT OR IGNORE INTO part_templates (name, category, tier, rarity, image, art, stat_speed, stat_handling, stat_durability, stat_acceleration, craft_time, sell_price, ingredients, base_materials)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const parts = [
    ["T1 Inline-4 Block",    "engine",       1, "common", null, "t1_inline4_block",     10, 0,  5,  8,  300,  800,  "[]", JSON.stringify([{material_id:2,qty:4},{material_id:5,qty:2}])],
    ["T2 V6 Performance",    "engine",       2, "common", null, "t2_v6_performance",    20, 0,  8,  15, 600,  2000, "[]", JSON.stringify([{material_id:2,qty:6},{material_id:1,qty:2},{material_id:7,qty:1}])],
    ["T3 V8 Beast",          "engine",       3, "common", null, "t3_v8_beast",          35, 0,  10, 25, 1200, 5000, "[]", JSON.stringify([{material_id:3,qty:3},{material_id:1,qty:4},{material_id:7,qty:2}])],
    ["T1 Steel Frame",       "chassis",      1, "common", null, "t1_steel_frame",       0,  8,  15, 0,  400,  600,  "[]", JSON.stringify([{material_id:2,qty:5},{material_id:5,qty:3}])],
    ["T2 Carbon Monocoque",  "chassis",      2, "common", null, "t2_carbon_monocoque",  0,  18, 20, 5,  800,  2500, "[]", JSON.stringify([{material_id:1,qty:5},{material_id:8,qty:1}])],
    ["T1 Standard Wing",     "aerodynamics", 1, "common", null, "t1_standard_wing",     5,  10, 0,  2,  200,  400,  "[]", JSON.stringify([{material_id:1,qty:3},{material_id:4,qty:1}])],
    ["T2 Active Aero Kit",   "aerodynamics", 2, "common", null, "t2_active_aero_kit",   8,  22, 0,  5,  500,  1800, "[]", JSON.stringify([{material_id:1,qty:5},{material_id:7,qty:1},{material_id:3,qty:1}])],
    ["T1 Standard Compound", "tyres",        1, "common", null, "t1_standard_compound", 5,  12, 8,  5,  150,  300,  "[]", JSON.stringify([{material_id:4,qty:4}])],
    ["T2 Sport Compound",    "tyres",        2, "common", null, "t2_sport_compound",    10, 20, 6,  10, 300,  800,  "[]", JSON.stringify([{material_id:4,qty:6},{material_id:5,qty:1}])],
    ["T1 Disc Brakes",       "brakes",       1, "common", null, "t1_disc_brakes",       0,  8,  10, 3,  200,  400,  "[]", JSON.stringify([{material_id:5,qty:3},{material_id:6,qty:1}])],
    ["T2 Carbon Ceramics",   "brakes",       2, "common", null, "t2_carbon_ceramics",   0,  15, 12, 8,  450,  1500, "[]", JSON.stringify([{material_id:6,qty:4},{material_id:1,qty:2}])],
    ["T1 Coilover Kit",      "suspension",   1, "common", null, "t1_coilover_kit",      0,  14, 8,  4,  300,  500,  "[]", JSON.stringify([{material_id:2,qty:4},{material_id:4,qty:2}])],
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

  // --- Engineer Templates ---
  const insertEngineer = db.prepare(`
    INSERT OR IGNORE INTO engineer_templates (name, nationality, portrait, art, base_craft_speed, base_quality_bonus, base_race_bonus, rarity, unlock_cost, bio)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const engineerTemplates = [
    ["Tomas Varga",    "Hungarian", null, "tomas_varga",    45, 48, 15, "common",    500,   "A steady wrench-turner fresh from vocational school. Reliable but slow."],
    ["Priya Nair",     "Indian",    null, "priya_nair",     55, 60, 18, "common",    800,   "Meticulous and detail-oriented. Her builds rarely fail quality checks."],
    ["Hans Brecker",   "German",    null, "hans_brecker",   70, 72, 25, "rare",      2500,  "Old-school precision engineering. Every bolt torqued to spec."],
    ["Sofia Matos",    "Brazilian", null, "sofia_matos",    65, 80, 22, "rare",      3000,  "Specializes in aerodynamic tuning. Her aero kits add real downforce."],
    ["Kenji Inoue",    "Japanese",  null, "kenji_inoue",    85, 75, 35, "epic",      6000,  "Lightning-fast assembly with near-zero defects. A workshop legend."],
    ["Ava Chen",       "Canadian",  null, "ava_chen",       75, 90, 30, "epic",      5500,  "Quality obsessive. Her parts routinely exceed spec by 10%."],
    ["Viktor Molnár",  "Austrian",  null, "viktor_molnar",  95, 95, 50, "legendary", 15000, "The Architect. Viktor's builds have won championship titles across three continents."],
    ["Rosa Delgado",   "Spanish",   null, "rosa_delgado",   50, 52, 20, "common",    600,   "Hard worker still building her reputation. Potential waiting to emerge."],
  ];

  for (const e of engineerTemplates) insertEngineer.run(...e);

  // --- Race Circuits ---
  const insertCircuit = db.prepare(`
    INSERT OR IGNORE INTO circuits (name, location, image, difficulty, laps, reward_credits, reward_materials, reward_prestige, unlock_level, description, archetype, min_speed, min_handling, duration_seconds, podium_rewards)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const podium1 = JSON.stringify([{position:1,credits_bonus:200,prestige_bonus:3},{position:2,credits_bonus:100,prestige_bonus:1},{position:3,credits_bonus:50,prestige_bonus:0}]);
  const podium2 = JSON.stringify([{position:1,credits_bonus:400,prestige_bonus:6},{position:2,credits_bonus:200,prestige_bonus:3},{position:3,credits_bonus:100,prestige_bonus:1}]);
  const podium3 = JSON.stringify([{position:1,credits_bonus:800,prestige_bonus:12},{position:2,credits_bonus:400,prestige_bonus:6},{position:3,credits_bonus:200,prestige_bonus:3}]);
  const podium4 = JSON.stringify([{position:1,credits_bonus:1500,prestige_bonus:25},{position:2,credits_bonus:750,prestige_bonus:12},{position:3,credits_bonus:400,prestige_bonus:6}]);
  const podium5 = JSON.stringify([{position:1,credits_bonus:3000,prestige_bonus:50},{position:2,credits_bonus:1500,prestige_bonus:25},{position:3,credits_bonus:750,prestige_bonus:12}]);

  const circuits = [
    ["Ridgeport Oval",           "Ridgeport, CA",  null, 1, 10, 300,  JSON.stringify([{material_id:2,qty:2},{material_id:4,qty:1}]),                      5,   1,  "A simple oval track. Perfect for newcomers to find their feet.",      null,     0,  0,  120, podium1],
    ["Blackwater Bay Circuit",   "Blackwater, FL", null, 2, 15, 600,  JSON.stringify([{material_id:1,qty:1},{material_id:2,qty:3}]),                      12,  2,  "Coastal winds make this technical circuit deceptively challenging.",  "street", 0,  0,  240, podium2],
    ["Iron Peak Mountain Pass",  "Iron Peak, CO",  null, 3, 8,  1200, JSON.stringify([{material_id:3,qty:1},{material_id:1,qty:2}]),                      25,  5,  "High altitude hairpins test driver skill and mechanical endurance.",  null,     55, 50, 360, podium3],
    ["Neon District Street Race","Meridian City",  null, 4, 12, 2500, JSON.stringify([{material_id:6,qty:1},{material_id:7,qty:1}]),                      50,  10, "Illegal? Maybe. Legendary? Absolutely.",                              "street", 70, 60, 480, podium4],
    ["Grand Prix de Blackridge", "Blackridge HQ",  null, 5, 20, 5000, JSON.stringify([{material_id:8,qty:1},{material_id:3,qty:2},{material_id:7,qty:1}]), 100, 18, "The ultimate stage. Only the best brands compete here.",              null,     85, 80, 600, podium5],
  ];

  for (const c of circuits) insertCircuit.run(...c);

  // Circuit column backfill — patches existing rows that were seeded before new columns existed
  const circuitBackfill = db.prepare("SELECT value FROM meta WHERE key = 'circuit_race_cols_v1'").get();
  if (!circuitBackfill) {
    const updates: Array<[string | null, number, number, number, string, number]> = [
      [null,     0,  0,  120, podium1, 1],
      ["street", 0,  0,  240, podium2, 2],
      [null,     55, 50, 360, podium3, 3],
      ["street", 70, 60, 480, podium4, 4],
      [null,     85, 80, 600, podium5, 5],
    ];
    for (const [archetype, minSpd, minHnd, dur, pod, id] of updates) {
      db.prepare(`UPDATE circuits SET archetype=?, min_speed=?, min_handling=?, duration_seconds=?, podium_rewards=? WHERE id=?`)
        .run(archetype, minSpd, minHnd, dur, pod, id);
    }
    db.prepare("INSERT INTO meta (key, value) VALUES ('circuit_race_cols_v1', '1')").run();
  }

  // --- Market Material Slots ---
  const insertMatSlot = db.prepare(`
    INSERT OR IGNORE INTO market_material_slots (slot_index, material_id, quantity, price_per_unit, refresh_at)
    VALUES (?, ?, ?, ?, 0)
  `);
  const matSlotDefaults = [
    [0, 2, 20, 18],
    [1, 4, 18, 12],
    [2, 5, 15, 22],
    [3, 1, 8,  55],
    [4, 6, 5,  90],
    [5, 3, 3, 180],
  ];
  for (const s of matSlotDefaults) insertMatSlot.run(...s);

  // --- Market Part Listings (initial 8 listings) ---
  const now = Math.floor(Date.now() / 1000);
  const insertPartListing = db.prepare(`
    INSERT OR IGNORE INTO market_part_listings (part_id, price, quantity, listed_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const partListings = [
    [1,  900,  2, now, now + 3600],
    [4,  700,  1, now, now + 3600],
    [6,  450,  3, now, now + 3600],
    [8,  350,  2, now, now + 3600],
    [2, 2200,  1, now, now + 3600],
    [10, 460,  2, now, now + 3600],
    [5,  2800, 1, now, now + 3600],
    [12, 580,  2, now, now + 3600],
  ];
  for (const p of partListings) insertPartListing.run(...p);

  db.prepare("INSERT INTO meta (key, value) VALUES ('seeded', '1')").run();
}
