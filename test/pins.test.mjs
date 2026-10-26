// The pinned copy (migration 007) and marks on a carried copy. One test per rule. Expected values are hand lists.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeD1 } from "./helpers.mjs";
import { birth, pinned, pin, heldAcross, markCarried, marksOf, verify } from "../src/registry.js";
import { markWords } from "../src/mark-words.js";
import { LEDGER_PAGE } from "../src/public-ledger.js";

// account 1 is 4dungeon player 7 and TILT player 3. Player 7 found item 1 (t 10) and item 2 (t 20); 4dungeon player 8
// (no account) found item 3 (t 30).
const TILT = { game: "clutch-feed-tilt", playerId: 3 };
const setup = async () => {
  const db = fakeD1();
  for (const k of ["a", "b", "c"]) db.raw.prepare("INSERT INTO items (source, source_key, rarity, name, created_at, updated_at) VALUES ('4dungeon', ?, 'common', ?, 1, 1)").run(k, "item " + k);
  db.raw.exec("INSERT INTO accounts (id, created_at) VALUES (1, 1); INSERT INTO account_players VALUES (1, '4dungeon', 7, 1), (1, 'clutch-feed-tilt', 3, 1);");
  await birth(db, { itemId: 1, game: "4dungeon", playerId: 7, key: "k1", t: 10 });
  await birth(db, { itemId: 2, game: "4dungeon", playerId: 7, key: "k2", t: 20 });
  await birth(db, { itemId: 3, game: "4dungeon", playerId: 8, key: "k3", t: 30 });
  return db;
};
const ids = (xs) => xs.map((x) => [x.itemId, x.copy, x.pinned]);

test("a game sees the account's copies from other games, newest first; with no pin it carries the newest", async () => {
  const db = await setup();
  assert.deepEqual(ids(await heldAcross(db, "clutch-feed-tilt", 3)), [[2, 1, false], [1, 1, false]]);
  const p = await pinned(db, "clutch-feed-tilt", 3);
  assert.deepEqual([p.itemId, p.copy, p.game, p.pinned, p.item.name, p.marks], [2, 1, "4dungeon", false, "item b", []]);
  assert.equal(await pinned(db, "clutch-feed-tilt", 99), null);   // a player with no account and no copies
});

test("a pin wins over the newest copy, and only the account's own copies can be pinned", async () => {
  const db = await setup();
  assert.deepEqual(await pin(db, { ...TILT, itemId: 1, copy: 1 }), { ok: true });
  assert.deepEqual([(await pinned(db, "4dungeon", 7)).itemId, (await pinned(db, "clutch-feed-tilt", 3)).pinned], [1, true]);
  assert.deepEqual(await pin(db, { ...TILT, itemId: 3, copy: 1 }), { error: "That copy isn't theirs to pin." });
  assert.deepEqual(db.raw.prepare("SELECT account_id, item_id, copy FROM account_pins").all().map((r) => ({ ...r })), [{ account_id: 1, item_id: 1, copy: 1 }]);
});

test("another game of the same account can mark a carried copy, as its own mark; a stranger's copy can't be", async () => {
  const db = await setup();
  const m = { itemId: 2, copy: 1, by: TILT, kind: "deed", value: "survived_clutch", key: "run:5", t: 40 };
  assert.deepEqual(await markCarried(db, m), { ok: true, n: 1, created: true });
  assert.deepEqual(await markCarried(db, m), { ok: true, n: 1, created: false });
  assert.deepEqual(await markCarried(db, { ...m, itemId: 3, key: "run:6" }), { error: "That copy isn't theirs to mark." });
  assert.deepEqual(await markCarried(db, { ...m, kind: "moon", value: "answered", key: "run:7" }), { error: "Only the Moon's own game makes moon marks." });
  assert.deepEqual(await marksOf(db, 2, 1), [{ kind: "deed", value: "survived_clutch", game: "clutch-feed-tilt", at: 40 }]);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM ledger WHERE kind = 'mark' AND game = 'clutch-feed-tilt' AND player_id = 3").get().n, 1);
  assert.equal((await verify(db)).ok, true);
});

test("the shared mark words are the ones the ledger page runs", () => {
  assert.equal(markWords({ kind: "deed", value: "survived_clutch" }), "was carried through a CLUTCH run");
  const js = LEDGER_PAGE.slice(LEDGER_PAGE.indexOf("<script>") + 8, LEDGER_PAGE.lastIndexOf("</script>"));
  const page = new Function("document", "location", "fetch", js.replace(/\n\/\/ a checkpoint's detail[\s\S]*$/, "") + "\nreturn markWords;");
  assert.equal(page({}, {}, () => {})({ kind: "deed", value: "foil_holo" }), "has a Holo foil");
});

test("the carry window lists the account's copies with the carried one on top, and pins through the game's own route", async () => {
  const db = await setup();
  await markCarried(db, { itemId: 1, copy: 1, by: TILT, kind: "deed", value: "survived_clutch", key: "w1" });
  const { carryWindow } = await import("../src/carry-window.js");
  const html = await carryWindow(db, { ...TILT, frame: { title: "<CARRY>", paper: "red;}" }, pinUrl: "/api/pin" });
  assert.ok(html.indexOf("CARRIED · 4Dungeon") < html.indexOf("item a #1"));   // item b (newest) is carried, on top
  assert.ok(html.includes("It was carried through a CLUTCH run."));
  assert.ok(html.includes('data-item="1" data-copy="1"') && !html.includes('data-item="2"'));
  assert.ok(html.includes("&lt;CARRY&gt;") && !html.includes("red;}"));   // the frame is escaped and checked
  assert.ok(html.includes('"/api/pin"'));
  assert.ok(!html.includes("item c"));   // another player's copy
});
