# Working notes for dungeon-items

- **Push only when the user says to.** Pushing a connected repo deploys the Worker.
- **Ask before adding anything that wasn't asked for.**
- **Items are append-only.** Never delete or renumber; retire with `retired = 1`. A different thing is a new item. Don't weaken the triggers in `schema.sql`.
- **Tests must try to break the rules.** `npm test` must pass before any commit. Expected values come from raw SQL or hand lists, never from the code under test. A new rule gets a test, and the test must fail when the rule is removed.
- **Database changes** need a file in `migrations/`, `schema.sql` updated to match, and the live database migrated before the push that needs it.
- **4Dungeon is read only from here.** Never edit `daily-dungeon`; `seed/4dungeon.json` is extracted from its `rules.js`. Once seeded, this table is the master.
- No new dependencies without asking. Times in changelogs are Hawaii time.
