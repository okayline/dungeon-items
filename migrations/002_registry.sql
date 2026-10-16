-- 002: the copy registry. Run on the live database once, AFTER 001 and before any game uses it:
--   npx wrangler d1 execute items-db --remote --file=migrations/002_registry.sql
-- Only adds tables and triggers; no item changes. Safe to run twice.
--
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
  PRIMARY KEY (item_id, copy),
  UNIQUE (born_game, born_key)
);
CREATE INDEX IF NOT EXISTS copies_by_holder ON copies (holder_game, holder_id, item_id, copy);

-- The ledger of copies: SHA-256( prev_hash + "|" + record ), the first entry chains from 64 zeros. prev_hash is UNIQUE, so
-- the chain can't fork and two writers racing for the head can't both win. Records hold item, copy and game names only:
-- no player ids, no keys. Who did it is in game + player_id, which nothing publishes.
CREATE TABLE IF NOT EXISTS ledger (
  id          INTEGER PRIMARY KEY,
  kind        TEXT NOT NULL,          -- 'copy' (born) or 'move'
  game        TEXT NOT NULL,          -- the game of whoever did it
  player_id   INTEGER NOT NULL,
  record      TEXT NOT NULL,          -- the sealed JSON record
  prev_hash   TEXT NOT NULL UNIQUE,
  hash        TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL
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
WHEN NEW.moves != OLD.moves + 1 OR (NEW.holder_game = OLD.holder_game AND NEW.holder_id = OLD.holder_id)
BEGIN
  SELECT RAISE(ABORT, 'a copy only changes hands, one move at a time');
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
