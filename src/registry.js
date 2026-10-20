// The copy registry: every numbered copy of an item, across all the games, and who holds it. These take the
// `items-db` binding (`db`). The games reach them through the Registry entrypoint (rpc.js, a service binding), and
// nothing else writes to `copies` or `ledger`.
//
//   birth(db, { itemId, game, playerId, key, t? })   make the next numbered copy for this player.
//        -> { itemId, copy, created } (created is false when `key` already made this copy: a retry makes no second one)
//        -> { error } when the item is unknown or retired, the key was used for a different item, or an argument is bad.
//   moveCopy(db, { itemId, copy, from, to, t? })      hand a copy over: from and to are { game, playerId }.
//        -> { ok: true, moves } or { error } (not the holder, no such copy, already theirs, bad argument).
//   spendCopy(db, { itemId, copy, holder, t? })       the holder used it up in their game (an 88x31 fusion): it stays, never moves.
//        -> { ok: true } or { error }. Spending one already spent by the same holder answers { ok: true, already: true }.
//   heldBy(db, game, playerId)                        the copies a player holds now (not spent): [{ itemId, copy, moves, born, item, marks }].
//   addMark / marksOf                                 a copy's history (migration 005): see the bottom of this file.
//   whereIs(db, itemId, copy)                         who holds a copy now: { game, playerId, spent } or null.
//   addItems(db, game, items)                         a game adds its own items (source = game); INSERT OR IGNORE, so an item
//        already there is never changed. -> { added } . retireItems(db, game, keys) retires its own items by source_key.
//
// The ladder (migration 004): common < uncommon < rare < prototype < relic < ultra, plus moon. Ultra is 1-of-1, and
// prototype, relic and ultra are only born in their home game (items.source): triggers in schema.sql enforce both.
//   sealRun(db, { game, playerId, run, detail, t? })  a run's end, for a game with no ledger of its own (see above whereIs).
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
      if (/1-of-1/.test(String(e && e.message))) return { error: "That item is an ultra: there is only ever one." };
      if (/home game/.test(String(e && e.message))) return { error: "Only that item's home game can make new copies of it." };
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
    const row = await db.prepare("SELECT holder_game, holder_id, moves, spent FROM copies WHERE item_id = ? AND copy = ?").bind(itemId, copy).first();
    if (!row) return { error: "No such copy." };
    if (row.spent) return { error: "That copy was used up." };
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
  const { results } = await db.prepare(
    `SELECT c.item_id, c.copy, c.moves, c.born_game, i.source, i.rarity, i.name, i.note, i.type, i.image, i.alignment, i.nature
     FROM copies c JOIN items i ON i.id = c.item_id WHERE c.holder_game = ? AND c.holder_id = ? AND c.spent = 0 ORDER BY c.item_id, c.copy`).bind(game, playerId).all();
  // (v004) each copy carries its item's details, so a game can show a visitor from another game without a second lookup
  // (v005) and its marks, oldest first, in one more query
  const m = await db.prepare(
    `SELECT m.item_id, m.copy, m.kind, m.value, m.game, m.made_at FROM marks m JOIN copies c ON c.item_id = m.item_id AND c.copy = m.copy
     WHERE c.holder_game = ? AND c.holder_id = ? AND c.spent = 0 ORDER BY m.item_id, m.copy, m.n`).bind(game, playerId).all();
  const marks = new Map();
  for (const r of m.results) {
    const k = r.item_id + ":" + r.copy;
    if (!marks.has(k)) marks.set(k, []);
    marks.get(k).push({ kind: r.kind, value: r.value, game: r.game, at: r.made_at });
  }
  return results.map((r) => ({ itemId: r.item_id, copy: r.copy, moves: r.moves, born: r.born_game,
    item: { source: r.source, rarity: r.rarity, name: r.name, note: r.note, type: r.type, image: r.image, alignment: r.alignment, nature: r.nature },
    marks: marks.get(r.item_id + ":" + r.copy) || [] }));
}

// Check the whole ledger (up to `limit` rows, oldest first). Keep the head it returns somewhere outside the database:
// a chain can't show that its newest entries were dropped.
export async function verify(db, limit = 10000) {
  const { results } = await db.prepare("SELECT id, record, prev_hash, hash FROM ledger ORDER BY id LIMIT ?").bind(limit).all();
  return verifyChain(results);
}

