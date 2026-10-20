// The ledger of copies: one SHA-256 hash chain over every birth and move of a numbered copy, in the order sealed.
// Adapted from irl-dungeon/src/ledger.js (the other games' chains work the same way); this one has a `game` column
// because the players it names belong to different games.
//
//   record = JSON of the event
//   hash   = SHA-256( prev_hash + "|" + record )
//
// The first entry chains from GENESIS. Changing any old record breaks its hash and every hash after it. prev_hash is
// UNIQUE, so two entries can never build on the same head: no forks, and two writers racing for the head can't both
// win (the loser re-reads the head and tries again).
//
// Records hold item ids, copy numbers and game names only (and a run's moments, sealRun): no player ids, no keys, no cells. Who did it is in the
// table's own game + player_id columns, which nothing publishes.
//
// WHAT A CHAIN CANNOT DO: it can't show that the newest entries were dropped. Only a copy of the head kept somewhere
// else can (verifyChain returns the head so it can be saved).
//
// Whatever else a write must change goes in the same D1 batch as its ledger entry (chainInserts), so an action is
// saved if and only if it is on the ledger.

export const GENESIS = "0".repeat(64);

export async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function head(db) {
  const h = await db.prepare("SELECT hash FROM ledger ORDER BY id DESC LIMIT 1").first();
  return h ? h.hash : GENESIS;
}

// Build the insert for one entry chained after `prev`: { kind, game, playerId, record (a JSON string), t (seconds), name? }.
// `name` (checkpoints only) is stored beside the record and is not part of the hash.
// With `ifChanged`, the row is written only if the statement just before it in the batch changed a row, so a lost
// race on that statement leaves nothing on the ledger.
export async function chainInsert(db, prev, e, { ifChanged = false } = {}) {
  const hash = await sha256(prev + "|" + e.record);
  const cols = "INSERT INTO ledger (kind, game, player_id, record, prev_hash, hash, created_at, name)";
  const args = [e.kind, e.game, e.playerId, e.record, prev, hash, e.t, e.name ?? null];
  return db.prepare(ifChanged ? `${cols} SELECT ?,?,?,?,?,?,?,? WHERE changes() = 1` : `${cols} VALUES (?,?,?,?,?,?,?,?)`).bind(...args);
}

export const isUnique = (e) => /UNIQUE/i.test(String(e && e.message));
export const chainClash = (e) => isUnique(e) && /ledger\.(prev_)?hash/.test(String(e.message));

// Check that rows (oldest first) form an unbroken chain starting from `from` (the genesis by default; pass the hash
// of the row before the first one to check a later slice). Returns { ok: true, count, head } or { ok: false, at: id }.
export async function verifyChain(rows, from = GENESIS) {
  let p = from;
  for (const r of rows) {
    if (r.prev_hash !== p) return { ok: false, at: r.id };
    if ((await sha256(p + "|" + r.record)) !== r.hash) return { ok: false, at: r.id };
    p = r.hash;
  }
  return { ok: true, count: rows.length, head: p };
}
