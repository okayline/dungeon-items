// A run's moments on the ledger (sealRun), for a game with no ledger of its own. Expected values come from hand-written
// records and node:crypto, never from the code under test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fakeD1 } from "./helpers.mjs";
import { sealRun, verify } from "../src/registry.js";

const sha = (s) => createHash("sha256").update(s).digest("hex");

test("a run's moment is sealed once per turn, with its public facts and no player", async () => {
  const db = fakeD1(), run = "0123456789abcdef";
  const detail = { level: "B3F", day: 2, turn: 40, moon: "wax_gib", demon: "THE HOUND" };
  assert.deepEqual(await sealRun(db, { game: "4dungeon", playerId: 7, run, moment: "talked_down", detail, t: 50 }), { ok: true, created: true });
  const rows = db.raw.prepare("SELECT kind, player_id, record, hash FROM ledger").all();
  const rec = '{"k":"run","game":"4dungeon","run":"0123456789abcdef","moment":"talked_down","detail":{"level":"B3F","day":2,"turn":40,"moon":"wax_gib","demon":"THE HOUND"}}';
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "run"); assert.equal(rows[0].player_id, 7); assert.equal(rows[0].record, rec);
  assert.equal(rows[0].hash, sha("0".repeat(64) + "|" + rec));
  // the same again: nothing new; the same moment and turn with other facts: refused; the same moment on a later turn: a new entry
  assert.deepEqual(await sealRun(db, { game: "4dungeon", playerId: 7, run, moment: "talked_down", detail, t: 60 }), { ok: true, created: false });
  assert.ok((await sealRun(db, { game: "4dungeon", playerId: 7, run, moment: "talked_down", detail: { ...detail, day: 3 } })).error);
  assert.deepEqual(await sealRun(db, { game: "4dungeon", playerId: 7, run, moment: "talked_down", detail: { ...detail, turn: 41 } }), { ok: true, created: true });
  assert.ok((await sealRun(db, { game: "4dungeon", playerId: 7, run: "NOT A RUN", moment: "end", detail })).error);
  assert.ok((await sealRun(db, { game: "4dungeon", playerId: 7, run, moment: "end", detail: { level: "B3F" } })).error);   // no turn
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM ledger").get().c, 2);
  assert.equal((await verify(db)).ok, true);
});