export async function spendCopy(db, { itemId, copy, holder, t = now() } = {}) {
  if (!isInt(itemId) || !isInt(copy)) return { error: "Which copy?" };
  if (!holderOk(holder)) return { error: "Whose copy? A game and a player id are needed." };
  for (let i = 0; i < TRIES; i++) {
    const row = await db.prepare("SELECT holder_game, holder_id, spent FROM copies WHERE item_id = ? AND copy = ?").bind(itemId, copy).first();
    if (!row) return { error: "No such copy." };
    if (row.holder_game !== holder.game || row.holder_id !== holder.playerId) return { error: "That copy isn't theirs to use up." };
    if (row.spent) return { ok: true, already: true };
    const record = JSON.stringify({ k: "spend", item: itemId, copy, game: holder.game });
    try {
      const out = await db.batch([
        db.prepare("UPDATE copies SET spent = 1 WHERE item_id = ? AND copy = ? AND holder_game = ? AND holder_id = ? AND spent = 0")
          .bind(itemId, copy, holder.game, holder.playerId),
        await chainInsert(db, await head(db), { kind: "spend", game: holder.game, playerId: holder.playerId, record, t }, { ifChanged: true }),
      ]);
      if (out[0].meta.changes === 1) return { ok: true };
    } catch (e) {
      if (chainClash(e)) continue;
      throw e;
    }
  }
  throw busy();
}

