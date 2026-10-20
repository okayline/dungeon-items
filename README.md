# dungeon-items

The one item table every game reads: 4Dungeon, irl-dungeon, 88x31. It also holds the copy registry, marks and the shared accounts (`ACCOUNTS.md`). Items are not copied between games; each game asks this table.

- **Database:** D1 `items-db` (id b39d9b77-fb44-4474-82b2-60252578f38a, region OC). Holds 135 items (counted on the live table, 2026-10-19): 4Dungeon's 46 from `rules.js` (12 common, 12 uncommon, 12 rare, 6 mythic, 4 moon; ids 1-46) and 89 original-tier 88x31 buttons (36 common, 16 uncommon, 23 rare of which 4 are retired, 8 prototype, 6 ultra; the first 52 are ids 47-98, the rest came with migration 004).
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
- **Only 88x31's commons show in public** (`isMystery` in `src/public-ledger.js`): for every other 88x31 item the ledger, a copy's page and `/api/items` show only that it is an 88x31 button, with no name, picture or rarity. This is 88x31's logged-out Wall rule. Hashes still check, since records hold item ids only.
- **The ledger is public; holders are not.** `GET /api/registry/ledger?before=&limit=` lists the ledger newest first (item, copy number, game names, hashes, the time it was sealed; no player ids) and `/ledger` shows it as a page. `GET /api/registry/copy?item=&copy=` gives one copy's story (its item and every entry about it, newest first; no holder), shown at `/ledger?item=&copy=`; each line on the ledger page links to its copy. The read API above still has no route for copies, and holders are never published. `GET /api/registry/head` gives the entry count, newest hash and copy count, so `88x31-anchors` can timestamp it on Bitcoin every hour. The registry is a Worker entrypoint (`src/rpc.js`, class `Registry`) that only a Worker with a service binding can call. The Worker's entry is `src/index.js` (the read API plus the entrypoint).
- **How a game uses it.** In its `wrangler.jsonc`: `"services": [{ "binding": "REGISTRY", "service": "dungeon-items", "entrypoint": "Registry" }]`. Then:
  - `await env.REGISTRY.birth({ itemId, game, playerId, key })` makes the next copy for that player: `{ itemId, copy, created }`, or `{ error }` (unknown or retired item, bad arguments, a key already used for another item). `key` is the game's own name for the moment (irl-dungeon: its find), so a retry returns the same copy with `created: false`.
  - `await env.REGISTRY.moveCopy({ itemId, copy, from: { game, playerId }, to: { game, playerId } })` hands a copy over: `{ ok: true, moves }` or `{ error }` (not the holder, no such copy, already theirs).
  - `await env.REGISTRY.heldBy(game, playerId)` lists what a player holds: `[{ itemId, copy, moves }]`. `await env.REGISTRY.verify()` checks the whole chain: `{ ok, count, head }`.
  - `await env.REGISTRY.itemIds(game, keys)` gives a game's own item ids by `source_key`: `{ "<key>": id }`, so a game needn't hard-code an id.
- **Limits.** The chain can't show that its newest entries were dropped; keep the `head` that `verify` returns somewhere else. A game names itself in each call and the entrypoint believes it. If more than eight writers race for the same head at the same instant, the last ones get "The registry is busy" and should try again.
- **Going live.** Run `migrations/002_registry.sql` on `items-db`, then deploy this Worker (so the `Registry` entrypoint exists), and only then deploy a game that binds it.

## The shared ladder (migration 004, 2026-10-17)
**common · uncommon · rare · prototype · relic · ultra**, plus **moon** (event). The same names in every game; going
forward only (4Dungeon's old `mythic` items keep `mythic`). Enforced by the database:
- **Ultra is 1-of-1**: an ultra item only ever has copy #1.
- **Home game only**: prototype, relic and ultra copies are only born in the item's own game (`source`); any copy can
  still move to any game. Common, uncommon and rare can be born anywhere (irl-dungeon deals both games' items).
- **Spent copies** (`copies.spent`): used up in their game (an 88x31 fusion). They stay, on the ledger (`spend`), and never move again.
- A game's own **extra** rarities stay in that game (88x31's `special` quest rewards never come here).

`Registry` gains `spendCopy`. **88x31 over HTTP** (it's a Pages site): `POST /rpc/registry/<method>` with the same
`x-accounts-key` as the accounts route (`src/registry-http.js`): `birth`, `moveCopy`, `spendCopy`, `heldBy`, `addItems`,
`retireItems`, `itemIds`, `addMark`, `marksOf`. That door always acts as 88x31, whatever the arguments say, so the key can only touch 88x31's
own items and its players' copies. 88x31 keeps its own ledger as the master and mirrors into this one.

## Marks (migration 005, 2026-10-17)
A copy's history (provenance): one thing that happened to one numbered copy, stamped by the game it happened in. The
story belongs to the copy, so it follows the copy into any game.

- **Table** `marks` (`migrations/005_marks.sql`, also in `schema.sql`): item, copy, `n` (1, 2, 3 per copy), `kind`,
  `value`, the game that made it, its key and time. Kinds: `night` (the sky: a moon phase such as `full`), `deed` (what
  happened: `found_wall`, `given_member`, `from_demon`, `from_stranger`, `carried_up`) and `moon` (the Moon's judgment:
  `answered`, `blessed`). New values need no migration; the database only checks the shape (`a-z`, `0-9`, `_`).
- **Rules the database enforces:** marks are never edited or deleted; numbers count up per copy with no gaps; a used-up
  copy takes no marks; the moon only answers or blesses. Each mark is sealed on the ledger in the same batch, and the
  record never names a player.
- **Blessings:** a `blessed` mark counts the copy one tier higher in its game, up to mythic: common 3 times, uncommon 2,
  rare 1, anything else never (checked in `registry.js`). The game does the counting.
- **Calls** (`Registry` entrypoint): `await env.REGISTRY.addMark({ itemId, copy, holder: { game, playerId }, kind, value, key })`
  stamps a mark on a copy the holder holds: `{ ok: true, n, created }` (a retry with the same key gives back the same
  mark) or `{ error }`. `await env.REGISTRY.marksOf(itemId, copy)` is `[{ kind, value, game, at }]`, oldest first, and
  `heldBy` now carries each copy's `marks` too. The HTTP door (88x31) has `addMark` (only on a copy one of 88x31's players holds, stamped as made in 88x31) and `marksOf`.
  `await env.REGISTRY.copyStory(itemId, copy)` is one copy's public story (the item, `of` copies exist, `born_game`, `born_at`, `moves`, `used_up`, and every ledger entry about it, newest first; no holder), the same thing the `/ledger` page shows; `null` when there is no such copy.

## Dawn Baton's baton (seed/dawn-baton.json)
One item, **The Dawn Baton** (`dawn-baton` / `baton`, relic, so only Dawn Baton can make copies). When a lap closes, Dawn
Baton makes one numbered copy for it (key `lap:<n>`) and gives it to one of that lap's human stampers. A lap with no human
stamper makes no copy, so copy numbers count held laps, not days. Seed it with `node scripts/seed-sql.mjs seed/dawn-baton.json`
and run the SQL on `items-db` before deploying the Dawn Baton version that binds `REGISTRY`.

## Not done yet
- 4Dungeon reads the table through its generated `items.js` snapshot (v1.14), not live. A button that leaves 88x31's catalog isn't retired automatically.
- 4Dungeon stamps marks (since its v1.25), irl-dungeon (since its v0.22) and 88x31 (since its v0.46, from its registry sync, through the HTTP door's `addMark`).
