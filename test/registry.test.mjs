// The copy registry must number copies without gaps or repeats, keep every birth and move on one unbroken chain, and
// refuse what the rules refuse. These tests try to BREAK it. Expected values come from raw SQL, hand-written lists and
// node:crypto, never from the code under test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fakeD1 } from "./helpers.mjs";
import { birth, moveCopy, heldBy, verify } from "../src/registry.js";
import { GENESIS, chainInsert } from "../src/ledger.js";
import worker from "../src/worker.js";

const sha = (s) => createHash("sha256").update(s).digest("hex");
// items 1 (common), 2 (common), 3 (rare), 4 (common, retired)
const setup = () => {
  const db = fakeD1();
  for (const [k, rarity, retired] of [["a", "common", 0], ["b", "common", 0], ["c", "rare", 0], ["old", "common", 1]])
    db.raw.prepare("INSERT INTO items (source, source_key, rarity, name, retired, created_at, updated_at) VALUES ('t', ?, ?, ?, ?, 1, 1)").run(k, rarity, "item " + k, retired);
  return db;
};
const q = (db, sql, ...a) => db.raw.prepare(sql).all(...a).map((r) => ({ ...r }));   // plain objects (node:sqlite rows have no prototype)
const copies = (db) => q(db, "SELECT item_id, copy, holder_game, holder_id, moves FROM copies ORDER BY item_id, copy");
const ledger = (db) => q(db, "SELECT * FROM ledger ORDER BY id");
const irl = (n, key, item = 1) => ({ itemId: item, game: "irl-dungeon", playerId: n, key });

test("copies are numbered 1, 2, 3 per item across games, and each item counts on its own", async () => {
  const db = setup();
  assert.deepEqual(await birth(db, irl(1, "k1")), { itemId: 1, copy: 1, created: true });
  assert.deepEqual(await birth(db, { itemId: 1, game: "4dungeon", playerId: 7, key: "k1" }), { itemId: 1, copy: 2, created: true });
  assert.deepEqual(await birth(db, irl(2, "k2")), { itemId: 1, copy: 3, created: true });
  assert.deepEqual(await birth(db, irl(1, "k3", 2)), { itemId: 2, copy: 1, created: true });
  assert.deepEqual(copies(db), [
    { item_id: 1, copy: 1, holder_game: "irl-dungeon", holder_id: 1, moves: 0 },
    { item_id: 1, copy: 2, holder_game: "4dungeon", holder_id: 7, moves: 0 },
    { item_id: 1, copy: 3, holder_game: "irl-dungeon", holder_id: 2, moves: 0 },
    { item_id: 2, copy: 1, holder_game: "irl-dungeon", holder_id: 1, moves: 0 },
  ]);
});

test("the same game and key give back the same copy, and make it once", async () => {
  const db = setup();
  assert.deepEqual(await birth(db, irl(1, "k1")), { itemId: 1, copy: 1, created: true });
  assert.deepEqual(await birth(db, irl(1, "k1")), { itemId: 1, copy: 1, created: false });
  assert.equal(copies(db).length, 1);
  assert.equal(ledger(db).length, 1);
});

test("a key that made a copy of one item can't make a copy of another", async () => {
  const db = setup();
  await birth(db, irl(1, "k1", 1));
  const r = await birth(db, irl(1, "k1", 2));
  assert.match(r.error, /different item/);
  assert.equal(copies(db).length, 1);
  assert.equal(ledger(db).length, 1);
});

test("a birth is on the ledger in the same step: record, hash and chain are what SHA-256 says", async () => {
  const db = setup();
  await birth(db, { ...irl(5, "k1"), t: 100 });
  await birth(db, { itemId: 3, game: "4dungeon", playerId: 9, key: "z", t: 200 });
  const [a, b] = ledger(db);
  const ra = '{"k":"copy","item":1,"copy":1,"game":"irl-dungeon"}', rb = '{"k":"copy","item":3,"copy":1,"game":"4dungeon"}';
  assert.equal(a.record, ra); assert.equal(a.prev_hash, GENESIS); assert.equal(a.hash, sha(GENESIS + "|" + ra));
  assert.equal(b.record, rb); assert.equal(b.prev_hash, a.hash); assert.equal(b.hash, sha(a.hash + "|" + rb));
  assert.deepEqual([a.kind, a.game, a.player_id, b.kind, b.game, b.player_id, b.created_at], ["copy", "irl-dungeon", 5, "copy", "4dungeon", 9, 200]);
  assert.deepEqual(await verify(db), { ok: true, count: 2, head: b.hash });
});

