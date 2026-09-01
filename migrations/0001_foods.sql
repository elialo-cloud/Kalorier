-- Kalorier: grund för livsmedelsdatabasen
CREATE TABLE IF NOT EXISTS foods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  kcal_per_100g REAL NOT NULL,
  protein_per_100g REAL NOT NULL DEFAULT 0,
  carbs_per_100g REAL NOT NULL DEFAULT 0,
  fat_per_100g REAL NOT NULL DEFAULT 0,
  fiber_per_100g REAL,
  edible_state TEXT,
  preparation TEXT,
  source TEXT,
  source_id TEXT,
  barcode TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name);
CREATE INDEX IF NOT EXISTS idx_foods_barcode ON foods(barcode);
CREATE INDEX IF NOT EXISTS idx_foods_source ON foods(source, source_id);

CREATE TABLE IF NOT EXISTS food_portions (
  id TEXT PRIMARY KEY,
  food_id TEXT NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grams REAL NOT NULL,
  UNIQUE(food_id, name)
);

CREATE INDEX IF NOT EXISTS idx_food_portions_food ON food_portions(food_id);
