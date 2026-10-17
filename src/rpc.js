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
import { birth, moveCopy, heldBy, verify } from "./registry.js";
import * as A from "./accounts.js";

export class Registry extends WorkerEntrypoint {
  birth(args) { return birth(this.env.DB, args); }
  moveCopy(args) { return moveCopy(this.env.DB, args); }
  heldBy(game, playerId) { return heldBy(this.env.DB, game, playerId); }
  verify() { return verify(this.env.DB); }
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
  accountOf(game, playerId) { return A.accountOf(this.env.DB, game, playerId); }
  passkeyRegisterOptions(args) { return A.passkeyRegisterOptions(this.env, args); }
  passkeyRegister(args) { return A.passkeyRegister(this.env, args); }
  passkeyLoginOptions(args) { return A.passkeyLoginOptions(this.env, args); }
  passkeyLogin(args) { return A.passkeyLogin(this.env, args); }
  passkeyRemove(accountId, id) { return A.passkeyRemove(this.env.DB, accountId, id); }
}
