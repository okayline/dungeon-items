-- Reliefs (migration 010): a button's height map, read from the file it was 3D printed from (kura, Nov 5), so a game can show
-- the button as it was printed. One per item. The map is 31 rows of 88 digits, the picture's top row first: each digit a pixel's
-- level; a pixel stands floor_mm + level * step_mm tall (each map its own: kura, Nov 5, made two of them deeper than 0.4 mm steps).
-- scripts/relief.mjs reads one from an OBJ, and makes an OBJ from one.
CREATE TABLE IF NOT EXISTS reliefs (
  item_id     INTEGER PRIMARY KEY REFERENCES items(id),
  map         TEXT NOT NULL CHECK (length(map) = 2728 AND map NOT GLOB '*[^0-9]*'),
  floor_mm    REAL NOT NULL CHECK (floor_mm > 0),   -- how tall a level-0 pixel stands, from the bottom of the print
  step_mm     REAL NOT NULL CHECK (step_mm > 0),    -- how much taller each level is
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
