// Migration 004: the shared ladder, Ultra 1-of-1, home-game births, spent copies, a game adding its own items, and the
// HTTP door that only ever acts as 88x31. One test per rule; expected values from raw SQL and hand lists.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { execSync } from "node:child_process";
import { fakeD1 } from "./helpers.mjs";
import { birth, moveCopy, spendCopy, heldBy, whereIs, addItems, retireItems, verify } from "../src/registry.js";
import worker from "../src/worker.js";

// items 1 88x31 ultra, 2 88x31 prototype, 3 88x31 common, 4 4dungeon relic
const setup = () => {
  const db = fakeD1();
  for (const [src, k, rarity] of [["88x31", "10", "ultra"], ["88x31", "11", "prototype"], ["88x31", "12", "common"], ["4dungeon", "RELIC:1", "relic"]])
    db.raw.prepare("INSERT INTO items (source, source_key, rarity, name, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 1)").run(src, k, rarity, "item " + k);
  return db;
};
const b = (game, playerId, key, itemId) => ({ itemId, game, playerId, key });

test("an ultra is 1-of-1", async () => {
  const db = setup();
  assert.equal((await birth(db, b("88x31", 1, "a", 1))).copy, 1);
  assert.match((await birth(db, b("88x31", 2, "b", 1))).error, /only ever one/);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM copies WHERE item_id = 1").get().n, 1);
});

test("prototype, relic and ultra are only born in their home game; common anywhere; anything travels", async () => {
  const db = setup();
  assert.match((await birth(db, b("irl-dungeon", 1, "p", 2))).error, /home game/);
  assert.match((await birth(db, b("88x31", 1, "r", 4))).error, /home game/);
  assert.equal((await birth(db, b("irl-dungeon", 1, "c", 3))).copy, 1);
  assert.equal((await birth(db, b("88x31", 1, "p2", 2))).copy, 1);
  assert.deepEqual(await moveCopy(db, { itemId: 2, copy: 1, from: { game: "88x31", playerId: 1 }, to: { game: "4dungeon", playerId: 9 } }), { ok: true, moves: 1 });
});

test("a spent copy stays on the ledger, leaves its holder's list and never moves again", async () => {
  const db = setup();
  await birth(db, b("88x31", 1, "s", 3));
  assert.deepEqual(await spendCopy(db, { itemId: 3, copy: 1, holder: { game: "88x31", playerId: 2 } }), { error: "That copy isn't theirs to use up." });
  assert.deepEqual(await spendCopy(db, { itemId: 3, copy: 1, holder: { game: "88x31", playerId: 1 } }), { ok: true });
  assert.deepEqual(await spendCopy(db, { itemId: 3, copy: 1, holder: { game: "88x31", playerId: 1 } }), { ok: true, already: true });
  assert.deepEqual(await heldBy(db, "88x31", 1), []);
  assert.match((await moveCopy(db, { itemId: 3, copy: 1, from: { game: "88x31", playerId: 1 }, to: { game: "88x31", playerId: 2 } })).error, /used up/);
  assert.throws(() => db.raw.prepare("UPDATE copies SET spent = 0 WHERE item_id = 3").run(), /spent copy/);
  assert.deepEqual(db.raw.prepare("SELECT kind FROM ledger ORDER BY id").all().map((r) => r.kind), ["copy", "spend"]);
  assert.equal((await verify(db)).ok, true);
});

test("a game adds and retires only its own items, never changing one already there", async () => {
  const db = setup();
  assert.deepEqual(await addItems(db, "88x31", [{ source_key: "12", rarity: "rare", name: "changed?" }, { source_key: "13", rarity: "relic", name: "new" }]), { added: 1 });
  assert.deepEqual({ ...db.raw.prepare("SELECT rarity, name FROM items WHERE source_key = '12'").get() }, { rarity: "common", name: "item 12" });
  assert.match((await addItems(db, "88x31", [{ source_key: "14", rarity: "mythic", name: "x" }])).error, /ladder/);
  assert.deepEqual(await retireItems(db, "88x31", ["13", "RELIC:1"]), { retired: 1 });   // RELIC:1 is 4dungeon's: untouched
  assert.equal(db.raw.prepare("SELECT retired FROM items WHERE source_key = 'RELIC:1'").get().retired, 0);
});

