# Shared accounts

One account per person, used by every game. Lives in this Worker as the `Accounts` entrypoint (`src/rpc.js`, logic in
`src/accounts.js` and `src/passkeys.js`), in the same `items-db` D1.

**What an account holds:** up to 5 save codes (hash only), up to 10 passkeys, and a link to that person's player in each game
(`account_players`: game + that game's own player id).

**What a game keeps:** its own players, its own cookie and all its own data. The game asks "who is this code / passkey?" and
gets an account id back, then calls `playerFor(accountId, game)`; no player yet means it links the browser's current player
(if that player has no account) or makes a new one. A game never reads account tables.

**Passkeys:** the RP ID is `88x31.app`, so a passkey made on any `https://*.88x31.app` page works on all of them. The game
passes its own request's `origin`; anything that isn't https and under `88x31.app` is refused. Passkeys from before (made on a
game's own address) can't carry over: players make a new one, and their save code still works everywhere. Tests set `RP_ID`.

**Adding a game:** add the service binding `{"binding":"ACCOUNTS","service":"dungeon-items","entrypoint":"Accounts"}`,
call the methods listed in `src/rpc.js` (irl-dungeon's `src/worker.js` "save codes and passkeys" section is the model),
and import its old save-code hashes with `importCode` (same hashing, so they work as is).

**Games using it:** 4Dungeon (game name `4dungeon`), Dawn Baton (`dawn-baton`), irl-dungeon (`irl-dungeon`) and scoundrel.exe (`scoundrel`), each with a service binding to the `Accounts` entrypoint; and 88x31 (a Cloudflare Pages site, so it calls plain HTTP: `POST /rpc/accounts/<method>` on this Worker through an ordinary service binding, with the `ACCOUNTS_KEY` secret, a random string of 16+ characters, set the same on both projects: `npx wrangler secret put ACCOUNTS_KEY` here and the Pages project's secret). Without the key the route answers 404. 88x31's three passkeys made on the bare `88x31.app` were imported with `scripts/import-passkeys.mjs`.

**Deploy order:** (1) run `migrations/003_accounts.sql` on the live `items-db`; (2) deploy dungeon-items; (3) deploy the games. All three steps have been done.
Each game moves a player's old save codes into their account the first time it sees them; old passkey rows stay unused.
