-- Stories (migration 008): the written chapters of what happened on the L4D servers.
-- One chapter per round, numbered by round of the day (Hawaii date). Chapters are never edited or deleted.
-- Only titles and character names go in: never a player name, Steam ID or address.
CREATE TABLE IF NOT EXISTS stories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  day         TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),  -- Hawaii date
  chapter     INTEGER NOT NULL CHECK (chapter >= 1),                                         -- round of that day
  server      TEXT NOT NULL CHECK (length(server) BETWEEN 1 AND 40),
  map         TEXT NOT NULL,                                                                  -- e.g. l4d_hospital01_apartment
  title       TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  body        TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 20000),
  facts       TEXT,                                                                           -- the anonymous JSON the chapter was written from
  created_at  INTEGER NOT NULL,
  UNIQUE (day, chapter)
);

CREATE TRIGGER IF NOT EXISTS stories_no_update BEFORE UPDATE ON stories
BEGIN SELECT RAISE(ABORT, 'stories are never edited'); END;

CREATE TRIGGER IF NOT EXISTS stories_no_delete BEFORE DELETE ON stories
BEGIN SELECT RAISE(ABORT, 'stories are never deleted'); END;

-- chapter numbers count up per day with no gaps
CREATE TRIGGER IF NOT EXISTS stories_chapter_next BEFORE INSERT ON stories
WHEN NEW.chapter <> COALESCE((SELECT MAX(chapter) FROM stories WHERE day = NEW.day), 0) + 1
BEGIN SELECT RAISE(ABORT, 'chapter numbers count up per day with no gaps'); END;
