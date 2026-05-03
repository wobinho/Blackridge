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
  brand_logo  TEXT,                         -- asset path
  prestige    INTEGER NOT NULL DEFAULT 0,
  credits     INTEGER NOT NULL DEFAULT 5000,
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
-- GAME DATA: DRIVER TEMPLATES (hardcoded logic, db data)
-- ============================================================

CREATE TABLE IF NOT EXISTS driver_templates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  nationality TEXT    NOT NULL DEFAULT 'Unknown',
  portrait    TEXT,                           -- asset path placeholder
  art         TEXT,                           -- slug used to resolve /assets/drivers/<art>.<ext>
  base_speed  INTEGER NOT NULL DEFAULT 50,    -- 0-100
  base_skill  INTEGER NOT NULL DEFAULT 50,
  base_stamina INTEGER NOT NULL DEFAULT 50,
  base_aggression INTEGER NOT NULL DEFAULT 50,
  rarity      TEXT    NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary')),
  unlock_cost INTEGER NOT NULL DEFAULT 1000,
  bio         TEXT
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
  morale        INTEGER NOT NULL DEFAULT 100,  -- 0-100
  wins          INTEGER NOT NULL DEFAULT 0,
  races         INTEGER NOT NULL DEFAULT 0,
  status        TEXT    NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','racing','injured','retired')),
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- CAR PARTS (templates)
-- ============================================================

CREATE TABLE IF NOT EXISTS part_templates (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  category     TEXT    NOT NULL CHECK (category IN ('engine','chassis','suspension','aerodynamics','tyres','electronics','brakes')),
  tier         INTEGER NOT NULL DEFAULT 1 CHECK (tier BETWEEN 1 AND 5),
  image        TEXT,
  art          TEXT,                           -- slug used to resolve /assets/parts/<art>.<ext>
  stat_speed   INTEGER NOT NULL DEFAULT 0,
  stat_handling INTEGER NOT NULL DEFAULT 0,
  stat_durability INTEGER NOT NULL DEFAULT 0,
  stat_acceleration INTEGER NOT NULL DEFAULT 0,
  craft_time   INTEGER NOT NULL DEFAULT 60,    -- seconds
  sell_price   INTEGER NOT NULL DEFAULT 500,
  ingredients  TEXT    NOT NULL DEFAULT '[]',  -- JSON: [{part_id, qty}]
  base_materials TEXT  NOT NULL DEFAULT '[]'   -- JSON: [{material_id, qty}]
);

-- ============================================================
-- MATERIALS (raw resources)
-- ============================================================

CREATE TABLE IF NOT EXISTS materials (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  description TEXT,
  image       TEXT,
  rarity      TEXT    NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','uncommon','rare','epic')),
  base_value  INTEGER NOT NULL DEFAULT 10
);

-- ============================================================
-- PLAYER INVENTORY: PARTS
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_parts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  part_id       INTEGER NOT NULL REFERENCES part_templates(id),
  quantity      INTEGER NOT NULL DEFAULT 1,
  quality       INTEGER NOT NULL DEFAULT 100,   -- 0-100 condition
  for_sale      INTEGER NOT NULL DEFAULT 0,     -- boolean
  sale_price    INTEGER,
  crafted_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, part_id)
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
-- CARS (assembled)
-- ============================================================

CREATE TABLE IF NOT EXISTS car_templates (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  model_code   TEXT    NOT NULL UNIQUE,
  image        TEXT,
  art          TEXT,                           -- slug used to resolve /assets/cars/<art>.<ext>
  tier         INTEGER NOT NULL DEFAULT 1,
  base_speed   INTEGER NOT NULL DEFAULT 50,
  base_handling INTEGER NOT NULL DEFAULT 50,
  description  TEXT,
  unlock_level INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS cars (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id  INTEGER NOT NULL REFERENCES car_templates(id),
  name         TEXT    NOT NULL,
  color        TEXT    NOT NULL DEFAULT '#e8001c',
  speed        INTEGER NOT NULL DEFAULT 50,
  handling     INTEGER NOT NULL DEFAULT 50,
  durability   INTEGER NOT NULL DEFAULT 100,
  acceleration INTEGER NOT NULL DEFAULT 50,
  status       TEXT    NOT NULL DEFAULT 'garage' CHECK (status IN ('garage','racing','for_sale','sold')),
  sale_price   INTEGER,
  total_races  INTEGER NOT NULL DEFAULT 0,
  total_wins   INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Parts installed on a car
CREATE TABLE IF NOT EXISTS car_parts (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  car_id    INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  part_id   INTEGER NOT NULL REFERENCES part_templates(id),
  slot      TEXT    NOT NULL CHECK (slot IN ('engine','chassis','suspension','aerodynamics','tyres','electronics','brakes'))
);

-- ============================================================
-- RACE CIRCUITS
-- ============================================================

CREATE TABLE IF NOT EXISTS circuits (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  location     TEXT    NOT NULL,
  image        TEXT,
  difficulty   INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  laps         INTEGER NOT NULL DEFAULT 10,
  reward_credits INTEGER NOT NULL DEFAULT 500,
  reward_materials TEXT NOT NULL DEFAULT '[]',  -- JSON
  reward_prestige  INTEGER NOT NULL DEFAULT 10,
  unlock_level INTEGER NOT NULL DEFAULT 1,
  description  TEXT
);

-- ============================================================
-- RACE EVENTS (auto-battle sessions)
-- ============================================================

CREATE TABLE IF NOT EXISTS races (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  circuit_id  INTEGER NOT NULL REFERENCES circuits(id),
  driver_id   INTEGER NOT NULL REFERENCES drivers(id),
  car_id      INTEGER NOT NULL REFERENCES cars(id),
  status      TEXT    NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','failed')),
  result      TEXT,              -- JSON: {position, time, reward}
  started_at  INTEGER,
  completed_at INTEGER,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- CRAFTING QUEUE
-- ============================================================

CREATE TABLE IF NOT EXISTS crafting_queue (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  part_id      INTEGER NOT NULL REFERENCES part_templates(id),
  quantity     INTEGER NOT NULL DEFAULT 1,
  status       TEXT    NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','crafting','completed','cancelled')),
  started_at   INTEGER,
  completes_at INTEGER,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- MARKETPLACE (player-to-player listing)
-- ============================================================

CREATE TABLE IF NOT EXISTS market_listings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_type TEXT    NOT NULL CHECK (listing_type IN ('car','part')),
  item_id      INTEGER NOT NULL,              -- car_id or inventory_parts.id
  price        INTEGER NOT NULL,
  description  TEXT,
  status       TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','cancelled')),
  buyer_id     INTEGER REFERENCES users(id),
  listed_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  sold_at      INTEGER
);

-- ============================================================
-- LEADERBOARDS (denormalized for performance)
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
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT    NOT NULL,   -- 'race_complete','craft_complete','sale','purchase', etc.
  message    TEXT    NOT NULL,
  credits_delta INTEGER NOT NULL DEFAULT 0,
  prestige_delta INTEGER NOT NULL DEFAULT 0,
  data       TEXT    DEFAULT '{}',  -- JSON payload
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_drivers_user ON drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_cars_user ON cars(user_id);
CREATE INDEX IF NOT EXISTS idx_races_user ON races(user_id);
CREATE INDEX IF NOT EXISTS idx_races_status ON races(status);
CREATE INDEX IF NOT EXISTS idx_crafting_user ON crafting_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_market_active ON market_listings(status);
CREATE INDEX IF NOT EXISTS idx_leaderboard_cat ON leaderboard_snapshots(category, score DESC);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
