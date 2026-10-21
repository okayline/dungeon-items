// The Registry entrypoint (src/rpc.js) only hands each call the `items-db` binding; the rules are tested in
// registry.test.mjs. rpc.js imports "cloudflare:workers", which only exists on Cloudflare, so these tests load it with
// a stand-in for that one module.
import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { createHash } from "node:crypto";
import { fakeD1 } from "./helpers.mjs";
import { publicLedger } from "../src/public-ledger.js";

const stub = "export class WorkerEntrypoint { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }";
register("data:text/javascript," + encodeURIComponent(
  `export async function resolve(spec, ctx, next) { if (spec === "cloudflare:workers") return { url: "data:text/javascript," + encodeURIComponent(${JSON.stringify(stub)}), shortCircuit: true }; return next(spec, ctx); }`));
const { Registry, Accounts } = await import("../src/rpc.js");
const index = await import("../src/index.js");
const worker = index.default;

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

test("the public ledger gives each entry its item's public details, and no player ids", async () => {
  const db = fakeD1();
  db.raw.prepare("INSERT INTO items (source, source_key, rarity, name, note, alignment, nature, type, image, created_at, updated_at) VALUES ('88x31', 'd9', 'common', 'Neon Nite', 'a note', 'LAW', 'tech', 'neon', 'https://88x31.app/api/img?d=9', 1, 1)").run();
  const reg = new Registry({}, { DB: db });
  await reg.birth({ itemId: 1, game: "88x31", playerId: 7003, key: "a" });
  const { publicLedger } = await import("../src/public-ledger.js");
  const d = await publicLedger(db, new URLSearchParams());
  assert.deepEqual(d.entries[0].item, { name: "Neon Nite", rarity: "common", note: "a note", alignment: "LAW", nature: "tech", type: "neon", image: "https://88x31.app/api/img?d=9", source: "88x31" });
  assert.ok(!JSON.stringify(d).includes("7003"));
});

