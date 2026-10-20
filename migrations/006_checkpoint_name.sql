-- 006: a name beside a checkpoint, 2026-10-20 HST.
--
-- A game's checkpoint can show the name its player picked for that game's public board (scoundrel.exe: the leaderboard
-- name). The name sits beside the entry, not in the sealed record, so the hashes don't cover it and no record ever
-- names a player. It is written with the entry (the ledger is append-only) and never changed after. NULL for every
-- other entry, and for players without a name.
--
-- Adds one column. ALTER TABLE can't be run twice: run it once on the live items-db BEFORE deploying the Worker that
-- uses it.
ALTER TABLE ledger ADD COLUMN name TEXT CHECK (name IS NULL OR length(name) BETWEEN 1 AND 40);
