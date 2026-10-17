// Shared accounts: one account per person, many games. An account holds save codes and passkeys (the ways back in) and
// a link to the player that person is in each game. A game keeps its own players, its own cookie and its own data; it
// asks here "who is this code / passkey?" and gets an account id back, then looks up its own player (playerFor / link).
//
// Save codes: 20 characters from a 31-symbol alphabet, shown once, stored only as a SHA-256 hash (the same scheme every
// game already used, so a hash from an old game's table can be imported as is).
import { siteFor, registerOptions, verifyRegistration, loginOptions, verifyLogin } from "./passkeys.js";

const now = () => Math.floor(Date.now() / 1000);
export const MAX_CODES = 5, MAX_PASSKEYS = 10;
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";      // 31 symbols: no 0 O 1 I L
const enc = new TextEncoder();
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));

export function newSaveCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(40)), out = [];
  for (const b of bytes) { if (b < 248 && out.length < 20) out.push(ALPHABET[b % 31]); }   // 248 = 31 * 8: no bias
  while (out.length < 20) out.push(ALPHABET[crypto.getRandomValues(new Uint8Array(1))[0] % 31]);
  return out.join("").replace(/(.{4})(?=.)/g, "$1-");
}
export const normalizeCode = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export const hashCode = (c) => sha256("code:" + normalizeCode(c));

// guesses and registrations are slowed per hashed address; the game passes the address, we keep only the hash
async function allow(db, ip, action, limit, windowSecs) {
  const start = Math.floor(now() / windowSecs) * windowSecs;
  const key = action + ":" + (await sha256("ip:" + String(ip || "unknown")));
  await db.prepare("DELETE FROM account_limits WHERE window_start < ?").bind(now() - 86400).run();
  const r = await db.prepare("INSERT INTO account_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1 RETURNING count")
    .bind(key, start).first();
  return r.count <= limit;
}

const bad = (error, status = 400) => ({ error, status });
const cleanGame = (g) => /^[a-z0-9][a-z0-9-]{0,39}$/.test(String(g)) ? String(g) : null;

export async function createAccount(db) {
  const r = await db.prepare("INSERT INTO accounts (created_at) VALUES (?) RETURNING id").bind(now()).first();
  return { accountId: r.id };
}

const exists = async (db, id) => !!(await db.prepare("SELECT id FROM accounts WHERE id = ?").bind(Number(id)).first());

// Make a save code for an account (shown once; only the hash is kept).
export async function addCode(db, accountId) {
  if (!(await exists(db, accountId))) return bad("No such account.", 404);
  const n = (await db.prepare("SELECT COUNT(*) AS n FROM account_codes WHERE account_id = ?").bind(accountId).first()).n;
  if (n >= MAX_CODES) return bad(`You have ${MAX_CODES} save codes already. Forget one first.`);
  const code = newSaveCode();
  await db.prepare("INSERT INTO account_codes (account_id, code_hash, created_at) VALUES (?, ?, ?)").bind(accountId, await hashCode(code), now()).run();
  return { code };
}

// Bring in a hash a game already had (its old save_codes table). Skips ones that exist or would go over the limit.
export async function importCode(db, accountId, codeHash) {
  if (!/^[0-9a-f]{64}$/.test(String(codeHash))) return bad("Bad hash.");
  const n = (await db.prepare("SELECT COUNT(*) AS n FROM account_codes WHERE account_id = ?").bind(accountId).first()).n;
  if (n >= MAX_CODES) return { ok: true, skipped: true };
  const r = await db.prepare("INSERT OR IGNORE INTO account_codes (account_id, code_hash, created_at) VALUES (?, ?, ?)").bind(accountId, codeHash, now()).run();
  return { ok: true, skipped: !r.meta.changes };
}

export async function removeCode(db, accountId, id) {
  const r = await db.prepare("DELETE FROM account_codes WHERE id = ? AND account_id = ?").bind(Number(id), accountId).run();
  return r.meta.changes ? { ok: true } : bad("No such save code.", 404);
}

// A typed save code: which account is it?
export async function loginCode(db, code, ip) {
  if (!(await allow(db, ip, "code", 10, 900))) return bad("Too many tries. Wait 15 minutes and try again.", 429);
  const row = await db.prepare("SELECT id, account_id FROM account_codes WHERE code_hash = ?").bind(await hashCode(code)).first();
  if (!row) return bad("That save code didn't work. Check it and try again.", 404);
  await db.prepare("UPDATE account_codes SET last_used_at = ? WHERE id = ?").bind(now(), row.id).run();
  return { accountId: row.account_id };
}

