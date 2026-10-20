// Marks (migration 005): a copy's history. One test per rule. Expected values come from raw SQL, hand lists and
// node:crypto, never from the code under test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fakeD1 } from "./helpers.mjs";
import { birth, spendCopy, heldBy, verify, addMark, marksOf } from "../src/registry.js";

const sha = (s) => createHash("sha256").update(s).digest("hex");
const P = { game: "4dungeon", playerId: 7 };
// items 1 (common), 2 (rare), 3 (moon); one copy of each held by P
const setup = async () => {
  const db = fakeD1();
  for (const [k, rarity] of [["a", "common"], ["b", "rare"], ["c", "moon"]])
    db.raw.prepare("INSERT INTO items (source, source_key, rarity, name, created_at, updated_at) VALUES ('4dungeon', ?, ?, ?, 1, 1)").run(k, rarity, "item " + k);
  for (const id of [1, 2, 3]) await birth(db, { itemId: id, ...P, key: "b" + id });
  return db;
};
const q = (db, sql, ...a) => db.raw.prepare(sql).all(...a).map((r) => ({ ...r }));
const mark = (kind, value, key, more = {}) => ({ itemId: 1, copy: 1, holder: P, kind, value, key, t: 50, ...more });

test("marks count up per copy and each is sealed on the ledger, with no player id", async () => {
  const db = await setup();
  assert.deepEqual(await addMark(db, mark("night", "full", "m1")), { ok: true, n: 1, created: true });
  assert.deepEqual(await addMark(db, mark("deed", "found_wall", "m2")), { ok: true, n: 2, created: true });
  assert.deepEqual(q(db, "SELECT n, kind, value, game FROM marks ORDER BY n"),
    [{ n: 1, kind: "night", value: "full", game: "4dungeon" }, { n: 2, kind: "deed", value: "found_wall", game: "4dungeon" }]);
  const rows = q(db, "SELECT kind, record, prev_hash, hash FROM ledger WHERE kind = 'mark' ORDER BY id");
  const r1 = '{"k":"mark","item":1,"copy":1,"n":1,"kind":"night","value":"full","game":"4dungeon"}';
  assert.equal(rows[0].record, r1);
  assert.equal(rows[0].hash, sha(rows[0].prev_hash + "|" + r1));
  for (const r of rows) assert.ok(!r.record.includes('"7"') && !r.record.includes(":7,") && !r.record.includes("m1"));
  assert.equal((await verify(db)).ok, true);
});

test("the same key gives back the same mark, once", async () => {
  const db = await setup();
  await addMark(db, mark("night", "full", "m1"));
  assert.deepEqual(await addMark(db, mark("night", "full", "m1")), { ok: true, n: 1, created: false });
  assert.equal(q(db, "SELECT COUNT(*) AS c FROM marks")[0].c, 1);
});

