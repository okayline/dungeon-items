# dungeon-items: working notes

## This repo

The one item table every game reads (4Dungeon, irl-dungeon, 88x31). It also holds the copy registry, marks, the shared accounts (`ACCOUNTS.md`) and the shared footer script. Items are not copied between games; each game asks this table. It runs as one Cloudflare Worker with the D1 database `items-db`. Pushing a connected repo deploys the Worker, so treat a push to `main` as a release.

**Layout.** `src/` (the Worker: `worker.js`, `registry.js`, `ledger.js`, `accounts.js`, `passkeys.js`, `footer.js` and others), `migrations/` and `schema.sql`, `seed/` (4dungeon.json, 88x31.json, dawn-baton.json), `scripts/` (extract and sync scripts), `test/`, `docs/`, `ACCOUNTS.md`, `CHANGELOG.md`.

**Rules**
- **Items are append-only.** Never delete or renumber; retire with `retired = 1`. A different thing is a new item. Don't weaken the triggers in `schema.sql`.
- **4Dungeon is read only from here.** Never edit `daily-dungeon`; `seed/4dungeon.json` is extracted from its `rules.js`. Once seeded, this table is the master.
- **Accounts** (`ACCOUNTS.md`): save codes, passkeys (RP ID 88x31.app) and game links for every game. Don't change how codes are hashed; games import old hashes as they are.
- **The footer is shared.** `src/footer.js` is served as `/footer.js` and every game's page loads it, so a change there changes every game. Games deploy after this Worker, not before.
- **The big view is shared.** `src/zoom.js` is served as `/zoom.js` (hold or hover a card or button to see it big and turn it, GPUs in 3D); games that load it all change with it. Each game passes its own face and pictures to `DDZoom.setup` (how-to at the top of the file).
- **Database changes** need a file in `migrations/`, `schema.sql` updated to match, and the live database migrated before the push that needs it.

**Testing.** `npm test` must pass before any commit, plus one quick check of whatever changed. Don't run big batteries, repeated or parallel simulations, or "break the rule on purpose" experiments unless asked. Expected values come from raw SQL or hand lists, not from the code under test. A new rule gets one test.
