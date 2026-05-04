-- ============================================================
-- BLACKRIDGE DATABASE SCHEMA
-- ============================================================

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ============================================================
-- USERS & AUTH
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password    TEXT    NOT NULL,
  brand_name  TEXT    NOT NULL DEFAULT 'Unknown Brand',
  brand_logo  TEXT,
  prestige    INTEGER NOT NULL DEFAULT 0,
  credits     INTEGER NOT NULL DEFAULT 5000,
  xgear       INTEGER NOT NULL DEFAULT 0,
  reputation  INTEGER NOT NULL DEFAULT 0,
  level       INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  last_active INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- MATERIALS
-- No rarity — one row per material type
-- ============================================================

CREATE TABLE IF NOT EXISTS materials (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  description TEXT,
  image       TEXT,
  art         TEXT,
  base_value  INTEGER NOT NULL DEFAULT 10
);

-- ============================================================
-- PLAYER INVENTORY: MATERIALS
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_materials (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  material_id INTEGER NOT NULL REFERENCES materials(id),
  quantity    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, material_id)
);

-- ============================================================
-- PART TEMPLATES
-- One row per part category (engine, suspension, etc.)
-- No rarity — rarity is rolled at craft time and stored on the instance
-- ============================================================

CREATE TABLE IF NOT EXISTS part_templates (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL UNIQUE,
  category        TEXT    NOT NULL CHECK (category IN ('engine','suspension','chassis','brakes','gearbox','tires')),
  image           TEXT,
  art             TEXT,
  -- base stats (at common rarity)
  stat_speed          INTEGER NOT NULL DEFAULT 0,   -- engine
  stat_acceleration   INTEGER NOT NULL DEFAULT 0,   -- engine
  stat_handling       INTEGER NOT NULL DEFAULT 0,   -- suspension
  stat_stability      INTEGER NOT NULL DEFAULT 0,   -- suspension
  stat_durability     INTEGER NOT NULL DEFAULT 0,   -- chassis
  stat_weight         INTEGER NOT NULL DEFAULT 0,   -- chassis
  stat_braking        INTEGER NOT NULL DEFAULT 0,   -- brakes
  stat_control        INTEGER NOT NULL DEFAULT 0,   -- brakes
  stat_shift_speed    INTEGER NOT NULL DEFAULT 0,   -- gearbox
  stat_efficiency     INTEGER NOT NULL DEFAULT 0,   -- gearbox
  stat_grip           INTEGER NOT NULL DEFAULT 0,   -- tires
  stat_cornering      INTEGER NOT NULL DEFAULT 0,   -- tires
  craft_time          INTEGER NOT NULL DEFAULT 300, -- seconds at common rarity
  sell_price          INTEGER NOT NULL DEFAULT 500, -- base sell price at common
  -- crafting recipe: JSON [{material_id, qty}]
  recipe              TEXT    NOT NULL DEFAULT '[]'
);

-- ============================================================
-- PLAYER INVENTORY: PARTS (crafted instances)
-- Rarity is rolled at craft time
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_parts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  part_template_id INTEGER NOT NULL REFERENCES part_templates(id),
  rarity          TEXT    NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary','mythical')),
  -- final stats (base * rarity multiplier, applied at craft time)
  stat_speed          INTEGER NOT NULL DEFAULT 0,
  stat_acceleration   INTEGER NOT NULL DEFAULT 0,
  stat_handling       INTEGER NOT NULL DEFAULT 0,
  stat_stability      INTEGER NOT NULL DEFAULT 0,
  stat_durability     INTEGER NOT NULL DEFAULT 0,
  stat_weight         INTEGER NOT NULL DEFAULT 0,
  stat_braking        INTEGER NOT NULL DEFAULT 0,
  stat_control        INTEGER NOT NULL DEFAULT 0,
  stat_shift_speed    INTEGER NOT NULL DEFAULT 0,
  stat_efficiency     INTEGER NOT NULL DEFAULT 0,
  stat_grip           INTEGER NOT NULL DEFAULT 0,
  stat_cornering      INTEGER NOT NULL DEFAULT 0,
  status          TEXT    NOT NULL DEFAULT 'inventory' CHECK (status IN ('inventory','equipped','for_sale')),
  sale_price      INTEGER,
  crafted_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- CAR TEMPLATES
-- Archetypes: sports_car, luxury_car, classic_car
-- ============================================================

