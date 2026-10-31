# dungeon-items: working notes

## This repo

The one item table every game reads (4Dungeon, irl-dungeon, 88x31). It also holds the copy registry, marks, the shared accounts (`ACCOUNTS.md`) and the shared footer script. Items are not copied between games; each game asks this table. It runs as one Cloudflare Worker with the D1 database `items-db`. Pushing a connected repo deploys the Worker, so treat a push to `main` as a release.

**Layout.** `src/` (the Worker: `worker.js`, `registry.js`, `ledger.js`, `accounts.js`, `passkeys.js`, `footer.js` and others), `migrations/` and `schema.sql`, `seed/` (4dungeon.json, 88x31.json, dawn-baton.json), `scripts/` (extract and sync scripts), `test/`, `docs/`, `ACCOUNTS.md`, `CHANGELOG.md`.

**Rules**
- **Items are append-only.** Never delete or renumber; retire with `retired = 1`. A different thing is a new item. Don't weaken the triggers in `schema.sql`.
- **4Dungeon is read only from here.** Never edit `daily-dungeon`; `seed/4dungeon.json` is extracted from its `rules.js`. Once seeded, this table is the master.
- **Accounts** (`ACCOUNTS.md`): save codes, passkeys (RP ID 88x31.app) and game links for every game. Don't change how codes are hashed; games import old hashes as they are.
- **The footer is shared.** `src/footer.js` is served as `/footer.js` and every game's page loads it, so a change there changes every game. Games deploy after this Worker, not before.
- **Database changes** need a file in `migrations/`, `schema.sql` updated to match, and the live database migrated before the push that needs it.

**Testing.** `npm test` must pass before any commit, plus one quick check of whatever changed. Don't run big batteries, repeated or parallel simulations, or "break the rule on purpose" experiments unless asked. Expected values come from raw SQL or hand lists, not from the code under test. A new rule gets one test.

<!-- BEGIN SHARED RULES v8 (2026-10-31). One copy of this block is in every Dungeons repo's CLAUDE.md. The source is dungeon-notes/SHARED-RULES.md. Don't edit the block inside a repo: change the source, then copy it into every repo. -->
## Working rules (shared by every repo)

"kura" is the owner. "4Dungeon" is the repo `daily-dungeon`. Other Claude chats work in these repos and share no memory with you: the repo and its changelog are the shared record. A repo section above beats a rule below, except rules 1 to 4.

**Honesty (never broken)**
1. Never lie. State as fact only what you opened, read or ran this turn; the rest is "not checked", or isn't said. Label opinions "my opinion". "Should work" and "probably" count as not checked.
2. Answers about code or data end with "Not checked:".
3. Check first, then reply once. If you were wrong, the first sentence says what you said, what is true, and the source.
4. Never say something was done, pushed or fixed unless you saw it succeed. Report failures plainly.

**Searching**
5. Before saying "no", or recommending something new, search the chat (if you can reach it), every repo you can reach, and the live state. Say what you searched and what you found. Say "I couldn't find it", never "that isn't true". If kura remembers something you can't find, don't call kura wrong, and don't state it as fact.

**Design**
6. Give honest answers, including "this isn't worth building". Give one recommendation. Never tell kura to playtest the game.
7. Before proposing, name the goal it serves (4Dungeon: `dungeon-notes/daily-dungeon-design.md`, section 15) and how it would most likely fail. No goal, no proposal. Propose the smallest version first.

**Building**
8. Commit locally as asked. Push only when kura says to. "Push" means: commit everything that's changed and push it all to `main` (in repos that deploy from `main`, that also puts it live). Bump the version (with the changelog entry and the dev changelog entry the repo asks for) only when the game itself changes. A push that doesn't change how the game plays (icons, footer, wording, styling) gets one line in the public changelog under an unversioned heading, such as `## Tab icon` with "(no new version: the game itself is unchanged)", and no version bump or dev entry. This rule beats a repo section that says every push is a release.
9. Don't add anything kura didn't ask for (a button, a screen, a page, a feature), change tables or scheduled tasks, or add a dependency: ask first.
10. Delete, don't park: no new flags or "off for now" code. Fix a shared problem once, in the shared place. Prefer changing what exists to adding a file. Each changelog line says what was removed as well as what was added.
11. No new secrets (passwords, tokens, keys such as `DAILY_SECRET`) in files, commits or replies. If you find one already committed, tell kura, and don't repeat it.

**Working with kura**
12. Don't act without kura's explicit permission. A question gets an answer, not an action: "Can you remove that rule?" is a request; "What happens if we remove that rule?" is a question. If you can't tell which, answer, then ask "want me to do it?" and wait. Reading and searching to find the answer is fine.
13. Disagree before building, not after. Silence means "not now": raise each item once.

**Defaults**
- Testing takes 2 to 3 minutes in total, with no edge cases. A repo's required check (such as `npm test`) counts toward that. Need more? Ask first.
- Times are Hawaii time (HST) unless a file says otherwise (88x31-anchors receipts are UTC).
- Some repos get automated commits: fetch before you push.
<!-- END SHARED RULES v8 -->