test("88x31's uncommons and up are mysteries on the public ledger, a copy's page and /api/items; commons and 4Dungeon's rares are not", async () => {
  const db = fakeD1();
  for (const [src, key, rarity, name] of [["88x31", "d1", "rare", "Secret Rare"], ["88x31", "d2", "common", "Plain One"], ["4dungeon", "RARE:1", "rare", "a dull blade"], ["88x31", "d3", "uncommon", "Secret Uncommon"]])
    db.raw.prepare("INSERT INTO items (source, source_key, rarity, name, image, created_at, updated_at) VALUES (?, ?, ?, ?, 'pic', 1, 1)").run(src, key, rarity, name);
  const reg = new Registry({}, { DB: db });
  for (const [itemId, game] of [[1, "88x31"], [2, "88x31"], [3, "4dungeon"], [4, "88x31"]]) await reg.birth({ itemId, game, playerId: 1, key: "k" + itemId });
  const { publicLedger } = await import("../src/public-ledger.js");
  const d = await publicLedger(db, new URLSearchParams());
  assert.deepEqual(d.entries.map((e) => e.item.name ?? null), [null, "a dull blade", "Plain One", null]);
  assert.deepEqual(d.entries[3].item, { source: "88x31", hidden: true });
  assert.deepEqual((await reg.copyStory(1, 1)).item, { id: 1, source: "88x31", hidden: true });
  const all = JSON.stringify(await (await worker.fetch(new Request("https://x/api/items"), { DB: db })).json());
  const one = JSON.stringify(await (await worker.fetch(new Request("https://x/api/items/1"), { DB: db })).json());
  assert.ok(!all.includes("Secret Rare") && !one.includes("Secret Rare") && !JSON.stringify(d).includes("Secret Rare") && !all.includes("Secret Uncommon") && !JSON.stringify(d).includes("Secret Uncommon"));
  assert.ok(all.includes("Plain One") && all.includes("a dull blade"));
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

test("the Dawn Baton seed is one relic: the entrypoint finds its id by key, and only Dawn Baton can make copies", async () => {
  const { readFileSync } = await import("node:fs");
  const { seedSql } = await import("../src/seed.js");
  const db = fakeD1();
  db.raw.exec(seedSql(JSON.parse(readFileSync(new URL("../seed/dawn-baton.json", import.meta.url), "utf8")), 1));
  assert.deepEqual(q(db, "SELECT id, source, source_key, rarity FROM items"), [{ id: 1, source: "dawn-baton", source_key: "baton", rarity: "relic" }]);
  const reg = new Registry({}, { DB: db });
  assert.deepEqual(await reg.itemIds("dawn-baton", ["baton"]), { baton: 1 });
  assert.deepEqual(await reg.itemIds("4dungeon", ["baton"]), {});
  assert.deepEqual(await reg.birth({ itemId: 1, game: "dawn-baton", playerId: 3, key: "lap:1" }), { itemId: 1, copy: 1, created: true });
  assert.deepEqual(await reg.birth({ itemId: 1, game: "dawn-baton", playerId: 3, key: "lap:1" }), { itemId: 1, copy: 1, created: false });
  assert.match((await reg.birth({ itemId: 1, game: "4dungeon", playerId: 3, key: "x" })).error, /home game/);
});

test("a checkpoint seals another game's ledger head on the chain: once per head, and a ledger can only grow", async () => {
  const db = fakeD1();
  const reg = new Registry({}, { DB: db });
  const h1 = "a".repeat(64), h2 = "b".repeat(64);
  assert.deepEqual(await reg.checkpoint({ game: "dawn-baton", entries: 5, head: h1 }), { ok: true, created: true });
  assert.deepEqual(await reg.checkpoint({ game: "dawn-baton", entries: 5, head: h1 }), { ok: true, created: false });   // a retry adds nothing
  assert.match((await reg.checkpoint({ game: "dawn-baton", entries: 4, head: h2 })).error, /only grow/);
  assert.match((await reg.checkpoint({ game: "dawn-baton", entries: 5, head: h2 })).error, /only grow/);
  assert.match((await reg.checkpoint({ game: "dawn-baton", entries: 6, head: "x" })).error, /fingerprint/);
  assert.deepEqual(await reg.checkpoint({ game: "scoundrel", entries: 2, head: h2 }), { ok: true, created: true });   // each game counts on its own
  assert.deepEqual(q(db, "SELECT kind, game, player_id, record FROM ledger ORDER BY id"), [
    { kind: "checkpoint", game: "dawn-baton", player_id: 0, record: JSON.stringify({ k: "checkpoint", game: "dawn-baton", entries: 5, head: h1 }) },
    { kind: "checkpoint", game: "scoundrel", player_id: 0, record: JSON.stringify({ k: "checkpoint", game: "scoundrel", entries: 2, head: h2 }) },
  ]);
  assert.equal((await reg.verify()).ok, true);
});

test("two requests sending the same checkpoint at once seal it once (Oct 21: Dawn Baton lap 5 was sealed twice, #875 and #876)", async () => {
  const db = fakeD1();
  let sealed; const firstSealed = new Promise((r) => (sealed = r));
  // the second request reads the last checkpoint before the first one writes, and carries on only after it has
  const late = { ...db, prepare: (sql) => { const wrap = (st) => ({ ...st, bind: (...a) => wrap(st.bind(...a)),
    first: async () => { const r = await st.first(); if (/kind = 'checkpoint'/.test(sql)) await firstSealed; return r; } }); return wrap(db.prepare(sql)); } };
  const args = { game: "dawn-baton", entries: 125, head: "a".repeat(64), detail: { lap: 5 } };
  const second = new Registry({}, { DB: late }).checkpoint(args);
  assert.deepEqual(await new Registry({}, { DB: db }).checkpoint(args), { ok: true, created: true });
  sealed();
  assert.deepEqual(await second, { ok: true, created: false });
  assert.deepEqual(q(db, "SELECT COUNT(*) AS n FROM ledger"), [{ n: 1 }]);
});

test("a checkpoint can carry a few public facts for the page, and nothing that isn't short and plain", async () => {
  const db = fakeD1();
  const reg = new Registry({}, { DB: db });
  const detail = { lap: 5, people: 2, unheld: 2, colors: ["#e06a5c", null, "#5cb8e0"] };
  assert.deepEqual(await reg.checkpoint({ game: "dawn-baton", entries: 9, head: "c".repeat(64), detail }), { ok: true, created: true });
  assert.deepEqual(JSON.parse(q(db, "SELECT record FROM ledger")[0].record).detail, detail);
  assert.match((await reg.checkpoint({ game: "scoundrel", entries: 3, head: "d".repeat(64), detail: { name: "<script>" } })).error, /detail/);
  assert.match((await reg.checkpoint({ game: "scoundrel", entries: 3, head: "d".repeat(64), detail: { score: { deep: 1 } } })).error, /detail/);
  assert.match((await reg.checkpoint({ game: "scoundrel", entries: 3, head: "d".repeat(64), detail: [1] })).error, /detail/);
});

test("a checkpoint's name sits beside the record: shown by the ledger API, never sealed in the hash", async () => {
  const db = fakeD1();
  const reg = new Registry({}, { DB: db });
  assert.match((await reg.checkpoint({ game: "scoundrel", entries: 3, head: "d".repeat(64), name: "<b>" })).error, /name/);
  assert.deepEqual(await reg.checkpoint({ game: "scoundrel", entries: 3, head: "d".repeat(64), detail: { score: 12 }, name: "ryan" }), { ok: true, created: true });
  const [row] = q(db, "SELECT record, prev_hash, hash, name FROM ledger");
  assert.equal(row.name, "ryan");
  assert.doesNotMatch(row.record, /ryan/);
  assert.equal(row.hash, createHash("sha256").update(row.prev_hash + "|" + row.record).digest("hex"));   // the hash covers the record alone
  assert.equal((await publicLedger(db, new URLSearchParams())).entries[0].name, "ryan");
});

test("the public ledger page tells an aura-farm checkpoint with its two styles, and no player", async () => {
  const { LEDGER_PAGE } = await import("../src/public-ledger.js");
  const src = LEDGER_PAGE.slice(LEDGER_PAGE.indexOf("function farmWords"), LEDGER_PAGE.indexOf("// a 4Dungeon run's moments"));
  const farmWords = new Function("isInt", src + "; return farmWords;")(Number.isInteger);
  const cp = (detail) => ({ game: "aura-farm", detail });
  assert.equal(farmWords(cp({ day: "2026-10-21", farm: 14, result: "win", styles: ["RIZZ", "MOG"], winner: "poster", aura: [100000, -100000] })), "Farm #14: RIZZ beat MOG. +100,000 aura. MOG got COOKED.");
  assert.equal(farmWords(cp({ day: "2026-10-21", farm: 15, result: "win", styles: ["MOG", "RIZZ"], winner: "taker", aura: [-100000, 100000] })), "Farm #15: RIZZ beat MOG. +100,000 aura. MOG got COOKED.");
  assert.equal(farmWords(cp({ day: "2026-10-21", farm: 13, result: "tie", styles: ["DRIP", "DRIP"], winner: null, aura: [0, 0] })), "Farm #13: DRIP met DRIP. MUTUAL MOG: no aura moved.");
  assert.equal(farmWords({ game: "aura-farm", detail: { farm: 1 } }), null);   // an entry in another shape falls back to the plain line
});
