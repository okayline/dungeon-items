# Working notes for dungeon-items

- **Push only when the user says to.** Pushing a connected repo deploys the Worker.
- **Ask before adding anything that wasn't asked for.**
- **Items are append-only.** Never delete or renumber; retire with `retired = 1`. A different thing is a new item. Don't weaken the triggers in `schema.sql`.
- **Keep testing quick: 2-3 minutes in total, at most.** `npm test` must pass before any commit, plus one quick check of whatever changed. Don't run big batteries, repeated or parallel simulations, or "break the rule on purpose" experiments unless asked; if a check would take longer than that, say so and ask first. Expected values come from raw SQL or hand lists, not from the code under test. A new rule gets one test.
- **Database changes** need a file in `migrations/`, `schema.sql` updated to match, and the live database migrated before the push that needs it.
- **4Dungeon is read only from here.** Never edit `daily-dungeon`; `seed/4dungeon.json` is extracted from its `rules.js`. Once seeded, this table is the master.
- **Accounts** (`ACCOUNTS.md`): save codes, passkeys (RP ID 88x31.app) and game links for every game. Don't change how codes are hashed; games import old hashes as they are.
- No new dependencies without asking. Times in changelogs are Hawaii time.

## Working rules

The same twelve rules are in every Dungeons repo and in the project instructions. "ryan" is the owner.

**Answering questions**
1. Search before saying "no". For "does X exist" or "did we do X", search the project chat, all repos and the live state. Treat ryan's memory as true until a search disproves it.
2. Say what was and wasn't searched, and mark each claim as checked (with where) or guessed. If it isn't found, say "I couldn't find it", never "that isn't true".
3. Give honest answers on design, even "this isn't worth building". One recommendation, with "do nothing" as the alternative.

**Before proposing anything**
4. Name the goal it serves (4Dungeon: section 15 of the design doc). If none, don't propose it.
5. Say what it adds, takes away and touches, what it replaces or lets us delete, what already exists, and how it would most likely fail.
6. Propose the smallest version first.

**While building**
7. Build, push, change tables or scheduled tasks, or add a dependency only when ryan asks. Don't touch anything he didn't ask for, and list extras for approval.
8. Delete, don't park: no new flags or "off for now" code. Fix a shared problem once, in the shared place.
9. Say what ran and what didn't. Never "should work" without running it.
10. Each changelog line says what was removed as well as what was added.

**Working with ryan**
11. Silence means "not now": no nagging about unanswered questions, and raise each item at most once.
12. Disagree before building, not after. A bare "ok" to a long answer is not approval of everything in it.
