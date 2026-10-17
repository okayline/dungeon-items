# Working notes for dungeon-items

- **Push only when the user says to.** Pushing a connected repo deploys the Worker.
- **Ask before adding anything that wasn't asked for.**
- **Items are append-only.** Never delete or renumber; retire with `retired = 1`. A different thing is a new item. Don't weaken the triggers in `schema.sql`.
- **Keep testing quick: 2-3 minutes in total, at most.** `npm test` must pass before any commit, plus one quick check of whatever changed. Don't run big batteries, repeated or parallel simulations, or "break the rule on purpose" experiments unless asked; if a check would take longer than that, say so and ask first. Expected values come from raw SQL or hand lists, not from the code under test. A new rule gets one test.
- **Database changes** need a file in `migrations/`, `schema.sql` updated to match, and the live database migrated before the push that needs it.
- **4Dungeon is read only from here.** Never edit `daily-dungeon`; `seed/4dungeon.json` is extracted from its `rules.js`. Once seeded, this table is the master.
- **Accounts** (`ACCOUNTS.md`): save codes, passkeys (RP ID 88x31.app) and game links for every game. Don't change how codes are hashed; games import old hashes as they are.
- No new dependencies without asking. Times in changelogs are Hawaii time.