CREATE TABLE IF NOT EXISTS car_templates (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  model_code   TEXT    NOT NULL UNIQUE,  -- SC-1, SC-2, LC-1, LC-2, CC-1, CC-2
  archetype    TEXT    NOT NULL CHECK (archetype IN ('sports_car','luxury_car','classic_car')),
  image        TEXT,
  art          TEXT,
  description  TEXT,
  -- base stats before parts
  base_speed        INTEGER NOT NULL DEFAULT 0,
  base_acceleration INTEGER NOT NULL DEFAULT 0,
  base_handling     INTEGER NOT NULL DEFAULT 0,
  base_stability    INTEGER NOT NULL DEFAULT 0,
  base_durability   INTEGER NOT NULL DEFAULT 0,
  base_weight       INTEGER NOT NULL DEFAULT 0,
  base_braking      INTEGER NOT NULL DEFAULT 0,
  base_control      INTEGER NOT NULL DEFAULT 0,
  base_shift_speed  INTEGER NOT NULL DEFAULT 0,
  base_efficiency   INTEGER NOT NULL DEFAULT 0,
  base_grip         INTEGER NOT NULL DEFAULT 0,
  base_cornering    INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- PLAYER BLUEPRINTS
-- Row created on first acquisition; query LEFT JOINs car_templates for 0-qty display
-- ============================================================

CREATE TABLE IF NOT EXISTS user_blueprints (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  car_template_id INTEGER NOT NULL REFERENCES car_templates(id),
  quantity        INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, car_template_id)
);

-- ============================================================
-- CARS (assembled instances)
-- ============================================================

CREATE TABLE IF NOT EXISTS cars (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  car_template_id INTEGER NOT NULL REFERENCES car_templates(id),
  name            TEXT    NOT NULL,
  color           TEXT    NOT NULL DEFAULT '#e8001c',
  -- computed stats (base + parts), updated when parts change
  stat_speed        INTEGER NOT NULL DEFAULT 0,
  stat_acceleration INTEGER NOT NULL DEFAULT 0,
  stat_handling     INTEGER NOT NULL DEFAULT 0,
  stat_stability    INTEGER NOT NULL DEFAULT 0,
  stat_durability   INTEGER NOT NULL DEFAULT 0,
  stat_weight       INTEGER NOT NULL DEFAULT 0,
  stat_braking      INTEGER NOT NULL DEFAULT 0,
  stat_control      INTEGER NOT NULL DEFAULT 0,
  stat_shift_speed  INTEGER NOT NULL DEFAULT 0,
  stat_efficiency   INTEGER NOT NULL DEFAULT 0,
  stat_grip         INTEGER NOT NULL DEFAULT 0,
  stat_cornering    INTEGER NOT NULL DEFAULT 0,
  wear            INTEGER NOT NULL DEFAULT 100,  -- 100 = brand new, decreases with use
  status          TEXT    NOT NULL DEFAULT 'garage' CHECK (status IN ('garage','racing','crafting','for_sale','sold')),
  sale_price      INTEGER,
  total_races     INTEGER NOT NULL DEFAULT 0,
  total_wins      INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Parts equipped to a car (one row per slot)
CREATE TABLE IF NOT EXISTS car_parts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  car_id          INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  inventory_part_id INTEGER NOT NULL REFERENCES inventory_parts(id),
  slot            TEXT    NOT NULL CHECK (slot IN ('engine','suspension','chassis','brakes','gearbox','tires')),
  UNIQUE(car_id, slot)
);

-- ============================================================
-- CAR CRAFTING QUEUE
-- Requires 6 parts + 2 engineers; car enters 'crafting' status
-- ============================================================