// A game's own items. Only rarities on the ladder; an existing item (same source and key) is left exactly as it is.
const LADDER = new Set(["common", "uncommon", "rare", "prototype", "relic", "ultra", "moon"]);
export async function addItems(db, game, items, t = now()) {
  if (!isText(game, 40) || !Array.isArray(items) || items.length > 500) return { error: "A game and up to 500 items, please." };
  const ok = items.filter((i) => i && isText(String(i.source_key ?? ""), 80) && LADDER.has(i.rarity) && isText(i.name, 200)
    && (i.type == null || isText(i.type, 40)) && (i.image == null || isText(i.image, 500)));
  if (ok.length !== items.length) return { error: "Some items are missing a key, a name or a rarity on the ladder." };
  if (!ok.length) return { added: 0 };
  const out = await db.batch(ok.map((i) => db.prepare(
    "INSERT OR IGNORE INTO items (source, source_key, rarity, name, note, type, image, extra, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(game, String(i.source_key), i.rarity, i.name, i.note ?? null, i.type ?? null, i.image ?? null, JSON.stringify(i.extra || {}), t, t)));
  return { added: out.reduce((n, r) => n + r.meta.changes, 0) };
}
export async function retireItems(db, game, keys) {
  if (!isText(game, 40) || !Array.isArray(keys) || keys.length > 500) return { error: "A game and up to 500 keys, please." };
  if (!keys.length) return { retired: 0 };
  const r = await db.prepare("UPDATE items SET retired = 1 WHERE source = ? AND retired = 0 AND source_key IN (SELECT value FROM json_each(?))")
    .bind(game, JSON.stringify(keys.map(String))).run();
  return { retired: r.meta.changes };
}
// item ids for a game's own keys: { "<source_key>": id }
export async function itemIds(db, game, keys) {
  if (!isText(game, 40) || !Array.isArray(keys) || keys.length > 1000) return {};
  const { results } = await db.prepare("SELECT id, source_key FROM items WHERE source = ? AND source_key IN (SELECT value FROM json_each(?))")
    .bind(game, JSON.stringify(keys.map(String))).all();
  return Object.fromEntries(results.map((r) => [r.source_key, r.id]));
}

// Checkpoints: another game's own ledger, written down here so the registry's hourly Bitcoin stamp covers it too.
//   checkpoint(db, { game, entries, head, detail?, t? })   "that game's ledger had `entries` entries, newest fingerprint `head`".
//        -> { ok: true, created } (created is false when that game's last checkpoint already says this) or { error }.
// One fingerprint covers every entry before it, so a later checkpoint covers earlier ones. A game's ledger only grows:
// fewer entries than its last checkpoint, or the same count with a different fingerprint, is refused. The registry
// can't read the game's database, so a checkpoint is what that game reports. It names no copy and no player (player_id 0).
// `detail` (optional) is a few public facts the game adds for the ledger page, such as Dawn Baton's lap or a scoundrel.exe
// run's score: up to 12 keys of whole numbers, short words or lists of up to 24 of them. Never a player.
const isHead = (h) => typeof h === "string" && /^[0-9a-f]{64}$/.test(h);
const isWord = (v) => v === null || Number.isInteger(v) || (typeof v === "string" && /^[#A-Za-z0-9_ .-]{0,40}$/.test(v));
const detailOk = (d) => d === undefined || (!!d && typeof d === "object" && !Array.isArray(d) && Object.keys(d).length <= 12
  && Object.entries(d).every(([k, v]) => /^[a-z_]{1,20}$/.test(k) && (isWord(v) || (Array.isArray(v) && v.length <= 24 && v.every(isWord)))));
export async function checkpoint(db, { game, entries, head: h, detail, name = null, t = now() } = {}) {
  if (!isText(game, 40) || !isInt(entries) || !isHead(h)) return { error: "A checkpoint needs a game, an entry count and a 64-character fingerprint." };
  if (!detailOk(detail)) return { error: "A checkpoint's detail is up to 12 short public facts: whole numbers, short words, or lists of them." };
  if (name !== null && !(typeof name === "string" && /^[A-Za-z0-9_. -]{1,40}$/.test(name))) return { error: "A checkpoint's name is up to 40 letters, numbers, spaces, - _ or ." };
  for (let i = 0; i < TRIES; i++) {
    const prev = await db.prepare("SELECT record FROM ledger WHERE kind = 'checkpoint' AND game = ? ORDER BY id DESC LIMIT 1").bind(game).first();
    if (prev) {
      const p = JSON.parse(prev.record);
      if (p.head === h && p.entries === entries) return { ok: true, created: false };
      if (entries <= p.entries) return { error: "That ledger had " + p.entries + " entries at its last checkpoint: it can only grow." };
    }
    const record = JSON.stringify({ k: "checkpoint", game, entries, head: h, ...(detail ? { detail } : {}) });
    try {
      await db.batch([await chainInsert(db, await head(db), { kind: "checkpoint", game, playerId: 0, record, t, name })]);
      return { ok: true, created: true };
    } catch (e) {
      if (chainClash(e)) continue;
      throw e;
    }
  }
  throw busy();
}

// (Oct 20) A RUN'S END, for a game that keeps no ledger of its own (4Dungeon): one sealed entry with a few public facts.
//   sealRun(db, { game, playerId, run, detail, t? })   `run` is the game's own fingerprint of the run (8 to 64 lowercase
//   letters and digits, never its real id), so the same run is sealed once and a board can check a score against it.
//   `detail` is the same shape as a checkpoint's. -> { ok: true, created } or { error }. Nothing names the player.
export async function sealRun(db, { game, playerId, run, detail, t = now() } = {}) {
  if (!holderOk({ game, playerId })) return { error: "Whose run? A game and a player id are needed." };
  if (!(typeof run === "string" && /^[a-z0-9]{8,64}$/.test(run))) return { error: "A run needs its fingerprint: 8 to 64 lowercase letters and digits." };
  if (!detail || !detailOk(detail)) return { error: "A run's detail is up to 12 short public facts: whole numbers, short words, or lists of them." };
  const record = JSON.stringify({ k: "run", game, run, detail });
  for (let i = 0; i < TRIES; i++) {
    const have = await db.prepare("SELECT record FROM ledger WHERE kind = 'run' AND game = ? AND json_extract(record, '$.run') = ?").bind(game, run).first();
    if (have) return have.record === record ? { ok: true, created: false } : { error: "That run was already sealed, with other facts." };
    try {
      await db.batch([await chainInsert(db, await head(db), { kind: "run", game, playerId, record, t })]);
      return { ok: true, created: true };
    } catch (e) {
      if (chainClash(e)) continue;
      throw e;
    }
  }
  throw busy();
}

export async function whereIs(db, itemId, copy) {
  if (!isInt(itemId) || !isInt(copy)) return null;
  const r = await db.prepare("SELECT holder_game, holder_id, spent FROM copies WHERE item_id = ? AND copy = ?").bind(itemId, copy).first();
  return r ? { game: r.holder_game, playerId: r.holder_id, spent: !!r.spent } : null;
}

// Marks (migration 005): the history of a copy. Append-only, numbered per copy, each one sealed on the ledger.
//   addMark(db, { itemId, copy, holder, kind, value, key, t? })   the holder's game stamps one thing that happened to it.
//        -> { ok: true, n, created } (created is false when `key` already made this mark) or { error }.
//   marksOf(db, itemId, copy)   -> [{ kind, value, game, at }] oldest first. Never names a player.
// A 'moon' 'blessed' mark counts the copy one tier higher. Blessings stop at the top of the ladder a copy can climb:
// common, uncommon and rare climb to mythic (common 3 times, uncommon 2, rare 1); anything else can't be blessed.
const MARK_KINDS = new Set(["night", "deed", "moon"]);
const CLIMB = { common: 3, uncommon: 2, rare: 1 };
const markValue = (v) => typeof v === "string" && /^[a-z0-9_]{1,40}$/.test(v);

export async function addMark(db, { itemId, copy, holder, kind, value, key, t = now() } = {}) {
  if (!isInt(itemId) || !isInt(copy)) return { error: "Which copy?" };
  if (!holderOk(holder)) return { error: "Whose copy? A game and a player id are needed." };
  if (!MARK_KINDS.has(kind) || !markValue(value)) return { error: "A mark needs a kind (night, deed or moon) and a value." };
  if (kind === "moon" && value !== "answered" && value !== "blessed") return { error: "The moon only answers or blesses." };
  if (!isText(key, 200)) return { error: "A key is needed, so a retry makes no second mark." };
  for (let i = 0; i < TRIES; i++) {
    const have = await db.prepare("SELECT item_id, copy, n FROM marks WHERE game = ? AND mark_key = ?").bind(holder.game, key).first();
    if (have) return have.item_id === itemId && have.copy === copy ? { ok: true, n: have.n, created: false } : { error: "That key already made a different mark." };
    const row = await db.prepare("SELECT c.holder_game, c.holder_id, c.spent, i.rarity FROM copies c JOIN items i ON i.id = c.item_id WHERE c.item_id = ? AND c.copy = ?").bind(itemId, copy).first();
    if (!row) return { error: "No such copy." };
    if (row.spent) return { error: "That copy was used up." };
    if (row.holder_game !== holder.game || row.holder_id !== holder.playerId) return { error: "That copy isn't theirs to mark." };
    if (kind === "moon" && value === "blessed") {
      const b = (await db.prepare("SELECT COUNT(*) AS b FROM marks WHERE item_id = ? AND copy = ? AND kind = 'moon' AND value = 'blessed'").bind(itemId, copy).first()).b;
      if (b >= (CLIMB[row.rarity] || 0)) return { error: "That copy is already as high as a blessing can take it." };
    }
    const n = (await db.prepare("SELECT COALESCE(MAX(n), 0) + 1 AS n FROM marks WHERE item_id = ? AND copy = ?").bind(itemId, copy).first()).n;
    const record = JSON.stringify({ k: "mark", item: itemId, copy, n, kind, value, game: holder.game });
    try {
      await db.batch([
        db.prepare("INSERT INTO marks (item_id, copy, n, kind, value, game, mark_key, made_at) VALUES (?,?,?,?,?,?,?,?)")
          .bind(itemId, copy, n, kind, value, holder.game, key, t),
        await chainInsert(db, await head(db), { kind: "mark", game: holder.game, playerId: holder.playerId, record, t }),
      ]);
      return { ok: true, n, created: true };
    } catch (e) {
      if (isUnique(e) || /no gaps/.test(String(e && e.message))) continue;   // someone took that number, key or head: read again
      throw e;
    }
  }
  throw busy();
}

export async function marksOf(db, itemId, copy) {
  if (!isInt(itemId) || !isInt(copy)) return [];
  const { results } = await db.prepare("SELECT kind, value, game, made_at FROM marks WHERE item_id = ? AND copy = ? ORDER BY n").bind(itemId, copy).all();
  return results.map((r) => ({ kind: r.kind, value: r.value, game: r.game, at: r.made_at }));
}
