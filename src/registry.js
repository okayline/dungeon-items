// The copy registry: every numbered copy of an item, across all the games, and who holds it. These take the
// `items-db` binding (`db`). The games reach them through the Registry entrypoint (rpc.js, a service binding), and
// nothing else writes to `copies` or `ledger`.
//
//   birth(db, { itemId, game, playerId, key, t? })   make the next numbered copy for this player.
//        -> { itemId, copy, created } (created is false when `key` already made this copy: a retry makes no second one)
//        -> { error } when the item is unknown or retired, the key was used for a different item, or an argument is bad.
//   moveCopy(db, { itemId, copy, from, to, t? })      hand a copy over: from and to are { game, playerId }.
//        -> { ok: true, moves } or { error } (not the holder, no such copy, already theirs, bad argument).
//   heldBy(db, game, playerId)                        the copies a player holds now: [{ itemId, copy, moves }].
//   verify(db)                                        checks the whole ledger: { ok, count, head } or { ok: false, at }.
//
// `key` is the game's own name for the moment the copy was made (irl-dungeon: its find, by player, cell, spot and day).
// It stays in `copies` and is never put on the ledger. The same game and key always give back the same copy.
//
// Numbers count up per item from 1 with no gaps. A birth reads the next number, then writes the copy and its ledger
// entry in one D1 batch; if another writer got there first (same number, same head) the batch fails whole and the
// birth reads again. The rules that SQL can enforce (never deleted, numbers never reused or skipped, a copy only changes
// hands one move at a time, retired items make no copies, the ledger is append-only) are triggers in schema.sql.
import { head, chainInsert, chainClash, isUnique, verifyChain } from "./ledger.js";

const TRIES = 8;
const now = () => Math.floor(Date.now() / 1000);
const isInt = (n) => Number.isInteger(n) && n >= 1;
const isText = (s, max) => typeof s === "string" && s.length >= 1 && s.length <= max;
const holderOk = (h) => !!h && isText(h.game, 40) && isInt(h.playerId);
const busy = () => new Error("The registry is busy. Try again.");

export async function birth(db, { itemId, game, playerId, key, t = now() } = {}) {
  if (!isInt(itemId)) return { error: "Which item?" };
  if (!holderOk({ game, playerId })) return { error: "Whose copy? A game and a player id are needed." };
  if (!isText(key, 200)) return { error: "A key is needed, so a retry makes no second copy." };
  for (let i = 0; i < TRIES; i++) {
    const have = await db.prepare("SELECT item_id, copy FROM copies WHERE born_game = ? AND born_key = ?").bind(game, key).first();
    if (have) return have.item_id === itemId ? { itemId, copy: have.copy, created: false } : { error: "That key already made a copy of a different item." };
    const item = await db.prepare("SELECT retired FROM items WHERE id = ?").bind(itemId).first();
    if (!item) return { error: "No such item." };
    if (item.retired) return { error: "That item is retired and makes no new copies." };
    const next = (await db.prepare("SELECT COALESCE(MAX(copy), 0) + 1 AS n FROM copies WHERE item_id = ?").bind(itemId).first()).n;
    const record = JSON.stringify({ k: "copy", item: itemId, copy: next, game });
    try {
      await db.batch([
        db.prepare("INSERT INTO copies (item_id, copy, born_game, born_key, holder_game, holder_id, moves, born_at, moved_at) VALUES (?,?,?,?,?,?,0,?,?)")
          .bind(itemId, next, game, key, game, playerId, t, t),
        await chainInsert(db, await head(db), { kind: "copy", game, playerId, record, t }),
      ]);
      return { itemId, copy: next, created: true };
    } catch (e) {
      if (/retired/.test(String(e && e.message))) return { error: "That item is retired and makes no new copies." };
      if (isUnique(e) || /no gaps/.test(String(e && e.message))) continue;   // someone took that number, that key or that head: read again
      throw e;
    }
  }
  throw busy();
}

export async function moveCopy(db, { itemId, copy, from, to, t = now() } = {}) {
  if (!isInt(itemId) || !isInt(copy)) return { error: "Which copy?" };
  if (!holderOk(from) || !holderOk(to)) return { error: "From whom, to whom? A game and a player id for each." };
  if (from.game === to.game && from.playerId === to.playerId) return { error: "That copy is already theirs." };
  for (let i = 0; i < TRIES; i++) {
    const row = await db.prepare("SELECT holder_game, holder_id, moves FROM copies WHERE item_id = ? AND copy = ?").bind(itemId, copy).first();
    if (!row) return { error: "No such copy." };
    if (row.holder_game !== from.game || row.holder_id !== from.playerId) return { error: "That copy isn't theirs to hand over." };
    const record = JSON.stringify({ k: "move", item: itemId, copy, from: from.game, to: to.game });
    try {
      const out = await db.batch([
        db.prepare("UPDATE copies SET holder_game = ?, holder_id = ?, moves = moves + 1, moved_at = ? WHERE item_id = ? AND copy = ? AND holder_game = ? AND holder_id = ?")
          .bind(to.game, to.playerId, t, itemId, copy, from.game, from.playerId),
        await chainInsert(db, await head(db), { kind: "move", game: from.game, playerId: from.playerId, record, t }, { ifChanged: true }),
      ]);
      if (out[0].meta.changes === 1) return { ok: true, moves: row.moves + 1 };
      // Someone else moved it first: nothing was written (the ledger entry only goes in when the update changed a row). Read again.
    } catch (e) {
      if (chainClash(e)) continue;
      throw e;
    }
  }
  throw busy();
}

export async function heldBy(db, game, playerId) {
  if (!isText(game, 40) || !isInt(playerId)) return [];
  const { results } = await db.prepare("SELECT item_id, copy, moves FROM copies WHERE holder_game = ? AND holder_id = ? ORDER BY item_id, copy").bind(game, playerId).all();
  return results.map((r) => ({ itemId: r.item_id, copy: r.copy, moves: r.moves }));
}

// Check the whole ledger (up to `limit` rows, oldest first). Keep the head it returns somewhere outside the database:
// a chain can't show that its newest entries were dropped.
export async function verify(db, limit = 10000) {
  const { results } = await db.prepare("SELECT id, record, prev_hash, hash FROM ledger ORDER BY id LIMIT ?").bind(limit).all();
  return verifyChain(results);
}