test("the ledger never holds a player id or a key", async () => {
  const db = setup();
  const key = "find|8a2a1072b59ffff|0:3|20000";
  await birth(db, irl(424242, key));
  await moveCopy(db, { itemId: 1, copy: 1, from: { game: "irl-dungeon", playerId: 424242 }, to: { game: "4dungeon", playerId: 555111 } });
  for (const r of ledger(db)) for (const secret of [key, "8a2a1072b59ffff", "424242", "555111"]) assert.ok(!r.record.includes(secret), `${r.kind} record leaks ${secret}`);
});

test("unknown and retired items make no copies, and nothing is written", async () => {
  const db = setup();
  assert.match((await birth(db, irl(1, "k", 99))).error, /No such item/);
  assert.match((await birth(db, irl(1, "k", 4))).error, /retired/);
  assert.equal(copies(db).length, 0); assert.equal(ledger(db).length, 0);
  assert.throws(() => db.raw.prepare("INSERT INTO copies VALUES (4, 1, 'g', 'k', 'g', 1, 0, 1, 1)").run(), /retired/);   // the database says no too
  assert.throws(() => db.raw.prepare("INSERT INTO copies VALUES (99, 1, 'g', 'k', 'g', 1, 0, 1, 1)").run(), /FOREIGN KEY/);
});

test("bad arguments are refused and write nothing", async () => {
  const db = setup();
  for (const bad of [irl(1, "k", 0), irl(1, "k", "1"), irl(1, "k", 1.5), irl(0, "k"), irl(1.5, "k"), irl("1", "k"), irl(1, ""), irl(1, "x".repeat(201)), irl(1, 5), { ...irl(1, "k"), game: "" }, { ...irl(1, "k"), game: "g".repeat(41) }, undefined])
    assert.ok((await birth(db, bad)).error, JSON.stringify(bad));
  assert.equal(copies(db).length, 0); assert.equal(ledger(db).length, 0);
});

