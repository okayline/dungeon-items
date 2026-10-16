-- 001: the items table (first version). Run on the live database once: npx wrangler d1 execute items-db --remote --file=migrations/001_items.sql
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
  rarity      TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'mythic', 'moon')),
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
