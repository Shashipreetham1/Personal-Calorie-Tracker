-- Food entries: one row per item consumed.
--
-- Macros get real numeric columns because they are a fixed set of three and are
-- SUMmed in every report. Micronutrients go in JSONB because the set is
-- open-ended — one label lists iron and B12, the next lists sodium and vitamin D
-- — and a column per micronutrient would mean a migration per label.

CREATE TABLE IF NOT EXISTS food_entries (
  id          serial PRIMARY KEY,
  user_id     int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consumed_at timestamptz NOT NULL,
  meal_type   text NOT NULL,
  food_name   text NOT NULL,
  quantity    numeric(10, 2) NOT NULL,
  unit        text,
  calories    numeric(10, 2) NOT NULL,
  protein_g   numeric(10, 2) NOT NULL DEFAULT 0,
  carbs_g     numeric(10, 2) NOT NULL DEFAULT 0,
  fat_g       numeric(10, 2) NOT NULL DEFAULT 0,
  micros      jsonb NOT NULL DEFAULT '{}'::jsonb,
  source      text NOT NULL DEFAULT 'manual',
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT food_entries_meal_type_valid
    CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snacks')),
  CONSTRAINT food_entries_source_valid
    CHECK (source IN ('manual', 'photo', 'chat', 'import')),
  CONSTRAINT food_entries_name_not_blank CHECK (length(btrim(food_name)) > 0),
  CONSTRAINT food_entries_quantity_positive CHECK (quantity > 0),
  CONSTRAINT food_entries_calories_non_negative CHECK (calories >= 0),
  CONSTRAINT food_entries_protein_non_negative CHECK (protein_g >= 0),
  CONSTRAINT food_entries_carbs_non_negative CHECK (carbs_g >= 0),
  CONSTRAINT food_entries_fat_non_negative CHECK (fat_g >= 0),
  -- micros must be a flat object, not an array or scalar: the micro report
  -- unnests it with jsonb_each_text, which errors on anything else.
  CONSTRAINT food_entries_micros_is_object CHECK (jsonb_typeof(micros) = 'object')
);

-- Covers the default listing (a user's entries, newest first) and every
-- report's date-range scan, which are the hot paths in this application.
CREATE INDEX IF NOT EXISTS idx_food_entries_user_consumed_at
  ON food_entries (user_id, consumed_at DESC);

-- Serves the meal-type filter on the history screen.
CREATE INDEX IF NOT EXISTS idx_food_entries_user_meal_type
  ON food_entries (user_id, meal_type);

COMMENT ON COLUMN food_entries.micros IS 'Open-ended micronutrients, e.g. {"iron_mg": 2.1, "vitamin_c_mg": 30}.';
COMMENT ON COLUMN food_entries.source IS 'How the row was created: manual form, photo extraction, chat, or PDF import.';
