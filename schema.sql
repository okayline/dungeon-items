-- dungeon-items: the one item table every game reads (4Dungeon, irl-dungeon, 88x31).
--   npx wrangler d1 execute items-db --remote --file=schema.sql
--
-- Rules the database itself enforces (see the triggers):
--   * Items are never deleted. A thing that should stop being offered is RETIRED (retired = 1); players may still hold it.
--   * An item's id, source, source_key, rarity and created_at never change. Ids only count up (AUTOINCREMENT) and are
--     never reused or reordered, so a player's find can refer to an item by id for ever. A different thing is a new item.
--   * Text (name, note, alignment, nature, type, image, extra) can be edited; updated_at moves on its own.
CREATE TABLE IF NOT EXISTS items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  source      TEXT NOT NULL CHECK (length(source) BETWEEN 1 AND 40),   -- where the item comes from: '4dungeon', 'irl-dungeon', '88x31'
  source_key  TEXT NOT NULL CHECK (length(source_key) BETWEEN 1 AND 80),   -- its key at home ('COMMON:3' for 4Dungeon, the design id for 88x31)
  rarity      TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'prototype', 'relic', 'ultra', 'moon', 'mythic')),   -- the shared ladder (migration 004); 'mythic' is 4Dungeon's old top tier, kept on old items
  name        TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  note        TEXT CHECK (note IS NULL OR length(note) <= 500),         -- the one-line note, when there is one
  alignment   TEXT CHECK (alignment IS NULL OR alignment IN ('LAW', 'CHAOS', 'NEUTRAL')),
  nature      TEXT CHECK (nature IS NULL OR nature IN ('tech', 'spirit', 'both')),
  type        TEXT CHECK (type IS NULL OR length(type) <= 40),          -- an 88x31 button's type: neon, construction, ...
  image       TEXT CHECK (image IS NULL OR length(image) <= 500),       -- a picture, when there is one
  extra       TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(extra)),     -- a game's own details, as JSON (4Dungeon: use, use_text, both_name)
  retired     INTEGER NOT NULL DEFAULT 0 CHECK (retired IN (0, 1)),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE (source, source_key)
);
CREATE INDEX IF NOT EXISTS items_by_rarity ON items (rarity, retired, id);

CREATE TRIGGER IF NOT EXISTS items_never_deleted BEFORE DELETE ON items
BEGIN
  SELECT RAISE(ABORT, 'items are retired, never deleted');
END;

CREATE TRIGGER IF NOT EXISTS items_keep_identity BEFORE UPDATE ON items
WHEN NEW.id != OLD.id OR NEW.source != OLD.source OR NEW.source_key != OLD.source_key OR NEW.rarity != OLD.rarity OR NEW.created_at != OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'an items id, source, key, rarity and created_at never change: retire it and add a new one');
END;

CREATE TRIGGER IF NOT EXISTS items_touch AFTER UPDATE ON items
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE items SET updated_at = CAST(strftime('%s', 'now') AS INTEGER) WHERE id = NEW.id;
END;