test("six births racing for one item get copies 1 to 6, once each, and the chain stays whole", async () => {
  const db = setup();
  const out = await Promise.all([1, 2, 3, 4, 5, 6].map((n) => birth(db, irl(n, "k" + n))));
  assert.deepEqual(out.map((r) => r.copy).sort(), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(copies(db).map((c) => c.copy), [1, 2, 3, 4, 5, 6]);
  assert.equal(ledger(db).length, 6);
  assert.equal((await verify(db)).ok, true);
});

test("six births racing with the same key make one copy", async () => {
  const db = setup();
  const out = await Promise.all([1, 2, 3, 4, 5, 6].map(() => birth(db, irl(1, "same"))));
  assert.deepEqual([...new Set(out.map((r) => r.copy))], [1]);
  assert.equal(out.filter((r) => r.created).length, 1);
  assert.equal(copies(db).length, 1); assert.equal(ledger(db).length, 1);
});

test("a birth is saved only with its ledger entry: if the ledger can't take it, no copy is made", async () => {
  const db = setup();
  db.raw.exec("CREATE TRIGGER boom BEFORE INSERT ON ledger BEGIN SELECT RAISE(ABORT, 'boom'); END;");
  await assert.rejects(birth(db, irl(1, "k1")), /boom/);
  assert.equal(copies(db).length, 0);
});

test("the database refuses to skip, reuse, rewrite or delete copies", async () => {
  const db = setup();
  await birth(db, irl(1, "k1")); await birth(db, irl(2, "k2"));
  const ins = (n, key) => db.raw.prepare("INSERT INTO copies VALUES (1, ?, 'g', ?, 'g', 1, 0, 1, 1)").run(n, key);
  assert.throws(() => ins(5, "x"), /no gaps/);            // skipping ahead
  assert.throws(() => ins(2, "x"), /no gaps/);            // reusing a number
  assert.throws(() => ins(1, "x"), /no gaps/);
  assert.throws(() => db.raw.prepare("DELETE FROM copies WHERE copy = 2").run(), /never deleted/);
  assert.throws(() => db.raw.prepare("DELETE FROM copies").run(), /never deleted/);
  // each of these is a proper hand-over too (holder changed, one move counted), so only the birth rule can refuse it
  for (const set of ["copy = 9", "item_id = 2", "born_game = 'x'", "born_key = 'x'", "born_at = 5"])
    assert.throws(() => db.raw.prepare(`UPDATE copies SET ${set}, holder_id = 8, moves = moves + 1 WHERE copy = 1`).run(), /never change/, set);
  assert.throws(() => db.raw.prepare("UPDATE copies SET holder_id = 8, moves = 2 WHERE copy = 1").run(), /one move at a time/);   // two moves at once
  assert.throws(() => db.raw.prepare("UPDATE copies SET holder_id = 8 WHERE copy = 1").run(), /one move at a time/);               // a hand-over with no count
  assert.throws(() => db.raw.prepare("UPDATE copies SET moves = 1 WHERE copy = 1").run(), /one move at a time/);                   // a count with no hand-over
  assert.equal(copies(db).length, 2);
});

test("a move by the holder changes the holder, counts it and seals it", async () => {
  const db = setup();
  await birth(db, irl(1, "k1"));
  const r = await moveCopy(db, { itemId: 1, copy: 1, from: { game: "irl-dungeon", playerId: 1 }, to: { game: "4dungeon", playerId: 9 }, t: 300 });
  assert.deepEqual(r, { ok: true, moves: 1 });
  assert.deepEqual(copies(db), [{ item_id: 1, copy: 1, holder_game: "4dungeon", holder_id: 9, moves: 1 }]);
  assert.equal(q(db, "SELECT moved_at, born_at FROM copies")[0].moved_at, 300);
  const [a, b] = ledger(db);
  const rec = '{"k":"move","item":1,"copy":1,"from":"irl-dungeon","to":"4dungeon"}';
  assert.equal(b.record, rec); assert.equal(b.prev_hash, a.hash); assert.equal(b.hash, sha(a.hash + "|" + rec));
  assert.deepEqual([b.kind, b.game, b.player_id], ["move", "irl-dungeon", 1]);
  assert.deepEqual(await verify(db), { ok: true, count: 2, head: b.hash });
});

test("a move by anyone but the holder is refused and writes nothing", async () => {
  const db = setup();
  await birth(db, irl(1, "k1"));
  const to = { game: "4dungeon", playerId: 9 };
  for (const from of [{ game: "irl-dungeon", playerId: 2 }, { game: "4dungeon", playerId: 1 }])
    assert.match((await moveCopy(db, { itemId: 1, copy: 1, from, to })).error, /isn't theirs/);
  assert.match((await moveCopy(db, { itemId: 1, copy: 2, from: { game: "irl-dungeon", playerId: 1 }, to })).error, /No such copy/);
  assert.match((await moveCopy(db, { itemId: 1, copy: 1, from: { game: "irl-dungeon", playerId: 1 }, to: { game: "irl-dungeon", playerId: 1 } })).error, /already theirs/);
  assert.ok((await moveCopy(db, { itemId: 1, copy: 1, from: { game: "irl-dungeon", playerId: 1 }, to: { game: "", playerId: 9 } })).error);
  assert.deepEqual(copies(db), [{ item_id: 1, copy: 1, holder_game: "irl-dungeon", holder_id: 1, moves: 0 }]);
  assert.equal(ledger(db).length, 1);
});

test("a copy handed away can't be handed again by its old holder", async () => {
  const db = setup();
  await birth(db, irl(1, "k1"));
  const a = { game: "irl-dungeon", playerId: 1 }, b = { game: "4dungeon", playerId: 9 }, c = { game: "88x31", playerId: 3 };
  assert.equal((await moveCopy(db, { itemId: 1, copy: 1, from: a, to: b })).ok, true);
  assert.match((await moveCopy(db, { itemId: 1, copy: 1, from: a, to: c })).error, /isn't theirs/);
  assert.equal((await moveCopy(db, { itemId: 1, copy: 1, from: b, to: c })).moves, 2);
  assert.equal(ledger(db).length, 3);
});

test("two moves racing for one copy: exactly one wins and exactly one is sealed", async () => {
  const db = setup();
  await birth(db, irl(1, "k1"));
  const from = { game: "irl-dungeon", playerId: 1 };
  const out = await Promise.all([
    moveCopy(db, { itemId: 1, copy: 1, from, to: { game: "4dungeon", playerId: 9 } }),
    moveCopy(db, { itemId: 1, copy: 1, from, to: { game: "88x31", playerId: 3 } }),
  ]);
  assert.equal(out.filter((r) => r.ok).length, 1);
  assert.equal(out.filter((r) => r.error).length, 1);
  assert.equal(copies(db)[0].moves, 1);
  assert.equal(q(db, "SELECT COUNT(*) AS n FROM ledger WHERE kind = 'move'")[0].n, 1);
  assert.equal((await verify(db)).ok, true);
});

test("a move is saved only with its ledger entry: if the ledger can't take it, the holder doesn't change", async () => {
  const db = setup();
  await birth(db, irl(1, "k1"));
  db.raw.exec("CREATE TRIGGER boom BEFORE INSERT ON ledger BEGIN SELECT RAISE(ABORT, 'boom'); END;");
  await assert.rejects(moveCopy(db, { itemId: 1, copy: 1, from: { game: "irl-dungeon", playerId: 1 }, to: { game: "4dungeon", playerId: 9 } }), /boom/);
  assert.deepEqual(copies(db), [{ item_id: 1, copy: 1, holder_game: "irl-dungeon", holder_id: 1, moves: 0 }]);
});

test("a ledger entry marked ifChanged is written only when the statement before it changed a row", async () => {
  const db = setup(); await birth(db, irl(1, "k1"));
  const entry = (n) => ({ kind: "move", game: "irl-dungeon", playerId: 1, record: JSON.stringify({ n }), t: n });
  const head1 = ledger(db)[0].hash;
  const hand = (from) => db.prepare(`UPDATE copies SET holder_id = 8, moves = moves + 1 WHERE copy = 1 AND holder_id = ${from}`);
  await db.batch([hand(99), await chainInsert(db, head1, entry(1), { ifChanged: true })]);      // changes no row: nothing sealed
  assert.equal(ledger(db).length, 1);
  await db.batch([hand(1), await chainInsert(db, head1, entry(2), { ifChanged: true })]);       // changes a row: sealed
  assert.equal(ledger(db).length, 2);
  assert.equal(ledger(db)[1].record, '{"n":2}');
});

test("heldBy lists a player's copies, per game, and a copy leaves the hand it was taken from", async () => {
  const db = setup();
  await birth(db, irl(1, "k1", 2)); await birth(db, irl(1, "k2", 1)); await birth(db, irl(1, "k3", 1)); await birth(db, irl(2, "k4", 1));
  await birth(db, { itemId: 1, game: "4dungeon", playerId: 1, key: "k5" });
  assert.deepEqual(await heldBy(db, "irl-dungeon", 1), [{ itemId: 1, copy: 1, moves: 0 }, { itemId: 1, copy: 2, moves: 0 }, { itemId: 2, copy: 1, moves: 0 }]);
  assert.deepEqual(await heldBy(db, "4dungeon", 1), [{ itemId: 1, copy: 4, moves: 0 }]);
  await moveCopy(db, { itemId: 1, copy: 1, from: { game: "irl-dungeon", playerId: 1 }, to: { game: "4dungeon", playerId: 1 } });
  assert.deepEqual((await heldBy(db, "irl-dungeon", 1)).map((c) => [c.itemId, c.copy]), [[1, 2], [2, 1]]);
  assert.deepEqual((await heldBy(db, "4dungeon", 1)).map((c) => [c.itemId, c.copy, c.moves]), [[1, 1, 1], [1, 4, 0]]);
  assert.deepEqual(await heldBy(db, "nobody", 1), []);
  assert.deepEqual(await heldBy(db, "", 0), []);
});

test("an empty ledger verifies, and the ledger can't be edited or deleted", async () => {
  const db = setup();
  assert.deepEqual(await verify(db), { ok: true, count: 0, head: GENESIS });
  await birth(db, irl(1, "k1")); await birth(db, irl(1, "k2"));
  assert.throws(() => db.raw.prepare("UPDATE ledger SET record = 'x'").run(), /append-only/);
  assert.throws(() => db.raw.prepare("DELETE FROM ledger").run(), /append-only/);
  assert.equal(ledger(db).length, 2);
});

test("tampering is caught: an edited record, an edited holder's history, a deleted entry", async () => {
  const mk = async () => { const db = setup(); for (let n = 1; n <= 4; n++) await birth(db, irl(n, "k" + n)); db.raw.exec("DROP TRIGGER ledger_no_edits; DROP TRIGGER ledger_no_deletes;"); return db; };
  let db = await mk(); const ids = ledger(db).map((r) => r.id);
  db.raw.prepare("UPDATE ledger SET record = ? WHERE id = ?").run('{"k":"copy","item":1,"copy":9,"game":"irl-dungeon"}', ids[1]);
  assert.deepEqual(await verify(db), { ok: false, at: ids[1] });
  db = await mk();
  db.raw.prepare("DELETE FROM ledger WHERE id = ?").run(ids[1]);
  assert.deepEqual(await verify(db), { ok: false, at: ids[2] });
});

test("the public Worker shows no copies and no holders", async () => {
  const db = setup();
  await birth(db, irl(424242, "k1"));
  const get = async (path) => { const r = await worker.fetch(new Request("https://items.example" + path), { DB: db }); return { status: r.status, text: await r.text() }; };
  assert.equal((await get("/api/copies")).status, 404);
  assert.equal((await get("/api/ledger")).status, 404);
  const items = await get("/api/items?all=1");
  assert.equal(items.status, 200);
  for (const word of ["holder", "424242", "irl-dungeon", "born_key"]) assert.ok(!items.text.includes(word), word);
});
