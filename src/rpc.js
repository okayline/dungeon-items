// The registry as the games see it: a Worker entrypoint, called through a service binding (Workers RPC), so the games
// never touch `copies` or `ledger` themselves. All the rules are in registry.js; this class only hands each call the
// `items-db` binding. It isn't reachable over HTTP: only a Worker with a service binding to it can call these.
//
// In a game's wrangler.jsonc:
//   "services": [ { "binding": "REGISTRY", "service": "dungeon-items", "entrypoint": "Registry" } ]
// and in its code:
//   const { copy, error } = await env.REGISTRY.birth({ itemId, game: "irl-dungeon", playerId, key });
//
// This file imports "cloudflare:workers", which only exists on Cloudflare, so nothing else imports it; the tests
// load it with a stand-in for that module (test/rpc.test.mjs).
import { WorkerEntrypoint } from "cloudflare:workers";
import { birth, moveCopy, spendCopy, heldBy, whereIs, verify, addMark, addMarks, marksOf, itemIds, checkpoint, sealRun, heldAcross, pinned, pin, markCarried } from "./registry.js";
import { copyStory } from "./public-ledger.js";
import * as A from "./accounts.js";

export class Registry extends WorkerEntrypoint {
  birth(args) { return birth(this.env.DB, args); }
  moveCopy(args) { return moveCopy(this.env.DB, args); }
  spendCopy(args) { return spendCopy(this.env.DB, args); }
  heldBy(game, playerId) { return heldBy(this.env.DB, game, playerId); }
  whereIs(itemId, copy) { return whereIs(this.env.DB, itemId, copy); }
  verify() { return verify(this.env.DB); }
  addMark(args) { return addMark(this.env.DB, args); }
  addMarks(args) { return addMarks(this.env.DB, args); }   // one entry for everything a move did to many copies
  marksOf(itemId, copy) { return marksOf(this.env.DB, itemId, copy); }
  copyStory(itemId, copy) { return copyStory(this.env.DB, itemId, copy); }   // one copy's public story (what /ledger shows), for a game's own screen
  itemIds(game, keys) { return itemIds(this.env.DB, game, keys); }   // a game's own item ids by source_key: { "<key>": id } (Dawn Baton finds its baton this way)
  checkpoint(args) { return checkpoint(this.env.DB, args); }   // a game's own ledger head (and its player's public name, unsealed), so the registry's Bitcoin stamp covers it
  sealRun(args) { return sealRun(this.env.DB, args); }         // a run's moments, for a game with no ledger of its own (4Dungeon)
  // the copy an account carries into every game (registry.js, migration 007): read once when a run starts, and mark it
  pinned(game, playerId) { return pinned(this.env.DB, game, playerId); }
  pin(args) { return pin(this.env.DB, args); }
  heldAcross(game, playerId, limit) { return heldAcross(this.env.DB, game, playerId, limit); }
  markCarried(args) { return markCarried(this.env.DB, args); }
}

// The shared accounts, also through a service binding:
//   "services": [ { "binding": "ACCOUNTS", "service": "dungeon-items", "entrypoint": "Accounts" } ]
// Every method returns a plain object; a refusal is { error, status }. Passkey calls take the page's `origin`
// (it must be an https address under the RP ID, 88x31.app) and the visitor's `ip` (only a hash is kept, for rate limits).
export class Accounts extends WorkerEntrypoint {
  createAccount() { return A.createAccount(this.env.DB); }
  addCode(accountId) { return A.addCode(this.env.DB, accountId); }
  importCode(accountId, codeHash) { return A.importCode(this.env.DB, accountId, codeHash); }
  removeCode(accountId, id) { return A.removeCode(this.env.DB, accountId, id); }
  loginCode({ code, ip }) { return A.loginCode(this.env.DB, code, ip); }
  info(accountId) { return A.info(this.env.DB, accountId); }
  waysIn(accountId) { return A.waysIn(this.env.DB, accountId); }
  playerFor(accountId, game) { return A.playerFor(this.env.DB, accountId, game); }
  link(accountId, game, playerId) { return A.link(this.env.DB, accountId, game, playerId); }
  unlink(game, playerId) { return A.unlink(this.env.DB, game, playerId); }
  accountOf(game, playerId) { return A.accountOf(this.env.DB, game, playerId); }
  passkeyRegisterOptions(args) { return A.passkeyRegisterOptions(this.env, args); }
  passkeyRegister(args) { return A.passkeyRegister(this.env, args); }
  passkeyLoginOptions(args) { return A.passkeyLoginOptions(this.env, args); }
  passkeyLogin(args) { return A.passkeyLogin(this.env, args); }
  passkeyRemove(accountId, id) { return A.passkeyRemove(this.env.DB, accountId, id); }
}