-- The copy registry (migrations/002_registry.sql): numbered copies of items, who holds them, and their ledger.
-- Every numbered copy of an item, across all the games, and who holds it now. Copy numbers count up per item from 1 with
-- no gaps and are never reused, whichever game makes the copy. Holders are (game, that game's player id): never published.
-- Every birth and every move is also sealed on one hash chain (the ledger below), in the same D1 batch as the row it
-- records, so a copy is born or moved if and only if it is on the chain.
CREATE TABLE IF NOT EXISTS copies (
  item_id     INTEGER NOT NULL REFERENCES items(id),
  copy        INTEGER NOT NULL CHECK (copy >= 1),
  born_game   TEXT NOT NULL CHECK (length(born_game) BETWEEN 1 AND 40),     -- the game that made it
  born_key    TEXT NOT NULL CHECK (length(born_key) BETWEEN 1 AND 200),     -- that game's own key for the moment (a retry makes no second copy)
  holder_game TEXT NOT NULL CHECK (length(holder_game) BETWEEN 1 AND 40),
  holder_id   INTEGER NOT NULL CHECK (holder_id >= 1),                      -- that game's player id
  moves       INTEGER NOT NULL DEFAULT 0 CHECK (moves >= 0),
  born_at     INTEGER NOT NULL,
  moved_at    INTEGER NOT NULL,
  spent       INTEGER NOT NULL DEFAULT 0 CHECK (spent IN (0, 1)),          -- used up in its game (migration 004): never moves again
  PRIMARY KEY (item_id, copy),
  UNIQUE (born_game, born_key)
);
CREATE INDEX IF NOT EXISTS copies_by_holder ON copies (holder_game, holder_id, item_id, copy);

-- The ledger of copies: SHA-256( prev_hash + "|" + record ), the first entry chains from 64 zeros. prev_hash is UNIQUE, so
-- the chain can't fork and two writers racing for the head can't both win. Records hold item, copy and game names only:
-- no player ids, no keys. Who did it is in game + player_id, which nothing publishes.
CREATE TABLE IF NOT EXISTS ledger (
  id          INTEGER PRIMARY KEY,
  kind        TEXT NOT NULL,          -- 'copy' (born), 'move' or 'spend'
  game        TEXT NOT NULL,          -- the game of whoever did it
  player_id   INTEGER NOT NULL,
  record      TEXT NOT NULL,          -- the sealed JSON record
  prev_hash   TEXT NOT NULL UNIQUE,
  hash        TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL,
  name        TEXT CHECK (name IS NULL OR length(name) BETWEEN 1 AND 40)   -- a checkpoint's player name, beside the record and not sealed (migration 006)
);

CREATE TRIGGER IF NOT EXISTS copies_never_deleted BEFORE DELETE ON copies
BEGIN
  SELECT RAISE(ABORT, 'copies are never deleted');
END;

CREATE TRIGGER IF NOT EXISTS copies_keep_birth BEFORE UPDATE ON copies
WHEN NEW.item_id != OLD.item_id OR NEW.copy != OLD.copy OR NEW.born_game != OLD.born_game OR NEW.born_key != OLD.born_key OR NEW.born_at != OLD.born_at
BEGIN
  SELECT RAISE(ABORT, 'a copys item, number and birth never change');
END;

CREATE TRIGGER IF NOT EXISTS copies_one_move BEFORE UPDATE ON copies
WHEN NEW.spent = OLD.spent AND (NEW.moves != OLD.moves + 1 OR (NEW.holder_game = OLD.holder_game AND NEW.holder_id = OLD.holder_id))
BEGIN
  SELECT RAISE(ABORT, 'a copy only changes hands, one move at a time');
END;

CREATE TRIGGER IF NOT EXISTS copies_spend_once BEFORE UPDATE ON copies
WHEN OLD.spent = 1 OR (NEW.spent != OLD.spent AND (NEW.moves != OLD.moves OR NEW.holder_game != OLD.holder_game OR NEW.holder_id != OLD.holder_id))
BEGIN
  SELECT RAISE(ABORT, 'a spent copy never changes again; spending changes nothing else');
END;

-- Ultra is 1-of-1; prototype, relic and ultra are only born in their home game (migration 004).
CREATE TRIGGER IF NOT EXISTS copies_ultra_one BEFORE INSERT ON copies
WHEN NEW.copy > 1 AND (SELECT rarity FROM items WHERE id = NEW.item_id) = 'ultra'
BEGIN
  SELECT RAISE(ABORT, 'an ultra is 1-of-1');
END;

CREATE TRIGGER IF NOT EXISTS copies_home_only BEFORE INSERT ON copies
WHEN (SELECT rarity FROM items WHERE id = NEW.item_id) IN ('prototype', 'relic', 'ultra')
  AND NEW.born_game != (SELECT source FROM items WHERE id = NEW.item_id)
BEGIN
  SELECT RAISE(ABORT, 'only its home game makes this item');
END;

CREATE TRIGGER IF NOT EXISTS copies_count_up BEFORE INSERT ON copies
WHEN NEW.copy != (SELECT COALESCE(MAX(copy), 0) + 1 FROM copies WHERE item_id = NEW.item_id)
BEGIN
  SELECT RAISE(ABORT, 'copy numbers count up from 1 with no gaps');
END;

CREATE TRIGGER IF NOT EXISTS copies_not_retired BEFORE INSERT ON copies
WHEN (SELECT retired FROM items WHERE id = NEW.item_id) = 1
BEGIN
  SELECT RAISE(ABORT, 'a retired item makes no new copies');
END;

CREATE TRIGGER IF NOT EXISTS ledger_no_edits BEFORE UPDATE ON ledger
BEGIN
  SELECT RAISE(ABORT, 'the ledger is append-only');
END;

CREATE TRIGGER IF NOT EXISTS ledger_no_deletes BEFORE DELETE ON ledger
BEGIN
  SELECT RAISE(ABORT, 'the ledger is append-only');
END;

-- Marks, the history of a copy (migration 005): see migrations/005_marks.sql for the value lists.
CREATE TABLE IF NOT EXISTS marks (
  item_id   INTEGER NOT NULL,
  copy      INTEGER NOT NULL,
  n         INTEGER NOT NULL CHECK (n >= 1),                                   -- 1, 2, 3 per copy
  kind      TEXT NOT NULL CHECK (kind IN ('night', 'deed', 'moon')),
  value     TEXT NOT NULL CHECK (length(value) BETWEEN 1 AND 40 AND value NOT GLOB '*[^a-z0-9_]*'),
  game      TEXT NOT NULL CHECK (length(game) BETWEEN 1 AND 40),              -- the game that made the mark
  mark_key  TEXT NOT NULL CHECK (length(mark_key) BETWEEN 1 AND 200),         -- that game's key for the moment (a retry makes no second mark)
  made_at   INTEGER NOT NULL,
  PRIMARY KEY (item_id, copy, n),
  UNIQUE (game, mark_key),
  FOREIGN KEY (item_id, copy) REFERENCES copies (item_id, copy)
);

CREATE TRIGGER IF NOT EXISTS marks_no_edits BEFORE UPDATE ON marks
BEGIN
  SELECT RAISE(ABORT, 'marks are never changed');
END;

CREATE TRIGGER IF NOT EXISTS marks_no_deletes BEFORE DELETE ON marks
BEGIN
  SELECT RAISE(ABORT, 'marks are never deleted');
END;

CREATE TRIGGER IF NOT EXISTS marks_count_up BEFORE INSERT ON marks
WHEN NEW.n != (SELECT COALESCE(MAX(n), 0) + 1 FROM marks WHERE item_id = NEW.item_id AND copy = NEW.copy)
BEGIN
  SELECT RAISE(ABORT, 'marks count up from 1 with no gaps');
END;

CREATE TRIGGER IF NOT EXISTS marks_on_a_live_copy BEFORE INSERT ON marks
WHEN COALESCE((SELECT spent FROM copies WHERE item_id = NEW.item_id AND copy = NEW.copy), 1) = 1
BEGIN
  SELECT RAISE(ABORT, 'a mark needs a copy that exists and is not used up');
END;

CREATE TRIGGER IF NOT EXISTS marks_moon_values BEFORE INSERT ON marks
WHEN NEW.kind = 'moon' AND NEW.value NOT IN ('answered', 'blessed')
BEGIN
  SELECT RAISE(ABORT, 'the moon only answers or blesses');
END;

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
