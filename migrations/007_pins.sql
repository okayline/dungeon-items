-- 007: the pinned copy, 2026-10-26 HST.
--
-- Each account can pin one numbered copy it holds, in any game (a 4Dungeon find, an 88x31 button, a Dawn Baton relic).
-- Every game reads it once when a run starts (registry.js pinned) and can mark it (markCarried). With no pin, or a pin on
-- a copy the account no longer holds, a game gets the account's newest copy instead. Not on the ledger: a pin is a
-- setting, not something that happened to the copy.
--
-- The accounts table has only an id and a time, so the pin is its own table. Only adds a table; nothing existing
-- changes. Safe to run twice. Run on the live items-db BEFORE deploying the Worker that uses it.
CREATE TABLE IF NOT EXISTS account_pins (
  account_id  INTEGER PRIMARY KEY REFERENCES accounts(id),
  item_id     INTEGER NOT NULL,
  copy        INTEGER NOT NULL,
  pinned_at   INTEGER NOT NULL,
  FOREIGN KEY (item_id, copy) REFERENCES copies (item_id, copy)
);
