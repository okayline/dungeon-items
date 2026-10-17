-- 003: shared accounts. Run on the live database once, before deploying the Worker that uses them:
--   npx wrangler d1 execute items-db --remote --file=migrations/003_accounts.sql
-- Only adds tables; nothing existing changes. Safe to run twice.
-- Shared accounts (migration 003): one account per person across all the games.
CREATE TABLE IF NOT EXISTS accounts (
  id          INTEGER PRIMARY KEY,
  created_at  INTEGER NOT NULL
);

-- save codes; only their hash is stored (up to 5 per account)
CREATE TABLE IF NOT EXISTS account_codes (
  id            INTEGER PRIMARY KEY,
  account_id    INTEGER NOT NULL REFERENCES accounts(id),
  code_hash     TEXT NOT NULL UNIQUE,
  created_at    INTEGER NOT NULL,
  last_used_at  INTEGER
);
CREATE INDEX IF NOT EXISTS account_codes_account ON account_codes (account_id);

-- passkeys (WebAuthn): the public half of each key, for the shared RP ID (88x31.app)
CREATE TABLE IF NOT EXISTS account_passkeys (
  id            INTEGER PRIMARY KEY,
  account_id    INTEGER NOT NULL REFERENCES accounts(id),
  cred_id       TEXT NOT NULL UNIQUE,
  public_key    TEXT NOT NULL,          -- JWK
  alg           INTEGER NOT NULL,       -- -7 ES256, -257 RS256
  sign_count    INTEGER NOT NULL DEFAULT 0,
  label         TEXT,
  created_at    INTEGER NOT NULL,
  last_used_at  INTEGER
);
CREATE INDEX IF NOT EXISTS account_passkeys_account ON account_passkeys (account_id);

CREATE TABLE IF NOT EXISTS account_challenges (
  challenge   TEXT PRIMARY KEY,
  account_id  INTEGER,
  kind        TEXT NOT NULL,            -- register | login
  expires_at  INTEGER NOT NULL
);

-- which player this account is in each game (that game's own player id). One per game per account; a player is in one account.
CREATE TABLE IF NOT EXISTS account_players (
  account_id  INTEGER NOT NULL REFERENCES accounts(id),
  game        TEXT NOT NULL CHECK (length(game) BETWEEN 1 AND 40),
  player_id   INTEGER NOT NULL CHECK (player_id >= 1),
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (account_id, game),
  UNIQUE (game, player_id)
);

-- slows down guessing save codes and passkeys (hashed addresses only)
CREATE TABLE IF NOT EXISTS account_limits (
  key           TEXT NOT NULL,
  window_start  INTEGER NOT NULL,
  count         INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);