test("the HTTP door needs the key and always acts as 88x31", async () => {
  const db = setup(), env = { DB: db, ACCOUNTS_KEY: "k".repeat(20) };
  const call = (m, args, key = env.ACCOUNTS_KEY) => worker.fetch(new Request("https://x/rpc/registry/" + m, { method: "POST", headers: { "x-accounts-key": key }, body: JSON.stringify(args) }), env);
  assert.equal((await call("birth", [b("88x31", 1, "h", 1)], "wrong-key-wrong-key")).status, 404);
  assert.equal((await (await call("birth", [b("4dungeon", 1, "h", 4)])).json()).error, "Only that item's home game can make new copies of it.");   // claims 4dungeon, acts as 88x31
  assert.equal((await (await call("addItems", [[{ source_key: "RELIC:2", rarity: "relic", name: "x" }]])).json()).added, 1);
  assert.equal(db.raw.prepare("SELECT source FROM items WHERE source_key = 'RELIC:2'").get().source, "88x31");
});

test("migration 004 runs on the old layout and keeps every item, copy and ledger row", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(execSync("git show HEAD:schema.sql", { encoding: "utf8" }));
  db.exec("INSERT INTO items (source, source_key, rarity, name, created_at, updated_at) VALUES ('4dungeon', 'M:1', 'mythic', 'old', 1, 1), ('4dungeon', 'C:1', 'common', 'c', 1, 1)");
  db.exec("INSERT INTO copies (item_id, copy, born_game, born_key, holder_game, holder_id, born_at, moved_at) VALUES (2, 1, 'irl-dungeon', 'k', 'irl-dungeon', 1, 1, 1)");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("BEGIN; " + readFileSync(new URL("../migrations/004_ladder_88x31.sql", import.meta.url), "utf8") + "\nCOMMIT;");   // D1 runs a file as one transaction
  assert.deepEqual(db.prepare("SELECT id, rarity FROM items ORDER BY id").all().map((r) => [r.id, r.rarity]), [[1, "mythic"], [2, "common"]]);
  assert.equal(db.prepare("SELECT spent FROM copies").get().spent, 0);
  assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  assert.throws(() => db.exec("DELETE FROM items WHERE id = 1"), /never deleted/);
  db.exec("INSERT INTO items (source, source_key, rarity, name, created_at, updated_at) VALUES ('88x31', '9', 'ultra', 'u', 1, 1)");
  assert.equal(db.prepare("SELECT id FROM items WHERE source_key = '9'").get().id, 3);
});

test("heldBy carries each item's details; whereIs finds a copy; the HTTP door only looks up 88x31's own copies", async () => {
  const db = setup(), env = { DB: db, ACCOUNTS_KEY: "k".repeat(20) };
  await birth(db, b("88x31", 1, "w1", 3));                          // an 88x31 common
  db.raw.prepare("INSERT INTO items (source, source_key, rarity, name, created_at, updated_at) VALUES ('4dungeon', 'C:9', 'common', 'a coin', 1, 1)").run();
  await birth(db, b("4dungeon", 7, "w2", 5));                       // a 4dungeon item, held in 4dungeon
  await moveCopy(db, { itemId: 3, copy: 1, from: { game: "88x31", playerId: 1 }, to: { game: "4dungeon", playerId: 7 } });
  const held = await heldBy(db, "4dungeon", 7);
  assert.deepEqual(held.map((c) => [c.itemId, c.item.source, c.item.name, c.born]), [[3, "88x31", "item 12", "88x31"], [5, "4dungeon", "a coin", "4dungeon"]]);
  const call = async (m, args) => (await worker.fetch(new Request("https://x/rpc/registry/" + m, { method: "POST", headers: { "x-accounts-key": env.ACCOUNTS_KEY }, body: JSON.stringify(args) }), env)).json();
  assert.deepEqual(await call("whereIs", [3, 1]), { game: "4dungeon", playerId: 7, spent: false });
  assert.equal(await call("whereIs", [5, 1]), null);                // 4dungeon's copy: not 88x31's to look up
});
