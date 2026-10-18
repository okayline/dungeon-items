-- 005: marks, the history of a copy (provenance), 2026-10-17 HST.
--
-- A mark is one thing that happened to one numbered copy: the sky it was found under, how it came to the bag, what the
-- Moon made of it. Marks belong to the copy, not the player, so the story follows the copy into any game. They are
-- append-only: never edited, never deleted, numbered 1, 2, 3 per copy with no gaps, and each one is sealed on the ledger
-- in the same batch. A mark never names a player.
--
--   kind 'night'  the sky when it happened         value: a moon phase (new, wax_cres, first_q, wax_gib, full, wan_gib, last_q, wan_cres)
--   kind 'deed'   what happened to it              value: found_wall, given_member, from_demon, from_stranger, carried_up
--   kind 'moon'   the Moon's judgment at the stairs value: answered, blessed
-- The value lists are the games' to grow (a new mark is a new value, no migration); the database only checks the shape.
-- A blessing counts the copy one tier higher in its game. The cap (the top of the ladder) is checked in registry.js.
--
-- Only adds a table and triggers; no item or copy changes. Safe to run twice. Run on the live items-db BEFORE deploying
-- the Worker that uses it.
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
