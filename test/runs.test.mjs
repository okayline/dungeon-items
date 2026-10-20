// A run's end on the ledger (sealRun), for a game with no ledger of its own. Expected values come from hand-written
// records and node:crypto, never from the code under test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fakeD1 } from "./helpers.mjs";
import { sealRun, verify } from "../src/registry.js";

const sha = (s) => createHash("sha256").update(s).digest("hex");

test("a run's end is sealed once, with its public facts and no player", async () => {
  const db = fakeD1();
  const detail = { level: "B3F", days: 5, climbed: 1, demons: 4, turns: 340, end: "fell", killer: "THE HOUND" };
  assert.deepEqual(await sealRun(db, { game: "4dungeon", playerId: 7, run: "0123456789abcdef", detail, t: 50 }), { ok: true, created: true });
  const rows = db.raw.prepare("SELECT kind, game, player_id, record, prev_hash, hash FROM ledger").all();
  const rec = '{"k":"run","game":"4dungeon","run":"0123456789abcdef","detail":{"level":"B3F","days":5,"climbed":1,"demons":4,"turns":340,"end":"fell","killer":"THE HOUND"}}';
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "run"); assert.equal(rows[0].player_id, 7); assert.equal(rows[0].record, rec);
  assert.equal(rows[0].hash, sha("0".repeat(64) + "|" + rec));
  // the same run again: nothing new; the same run with other facts: refused
  assert.deepEqual(await sealRun(db, { game: "4dungeon", playerId: 7, run: "0123456789abcdef", detail, t: 60 }), { ok: true, created: false });
  assert.ok((await sealRun(db, { game: "4dungeon", playerId: 7, run: "0123456789abcdef", detail: { ...detail, days: 6 } })).error);
  assert.ok((await sealRun(db, { game: "4dungeon", playerId: 7, run: "NOT A RUN", detail })).error);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM ledger").get().c, 1);
  assert.equal((await verify(db)).ok, true);
});