// Is this save-code hash one we know? (a game's legacy code can be checked here once it's imported)
export async function info(db, accountId) {
  if (!(await exists(db, accountId))) return bad("No such account.", 404);
  const codes = (await db.prepare("SELECT id, created_at, last_used_at FROM account_codes WHERE account_id = ? ORDER BY id").bind(accountId).all()).results;
  const passkeys = (await db.prepare("SELECT id, label, created_at, last_used_at FROM account_passkeys WHERE account_id = ? ORDER BY id").bind(accountId).all()).results;
  const games = (await db.prepare("SELECT game FROM account_players WHERE account_id = ? ORDER BY game").bind(accountId).all()).results.map((r) => r.game);
  return { codes, passkeys, games };
}

export async function waysIn(db, accountId) {
  return (await db.prepare("SELECT (SELECT COUNT(*) FROM account_codes WHERE account_id = ?) + (SELECT COUNT(*) FROM account_passkeys WHERE account_id = ?) AS n").bind(accountId, accountId).first()).n;
}

// ---------- the player this account has in each game ----------
export async function playerFor(db, accountId, game) {
  if (!cleanGame(game)) return bad("Bad game name.");
  const r = await db.prepare("SELECT player_id FROM account_players WHERE account_id = ? AND game = ?").bind(accountId, game).first();
  return { playerId: r ? r.player_id : null };
}

// Link a game's player to an account. One player per account per game, and a player belongs to one account: if either
// side is already taken, nothing changes and the existing link comes back.
export async function link(db, accountId, game, playerId) {
  if (!cleanGame(game) || !Number.isInteger(playerId) || playerId < 1) return bad("Bad link.");
  if (!(await exists(db, accountId))) return bad("No such account.", 404);
  await db.prepare("INSERT OR IGNORE INTO account_players (account_id, game, player_id, created_at) VALUES (?, ?, ?, ?)").bind(accountId, game, playerId, now()).run();
  const mine = await db.prepare("SELECT player_id FROM account_players WHERE account_id = ? AND game = ?").bind(accountId, game).first();
  if (!mine) return { playerId: null, linked: false, taken: true };      // that player is already in another account
  return { playerId: mine.player_id, linked: mine.player_id === playerId };
}

export async function accountOf(db, game, playerId) {
  const r = await db.prepare("SELECT account_id FROM account_players WHERE game = ? AND player_id = ?").bind(game, playerId).first();
  return { accountId: r ? r.account_id : null };
}

// A game deleted a player: forget the link (the account, its codes and its other games stay).
export async function unlink(db, game, playerId) {
  const r = await db.prepare("DELETE FROM account_players WHERE game = ? AND player_id = ?").bind(String(game), Number(playerId)).run();
  return { ok: true, removed: r.meta.changes };
}

// ---------- passkeys ----------
// Each takes the origin of the page that asked (the game passes its own request's origin).
const guard = async (fn) => { try { return await fn(); } catch (e) { return bad(e.message || "Something went wrong with the passkey."); } };

export const passkeyRegisterOptions = (env, { accountId, origin }) => guard(async () => registerOptions(env.DB, siteFor(env, origin), accountId));
export const passkeyRegister = (env, { accountId, origin, credential, label }) => guard(async () => {
  const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM account_passkeys WHERE account_id = ?").bind(accountId).first()).n;
  if (n >= MAX_PASSKEYS) throw new Error("That's plenty of passkeys! Forget one first.");
  return verifyRegistration(env.DB, siteFor(env, origin), accountId, credential, label);
});
export const passkeyLoginOptions = (env, { origin, ip }) => guard(async () => {
  if (!(await allow(env.DB, ip, "passkey", 20, 900))) return bad("Too many tries. Wait 15 minutes and try again.", 429);
  return loginOptions(env.DB, siteFor(env, origin));
});
export const passkeyLogin = (env, { origin, credential, ip }) => guard(async () => {
  if (!(await allow(env.DB, ip, "passkey", 20, 900))) return bad("Too many tries. Wait 15 minutes and try again.", 429);
  return { accountId: await verifyLogin(env.DB, siteFor(env, origin), credential) };
});
export async function passkeyRemove(db, accountId, id) {
  const r = await db.prepare("DELETE FROM account_passkeys WHERE id = ? AND account_id = ?").bind(Number(id), accountId).run();
  return r.meta.changes ? { ok: true } : bad("No such passkey.", 404);
}
