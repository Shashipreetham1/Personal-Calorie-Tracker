-- Nutrition goals.
--
-- APPEND ONLY: a goal is never UPDATEd or DELETEd. Changing a target inserts a
-- new row with a later effective_from, and the goal that applies to any given
-- day is the most recent row with effective_from <= that day.
--
-- Why: goal-vs-actual charts report history. If goals were mutable, raising
-- Wednesday's calorie target would retroactively rewrite Monday's chart and the
-- user would appear to have hit a target they never set.
--
-- Two rows may share an effective_from (the user changed their mind the same
-- day). That is intentional — history is preserved — so every read orders by
-- (effective_from DESC, id DESC) to pick the later of the two deterministically.

CREATE TABLE IF NOT EXISTS goals (
  id             serial PRIMARY KEY,
  user_id        int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  daily_calories int NOT NULL,
  protein_g      numeric(8, 2) NOT NULL,
  carbs_g        numeric(8, 2) NOT NULL,
  fat_g          numeric(8, 2) NOT NULL,
  weight_goal_kg numeric(6, 2),
  created_at     timestamptz NOT NULL DEFAULT now(),

  -- The API validates the same bounds with Zod and returns friendly messages;
  -- these are the last line of defence for anything reaching SQL another way.
  CONSTRAINT goals_calories_range CHECK (daily_calories BETWEEN 500 AND 10000),
  CONSTRAINT goals_protein_non_negative CHECK (protein_g >= 0),
  CONSTRAINT goals_carbs_non_negative CHECK (carbs_g >= 0),
  CONSTRAINT goals_fat_non_negative CHECK (fat_g >= 0),
  CONSTRAINT goals_weight_positive CHECK (weight_goal_kg IS NULL OR weight_goal_kg > 0)
);

-- Serves both "the goal in effect on date X" (the LATERAL join in the
-- goal-vs-actual report) and the paginated goal history listing.
CREATE INDEX IF NOT EXISTS idx_goals_user_effective_from
  ON goals (user_id, effective_from DESC);

COMMENT ON TABLE goals IS 'Append-only, date-effective nutrition goals. Never UPDATE or DELETE a row.';