CREATE TABLE IF NOT EXISTS car_crafting_queue (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  car_template_id   INTEGER NOT NULL REFERENCES car_templates(id),
  blueprint_id      INTEGER NOT NULL REFERENCES user_blueprints(id),
  engineer_id_1     INTEGER NOT NULL REFERENCES engineers(id),
  engineer_id_2     INTEGER NOT NULL REFERENCES engineers(id),
  -- part instance IDs being used (one per slot)
  part_engine_id    INTEGER NOT NULL REFERENCES inventory_parts(id),
  part_suspension_id INTEGER NOT NULL REFERENCES inventory_parts(id),
  part_chassis_id   INTEGER NOT NULL REFERENCES inventory_parts(id),
  part_brakes_id    INTEGER NOT NULL REFERENCES inventory_parts(id),
  part_gearbox_id   INTEGER NOT NULL REFERENCES inventory_parts(id),
  part_tires_id     INTEGER NOT NULL REFERENCES inventory_parts(id),
  status            TEXT    NOT NULL DEFAULT 'crafting' CHECK (status IN ('crafting','completed','cancelled')),
  started_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  completes_at      INTEGER NOT NULL,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- PART CRAFTING QUEUE (workshop — crafting parts from materials)
-- ============================================================

CREATE TABLE IF NOT EXISTS crafting_queue (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  part_template_id INTEGER NOT NULL REFERENCES part_templates(id),
  engineer_id     INTEGER REFERENCES engineers(id),
  slot_index      INTEGER NOT NULL DEFAULT 0,
  quantity        INTEGER NOT NULL DEFAULT 1,
  status          TEXT    NOT NULL DEFAULT 'crafting' CHECK (status IN ('crafting','completed','cancelled')),
  started_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  completes_at    INTEGER NOT NULL,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- DRIVER TEMPLATES
-- ============================================================

CREATE TABLE IF NOT EXISTS driver_templates (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  nationality     TEXT    NOT NULL DEFAULT 'Unknown',
  portrait        TEXT,
  art             TEXT,
  base_speed      INTEGER NOT NULL DEFAULT 50,
  base_skill      INTEGER NOT NULL DEFAULT 50,
  base_stamina    INTEGER NOT NULL DEFAULT 50,
  base_aggression INTEGER NOT NULL DEFAULT 50,
  rarity          TEXT    NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary')),
  unlock_cost     INTEGER NOT NULL DEFAULT 1000,
  bio             TEXT
);

-- ============================================================
-- PLAYERS' DRIVERS (instances)
-- ============================================================

CREATE TABLE IF NOT EXISTS drivers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id   INTEGER NOT NULL REFERENCES driver_templates(id),
  nickname      TEXT,
  level         INTEGER NOT NULL DEFAULT 1,
  xp            INTEGER NOT NULL DEFAULT 0,
  speed         INTEGER NOT NULL DEFAULT 50,
  skill         INTEGER NOT NULL DEFAULT 50,
  stamina       INTEGER NOT NULL DEFAULT 50,
  aggression    INTEGER NOT NULL DEFAULT 50,
  morale        INTEGER NOT NULL DEFAULT 100,
  wins          INTEGER NOT NULL DEFAULT 0,
  races         INTEGER NOT NULL DEFAULT 0,
  status        TEXT    NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','racing','injured','retired')),
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- ENGINEER TEMPLATES
-- ============================================================

CREATE TABLE IF NOT EXISTS engineer_templates (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  name                TEXT    NOT NULL,
  nationality         TEXT    NOT NULL DEFAULT 'Unknown',
  portrait            TEXT,
  art                 TEXT,
  base_craft_speed    INTEGER NOT NULL DEFAULT 50,
  base_quality_bonus  INTEGER NOT NULL DEFAULT 50,
  base_race_bonus     INTEGER NOT NULL DEFAULT 20,
  rarity              TEXT    NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary')),
  unlock_cost         INTEGER NOT NULL DEFAULT 1000,
  bio                 TEXT
);

-- ============================================================
-- PLAYERS' ENGINEERS (instances)
-- ============================================================

CREATE TABLE IF NOT EXISTS engineers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id     INTEGER NOT NULL REFERENCES engineer_templates(id),
  nickname        TEXT,
  level           INTEGER NOT NULL DEFAULT 1,
  xp              INTEGER NOT NULL DEFAULT 0,
  craft_speed     INTEGER NOT NULL DEFAULT 50,
  quality_bonus   INTEGER NOT NULL DEFAULT 50,
  race_bonus      INTEGER NOT NULL DEFAULT 20,
  status          TEXT    NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','crafting','racing')),
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- RACE CIRCUITS
-- ============================================================

CREATE TABLE IF NOT EXISTS circuits (
  id               INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  name             TEXT    NOT NULL,
  location         TEXT    NOT NULL,
  image            TEXT,
  difficulty       INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  laps             INTEGER NOT NULL DEFAULT 10,
  reward_credits   INTEGER NOT NULL DEFAULT 500,
  reward_materials TEXT    NOT NULL DEFAULT '[]',  -- JSON: [{material_id, qty}]
  reward_prestige  INTEGER NOT NULL DEFAULT 10,
  unlock_level     INTEGER NOT NULL DEFAULT 1,
  description      TEXT,
  archetype        TEXT,                            -- NULL = any archetype allowed
  min_speed        INTEGER NOT NULL DEFAULT 0,
  min_handling     INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 300,
  podium_rewards   TEXT    NOT NULL DEFAULT '[]'   -- JSON: [{position, credits_bonus, prestige_bonus}]
);

-- ============================================================
-- RACE EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS races (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  circuit_id   INTEGER NOT NULL REFERENCES circuits(id),
  driver_id    INTEGER NOT NULL REFERENCES drivers(id),
  engineer_id  INTEGER REFERENCES engineers(id),
  car_id       INTEGER NOT NULL REFERENCES cars(id),
  status       TEXT    NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','failed')),
  result       TEXT,
  started_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  completes_at INTEGER NOT NULL,
  completed_at INTEGER,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- WORKSHOP UPGRADES (per user)
-- ============================================================

CREATE TABLE IF NOT EXISTS workshop_upgrades (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  develop_slots     INTEGER NOT NULL DEFAULT 2,
  develop_speed     INTEGER NOT NULL DEFAULT 1,
  inventory_size    INTEGER NOT NULL DEFAULT 20,
  engineer_cap      INTEGER NOT NULL DEFAULT 3,
  driver_cap        INTEGER NOT NULL DEFAULT 5,
  garage_cap        INTEGER NOT NULL DEFAULT 10,
  market_mat_slots  INTEGER NOT NULL DEFAULT 0,
  market_mat_rarity INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- MARKETPLACE (player-to-player)
-- ============================================================

CREATE TABLE IF NOT EXISTS market_listings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_type TEXT    NOT NULL CHECK (listing_type IN ('car','part')),
  item_id      INTEGER NOT NULL,
  price        INTEGER NOT NULL,
  description  TEXT,
  status       TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','cancelled')),
  buyer_id     INTEGER REFERENCES users(id),
  listed_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  sold_at      INTEGER
);

-- ============================================================
-- MARKET: MATERIAL SLOTS (6 rotating slots, refreshes every 3 min)
-- ============================================================

CREATE TABLE IF NOT EXISTS market_material_slots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_index      INTEGER NOT NULL UNIQUE CHECK (slot_index BETWEEN 0 AND 5),
  material_id     INTEGER NOT NULL REFERENCES materials(id),
  quantity        INTEGER NOT NULL DEFAULT 1,
  price_per_unit  INTEGER NOT NULL DEFAULT 10,
  refresh_at      INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- MARKET: PART LISTINGS (rotating hourly)
-- ============================================================

CREATE TABLE IF NOT EXISTS market_part_listings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  part_id     INTEGER NOT NULL REFERENCES part_templates(id),
  price       INTEGER NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 1,
  listed_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at  INTEGER NOT NULL
);

-- ============================================================
-- GACHA: PITY TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS gacha_pity (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  banner      TEXT NOT NULL CHECK (banner IN ('driver','engineer')),
  pity_count  INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, banner)
);

-- ============================================================
-- LEADERBOARDS
-- ============================================================

CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category    TEXT    NOT NULL CHECK (category IN ('prestige','credits','wins','cars_sold')),
  score       INTEGER NOT NULL DEFAULT 0,
  rank        INTEGER,
  snapshot_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, category)
);

