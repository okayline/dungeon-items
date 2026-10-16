# dungeon-items

The one item table every game reads: 4Dungeon, irl-dungeon, 88x31. Items are not copied between games; each game asks this table.

- **Database:** D1 `items-db` (id b39d9b77-fb44-4474-82b2-60252578f38a, region OC). Created and seeded with the 46 items from 4Dungeon's `rules.js` (12 common, 12 uncommon, 12 rare, 6 mythic, 4 moon), ids 1-46.
- **Read API** (`src/worker.js`, GET only, public, CORS open so the itch.io page can call it):
  - `GET /api/items`: active items. `?source=4dungeon`, `?rarity=moon`, `?all=1` (include retired).
  - `GET /api/items/:id`: one item, retired ones too, so an old find always resolves.
- **Rules the database enforces:** items are never deleted (retire them with `retired = 1`); an item's id, source, source_key, rarity and created_at never change; ids only count up. A game stores an item by id.
- **Columns:** `source` + `source_key` say where it came from (`4dungeon` / `COMMON:3`; later `88x31` / design id; `irl-dungeon`). `alignment` (LAW/CHAOS/NEUTRAL) and `nature` (tech/spirit/both) are 4Dungeon's. `type` and `image` are for 88x31 buttons. `extra` is JSON for a game's own details (4Dungeon: `has_use`, `use_text`, `both_name`). The effect code for the three items with a use stays in 4Dungeon.

## Adding items
Write a `seed/*.json` list and run `node scripts/seed-sql.mjs seed/x.json`, then run the SQL on the live database. It is `INSERT OR IGNORE`: re-running adds nothing and never overwrites an edited item. `scripts/extract-4dungeon.mjs ../daily-dungeon/rules.js` rebuilds `seed/4dungeon.json` from 4Dungeon (it only reads rules.js).

## Not done yet
- The Worker isn't deployed (needs a GitHub repo connected to Cloudflare; `wrangler.jsonc` is ready).
- No game reads the table yet. 88x31 buttons aren't in it yet.