test("only the holder marks, and never a used-up copy", async () => {
  const db = await setup();
  assert.match((await addMark(db, mark("deed", "carried_up", "x", { holder: { game: "4dungeon", playerId: 8 } }))).error, /isn't theirs/);
  await spendCopy(db, { itemId: 1, copy: 1, holder: P });
  assert.match((await addMark(db, mark("deed", "carried_up", "y"))).error, /used up/);
  assert.equal(q(db, "SELECT COUNT(*) AS c FROM marks")[0].c, 0);
});

test("the moon only answers or blesses, and blessings stop at the ladder's top", async () => {
  const db = await setup();
  assert.match((await addMark(db, mark("moon", "cursed", "z"))).error, /answers or blesses/);
  for (const k of ["b1", "b2", "b3"]) assert.equal((await addMark(db, mark("moon", "blessed", k))).ok, true);   // common: 3
  assert.match((await addMark(db, mark("moon", "blessed", "b4"))).error, /as high/);
  assert.equal((await addMark(db, mark("moon", "blessed", "r1", { itemId: 2 }))).ok, true);                       // rare: 1
  assert.match((await addMark(db, mark("moon", "blessed", "r2", { itemId: 2 }))).error, /as high/);
  assert.match((await addMark(db, mark("moon", "blessed", "m1", { itemId: 3 }))).error, /as high/);                // moon: 0
  assert.equal((await addMark(db, mark("moon", "answered", "a1", { itemId: 3 }))).ok, true);
});

test("the database refuses edits, deletes, gaps and bad values", async () => {
  const db = await setup();
  await addMark(db, mark("night", "full", "m1"));
  assert.throws(() => db.raw.prepare("UPDATE marks SET value = 'new'").run(), /never changed/);
  assert.throws(() => db.raw.prepare("DELETE FROM marks").run(), /never deleted/);
  const ins = (n, kind, value) => db.raw.prepare("INSERT INTO marks (item_id, copy, n, kind, value, game, mark_key, made_at) VALUES (1, 1, ?, ?, ?, 'g', ?, 1)").run(n, kind, value, "k" + n + value);
  assert.throws(() => ins(5, "deed", "x"), /no gaps/);
  assert.throws(() => ins(2, "moon", "cursed"), /answers or blesses/);
  assert.throws(() => ins(2, "deed", "Bad Value"), /CHECK/);
});

test("heldBy and marksOf carry a copy's marks, oldest first", async () => {
  const db = await setup();
  await addMark(db, mark("night", "new", "m1"));
  await addMark(db, mark("deed", "from_demon", "m2"));
  const want = [{ kind: "night", value: "new", game: "4dungeon", at: 50 }, { kind: "deed", value: "from_demon", game: "4dungeon", at: 50 }];
  assert.deepEqual(await marksOf(db, 1, 1), want);
  const held = await heldBy(db, "4dungeon", 7);
  assert.deepEqual(held.find((h) => h.itemId === 1).marks, want);
  assert.deepEqual(held.find((h) => h.itemId === 2).marks, []);
});

test("addMarks: one ledger entry for a moment many copies lived through; each copy still gets its own numbered mark", async () => {
  const db = await setup();
  const { addMarks } = await import("../src/registry.js"), { copyStory } = await import("../src/public-ledger.js");
  await addMark(db, mark("night", "full", "m1"));                                  // copy 1 of item 1 already has mark 1
  await spendCopy(db, { itemId: 3, copy: 1, holder: P });
  const many = { holder: P, kind: "deed", value: "fled_fight", t: 60, copies: [{ itemId: 1, copy: 1, key: "f1" }, { itemId: 2, copy: 1, key: "f2" }, { itemId: 3, copy: 1, key: "f3" }] };
  const before = q(db, "SELECT COUNT(*) AS c FROM ledger")[0].c;
  const r = await addMarks(db, many);
  assert.deepEqual(r, { ok: true, marked: [{ itemId: 1, copy: 1, n: 2 }, { itemId: 2, copy: 1, n: 1 }], already: 0, skipped: [{ itemId: 3, copy: 1, error: "That copy was used up." }] });
  assert.deepEqual(q(db, "SELECT item_id, copy, n, value, mark_key FROM marks WHERE value = 'fled_fight' ORDER BY item_id"),
    [{ item_id: 1, copy: 1, n: 2, value: "fled_fight", mark_key: "f1" }, { item_id: 2, copy: 1, n: 1, value: "fled_fight", mark_key: "f2" }]);
  const rows = q(db, "SELECT record, prev_hash, hash FROM ledger WHERE id > ? ORDER BY id", before);
  const rec = '{"k":"mark","copies":[{"item":1,"copy":1,"n":2},{"item":2,"copy":1,"n":1}],"kind":"deed","value":"fled_fight","game":"4dungeon"}';
  assert.deepEqual(rows.map((x) => x.record), [rec]);                              // one entry, not two
  assert.equal(rows[0].hash, sha(rows[0].prev_hash + "|" + rec));
  assert.equal((await verify(db)).ok, true);
  assert.deepEqual(await addMarks(db, many), { ok: true, marked: [], already: 2, skipped: [{ itemId: 3, copy: 1, error: "That copy was used up." }] });   // a retry adds nothing
  assert.equal(q(db, "SELECT COUNT(*) AS c FROM ledger")[0].c, before + 1);
  assert.ok((await copyStory(db, 2, 1)).entries.some((e) => e.record === rec));    // each copy's story has the shared entry
  assert.deepEqual((await addMarks(db, { ...many, kind: "moon", value: "blessed" })).error, "Only the moon's answer goes on many copies at once.");
});
