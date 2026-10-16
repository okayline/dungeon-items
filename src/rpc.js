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

export class Registry extends WorkerEntrypoint {
  birth(args) { return birth(this.env.DB, args); }
  moveCopy(args) { return moveCopy(this.env.DB, args); }
  heldBy(game, playerId) { return heldBy(this.env.DB, game, playerId); }
  verify() { return verify(this.env.DB); }
}
