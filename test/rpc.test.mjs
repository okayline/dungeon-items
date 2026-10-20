// The Registry entrypoint (src/rpc.js) only hands each call the `items-db` binding; the rules are tested in
// registry.test.mjs. rpc.js imports "cloudflare:workers", which only exists on Cloudflare, so these tests load it with
// a stand-in for that one module.
import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { fakeD1 } from "./helpers.mjs";

const stub = "export class WorkerEntrypoint { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }";
register("data:text/javascript," + encodeURIComponent(
  `export async function resolve(spec, ctx, next) { if (spec === "cloudflare:workers") return { url: "data:text/javascript," + encodeURIComponent(${JSON.stringify(stub)}), shortCircuit: true }; return next(spec, ctx); }`));
const { Registry, Accounts } = await import("../src/rpc.js");
const index = await import("../src/index.js");

const withItems = () => {
  const db = fakeD1();
  db.raw.prepare("INSERT INTO items (source, source_key, rarity, name, created_at, updated_at) VALUES ('t', 'a', 'common', 'item a', 1, 1)").run();
  return db;
};
const q = (db, sql) => db.raw.prepare(sql).all().map((r) => ({ ...r }));

test("the entrypoint runs the registry on the bound database: birth, move, heldBy, verify", async () => {
  const db = withItems();
  const reg = new Registry({}, { DB: db });
  assert.deepEqual(await reg.birth({ itemId: 1, game: "irl-dungeon", playerId: 1, key: "k1" }), { itemId: 1, copy: 1, created: true });
  assert.deepEqual(q(db, "SELECT item_id, copy, holder_game, holder_id FROM copies"), [{ item_id: 1, copy: 1, holder_game: "irl-dungeon", holder_id: 1 }]);
  assert.deepEqual(await reg.moveCopy({ itemId: 1, copy: 1, from: { game: "irl-dungeon", playerId: 1 }, to: { game: "4dungeon", playerId: 2 } }), { ok: true, moves: 1 });
  assert.deepEqual((await reg.heldBy("4dungeon", 2)).map(({ itemId, copy, moves }) => ({ itemId, copy, moves })), [{ itemId: 1, copy: 1, moves: 1 }]);
  assert.deepEqual(await reg.heldBy("irl-dungeon", 1), []);
  const v = await reg.verify();
  assert.equal(v.ok, true); assert.equal(v.count, 2);
});

test("copyStory gives a copy's public story: how many exist, when it was made, newest entry first, no player ids", async () => {
  const db = withItems();
  const reg = new Registry({}, { DB: db });
  await reg.birth({ itemId: 1, game: "4dungeon", playerId: 7001, key: "a" });
  await reg.birth({ itemId: 1, game: "4dungeon", playerId: 7002, key: "b" });
  await reg.addMark({ itemId: 1, copy: 2, holder: { game: "4dungeon", playerId: 7002 }, kind: "deed", value: "found_wall", key: "m1" });
  const s = await reg.copyStory(1, 2);
  assert.deepEqual([s.copy, s.of, s.born_game, s.moves, s.used_up], [2, 2, "4dungeon", 0, false]);
  assert.equal(s.born_at, q(db, "SELECT born_at FROM copies WHERE copy = 2")[0].born_at);
  assert.deepEqual(s.entries.map((e) => e.kind), ["mark", "copy"]);
  assert.ok(!JSON.stringify(s).includes("7002"));
  assert.equal(await reg.copyStory(1, 9), null);
});

test("the entrypoint refuses what the registry refuses", async () => {
  const db = withItems();
  const reg = new Registry({}, { DB: db });
  assert.match((await reg.birth({ itemId: 99, game: "g", playerId: 1, key: "k" })).error, /No such item/);
  assert.equal(q(db, "SELECT COUNT(*) AS n FROM copies")[0].n, 0);
});

test("the Worker's entry exports the public handler and the Registry", () => {
  assert.equal(typeof index.default.fetch, "function");
  assert.equal(index.Registry, Registry); assert.equal(index.Accounts, Accounts);
});

test("the Accounts entrypoint runs on the bound database", async () => {
  const db = fakeD1(), acc = new Accounts({}, { DB: db });
  const { accountId } = await acc.createAccount();
  const { code } = await acc.addCode(accountId);
  assert.deepEqual(await acc.loginCode({ code, ip: "1.2.3.4" }), { accountId });
  assert.deepEqual(await acc.link(accountId, "irl-dungeon", 3), { playerId: 3, linked: true });
  assert.deepEqual(await acc.playerFor(accountId, "irl-dungeon"), { playerId: 3 });
});
