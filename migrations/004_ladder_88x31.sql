-- 004: the shared rarity ladder, Ultra 1-of-1, home-game births, and spent copies (2026-10-17 HST).
--
-- The ladder, the same name in every game:  common < uncommon < rare < prototype < relic < ultra, plus moon (event).
-- Going forward only: an item keeps the rarity it was added with, so 4Dungeon's old 'mythic' items stay 'mythic'.
-- Ultra is 1-of-1: an ultra item can only ever have copy #1.
-- Prototype, relic and ultra items are only born in their home game (items.source); they can still move anywhere.
-- Common, uncommon and rare can be born by any game (irl-dungeon deals 4Dungeon's and 88x31's).
-- A copy can be spent (used up in its game, e.g. an 88x31 fusion): it stays in the table and on the ledger, never moves again.
--
-- Run on the live items-db BEFORE deploying the Worker that uses it:
--   npx wrangler d1 execute items-db --remote --file=migrations/004_ladder_88x31.sql
PRAGMA defer_foreign_keys = true;

-- The rarity CHECK can only change by rebuilding `items`, and D1 can't drop a table another table points at, so `copies`
-- (which points at items) is rebuilt with it, gaining its `spent` column on the way. Every row keeps its values.
-- Order: new items, new copies pointing at the new items, drop old copies, drop old items, rename both. The ledger is untouched.
CREATE TABLE items_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  source      TEXT NOT NULL CHECK (length(source) BETWEEN 1 AND 40),
  source_key  TEXT NOT NULL CHECK (length(source_key) BETWEEN 1 AND 80),
  rarity      TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'prototype', 'relic', 'ultra', 'moon', 'mythic')),
  name        TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  note        TEXT CHECK (note IS NULL OR length(note) <= 500),
  alignment   TEXT CHECK (alignment IS NULL OR alignment IN ('LAW', 'CHAOS', 'NEUTRAL')),
  nature      TEXT CHECK (nature IS NULL OR nature IN ('tech', 'spirit', 'both')),
  type        TEXT CHECK (type IS NULL OR length(type) <= 40),
  image       TEXT CHECK (image IS NULL OR length(image) <= 500),
  extra       TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(extra)),
  retired     INTEGER NOT NULL DEFAULT 0 CHECK (retired IN (0, 1)),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE (source, source_key)
);
INSERT INTO items_new (id, source, source_key, rarity, name, note, alignment, nature, type, image, extra, retired, created_at, updated_at)
  SELECT id, source, source_key, rarity, name, note, alignment, nature, type, image, extra, retired, created_at, updated_at FROM items;

CREATE TABLE copies_new (
  item_id     INTEGER NOT NULL REFERENCES items_new(id),
  copy        INTEGER NOT NULL CHECK (copy >= 1),
  born_game   TEXT NOT NULL CHECK (length(born_game) BETWEEN 1 AND 40),
  born_key    TEXT NOT NULL CHECK (length(born_key) BETWEEN 1 AND 200),
  holder_game TEXT NOT NULL CHECK (length(holder_game) BETWEEN 1 AND 40),
  holder_id   INTEGER NOT NULL CHECK (holder_id >= 1),
  moves       INTEGER NOT NULL DEFAULT 0 CHECK (moves >= 0),
  born_at     INTEGER NOT NULL,
  moved_at    INTEGER NOT NULL,
  spent       INTEGER NOT NULL DEFAULT 0 CHECK (spent IN (0, 1)),
  PRIMARY KEY (item_id, copy),
  UNIQUE (born_game, born_key)
);
INSERT INTO copies_new (item_id, copy, born_game, born_key, holder_game, holder_id, moves, born_at, moved_at)
  SELECT item_id, copy, born_game, born_key, holder_game, holder_id, moves, born_at, moved_at FROM copies;

DROP TABLE copies;
DROP TABLE items;
ALTER TABLE items_new RENAME TO items;     -- copies_new now points at `items`
ALTER TABLE copies_new RENAME TO copies;

CREATE INDEX IF NOT EXISTS items_by_rarity ON items (rarity, retired, id);
CREATE INDEX IF NOT EXISTS copies_by_holder ON copies (holder_game, holder_id, item_id, copy);

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
