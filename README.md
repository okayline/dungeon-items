# dungeon-items

The one item table every game reads: 4Dungeon, irl-dungeon, 88x31. Items are not copied between games; each game asks this table.

- **Database:** D1 `items-db` (id b39d9b77-fb44-4474-82b2-60252578f38a, region OC). Holds 98 items: 4Dungeon's 46 from `rules.js` (12 common, 12 uncommon, 12 rare, 6 mythic, 4 moon; ids 1-46) and 52 original-tier 88x31 buttons (36 common, 16 uncommon; ids 47-98).
- **Read API** (`src/worker.js`, GET only, public, CORS open so the itch.io page can call it):
  - `GET /api/items`: active items. `?source=4dungeon`, `?rarity=moon`, `?all=1` (include retired).
  - `GET /api/items/:id`: one item, retired ones too, so an old find always resolves.
- **Rules the database enforces:** items are never deleted (retire them with `retired = 1`); an item's id, source, source_key, rarity and created_at never change; ids only count up. A game stores an item by id.
- **Columns:** `source` + `source_key` say where it came from (`4dungeon` / `COMMON:3`; later `88x31` / design id; `irl-dungeon`). `alignment` (LAW/CHAOS/NEUTRAL) and `nature` (tech/spirit/both) are 4Dungeon's. `type` and `image` are for 88x31 buttons. `extra` is JSON for a game's own details (4Dungeon: `has_use`, `use_text`, `both_name`). The effect code for the three items with a use stays in 4Dungeon.

## Adding items
Write a `seed/*.json` list and run `node scripts/seed-sql.mjs seed/x.json`, then run the SQL on the live database. It is `INSERT OR IGNORE`: re-running adds nothing and never overwrites an edited item. `scripts/extract-4dungeon.mjs ../daily-dungeon/rules.js` rebuilds `seed/4dungeon.json` from 4Dungeon (it only reads rules.js).

## 88x31 buttons
`src/buttons.js` turns 88x31's public catalog (`GET https://88x31.app/api/designs`) into items: original tier, common or uncommon, uncapped, active, not hidden. Each keeps its name, type and picture address (`https://88x31.app/api/img?d=N`); no credit or license is stored. The table is a snapshot: refresh with `node scripts/sync-88x31.mjs` (run where 88x31.app is reachable; it fetches the API, or pass a saved copy) then `node scripts/seed-sql.mjs seed/88x31.json` and run the SQL. The first load (2026-10-15) used the same filter run against 88x31's database through the Cloudflare connector, since this session's shell cannot reach 88x31.app.

## The copy registry
Every numbered copy of an item, across all the games, and who holds it. Copy numbers count up per item from 1 with no gaps and are never reused, whichever game makes the copy (until now irl-dungeon counted its own).

- **Tables** (`migrations/002_registry.sql`, also in `schema.sql`): `copies` (item, copy number, the game and key that made it, the holder as game + that game's player id, how many times it has changed hands) and `ledger`, one SHA-256 hash chain of every birth and every move. A copy and its ledger entry are written in one D1 batch, so a copy is born or moved if and only if it is on the chain. Ledger records hold item, copy and game names only: never a player id or a key.
- **Rules the database enforces** (triggers): copies are never deleted; a copy's item, number and birth never change; a copy only changes hands, one move at a time; numbers never skip or repeat; a retired item makes no new copies; the ledger can't be edited or deleted.
- **Not public.** The read API above has no route for copies, and holders are never published. The registry is a Worker entrypoint (`src/rpc.js`, class `Registry`) that only a Worker with a service binding can call. The Worker's entry is `src/index.js` (the read API plus the entrypoint).
- **How a game uses it.** In its `wrangler.jsonc`: `"services": [{ "binding": "REGISTRY", "service": "dungeon-items", "entrypoint": "Registry" }]`. Then:
  - `await env.REGISTRY.birth({ itemId, game, playerId, key })` makes the next copy for that player: `{ itemId, copy, created }`, or `{ error }` (unknown or retired item, bad arguments, a key already used for another item). `key` is the game's own name for the moment (irl-dungeon: its find), so a retry returns the same copy with `created: false`.
  - `await env.REGISTRY.moveCopy({ itemId, copy, from: { game, playerId }, to: { game, playerId } })` hands a copy over: `{ ok: true, moves }` or `{ error }` (not the holder, no such copy, already theirs).
  - `await env.REGISTRY.heldBy(game, playerId)` lists what a player holds: `[{ itemId, copy, moves }]`. `await env.REGISTRY.verify()` checks the whole chain: `{ ok, count, head }`.
- **Limits.** The chain can't show that its newest entries were dropped; keep the `head` that `verify` returns somewhere else. A game names itself in each call and the entrypoint believes it. If more than eight writers race for the same head at the same instant, the last ones get "The registry is busy" and should try again.
- **Going live.** Run `migrations/002_registry.sql` on `items-db`, then deploy this Worker (so the `Registry` entrypoint exists), and only then deploy a game that binds it.

## Not done yet
- 4Dungeon doesn't read the table yet. A button that leaves 88x31's catalog isn't retired automatically.