-- ============================================================
-- ACTIVITY LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            TEXT    NOT NULL,
  message         TEXT    NOT NULL,
  credits_delta   INTEGER NOT NULL DEFAULT 0,
  prestige_delta  INTEGER NOT NULL DEFAULT 0,
  data            TEXT    DEFAULT '{}',
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_drivers_user        ON drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_cars_user           ON cars(user_id);
CREATE INDEX IF NOT EXISTS idx_races_user          ON races(user_id);
CREATE INDEX IF NOT EXISTS idx_races_status        ON races(status);
CREATE INDEX IF NOT EXISTS idx_crafting_user       ON crafting_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_crafting_status     ON crafting_queue(status);
CREATE INDEX IF NOT EXISTS idx_car_crafting_user   ON car_crafting_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_market_active       ON market_listings(status);
CREATE INDEX IF NOT EXISTS idx_leaderboard_cat     ON leaderboard_snapshots(category, score DESC);
CREATE INDEX IF NOT EXISTS idx_activity_user       ON activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user       ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_engineers_user      ON engineers(user_id);
CREATE INDEX IF NOT EXISTS idx_inv_parts_user      ON inventory_parts(user_id);
CREATE INDEX IF NOT EXISTS idx_blueprints_user     ON user_blueprints(user_id);
