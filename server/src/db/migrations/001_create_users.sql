-- Users. Every other table hangs off this one; ON DELETE CASCADE everywhere
-- means removing a user removes their data with no orphan rows left behind.

CREATE TABLE IF NOT EXISTS users (
  id            serial PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name          text,
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- Emails are normalised to lowercase before insert. Enforcing it here means
  -- the UNIQUE constraint is genuinely case-insensitive: without it,
  -- Ada@x.com and ada@x.com would be two accounts.
  CONSTRAINT users_email_lowercase CHECK (email = lower(email)),
  CONSTRAINT users_email_not_blank CHECK (length(btrim(email)) > 0)
);

COMMENT ON TABLE users IS 'Application accounts. Passwords are bcrypt hashes, never plaintext.';
