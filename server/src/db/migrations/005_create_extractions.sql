-- Audit log of every AI extraction attempt (nutrition label, plate photo, or
-- imported PDF).
--
-- The raw model response is kept verbatim, before validation. When a user
-- reports "it read the calories wrong", this is the only record of what the
-- model actually returned — the drafts it produced are discarded unless the
-- user confirms them.

CREATE TABLE IF NOT EXISTS extractions (
  id           serial PRIMARY KEY,
  user_id      int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type  text NOT NULL,
  raw_response jsonb,
  status       text NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT extractions_source_type_valid CHECK (source_type IN ('label', 'plate', 'pdf')),
  CONSTRAINT extractions_status_valid CHECK (status IN ('pending', 'success', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_extractions_user_created_at
  ON extractions (user_id, created_at DESC);

COMMENT ON TABLE extractions IS 'Audit trail of AI extractions. Never the source of truth for nutrition data.';
