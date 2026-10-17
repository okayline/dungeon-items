// Shared accounts: save codes, game links and passkeys (with a software authenticator built from raw bytes).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { fakeD1 } from "./helpers.mjs";
import * as A from "../src/accounts.js";

const ORIGIN = "https://irl.88x31.test", RPID = "88x31.test";
const { subtle } = webcrypto;
const sha = (b) => createHash("sha256").update(b).digest();
const b64u = (b) => Buffer.from(b).toString("base64url");
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };

// A tiny CBOR writer: unsigned and negative ints, byte strings, text and maps (all WebAuthn needs here).
const cborHead = (major, n) => n < 24 ? Buffer.from([(major << 5) | n]) : n < 256 ? Buffer.from([(major << 5) | 24, n]) : Buffer.from([(major << 5) | 25, n >> 8, n & 255]);
function cbor(v) {
  if (typeof v === "number") return v >= 0 ? cborHead(0, v) : cborHead(1, -1 - v);
  if (typeof v === "string") { const b = Buffer.from(v); return Buffer.concat([cborHead(3, b.length), b]); }
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) return Buffer.concat([cborHead(2, v.length), v]);
  if (v instanceof Map) return Buffer.concat([cborHead(5, v.size), ...[...v].flatMap(([k, x]) => [cbor(k), cbor(x)])]);
  throw new Error("cbor: unsupported");
}

// WebCrypto signs ES256 as raw r||s; WebAuthn sends it DER-encoded.
function rawToDer(raw) {
  const int = (b) => { let i = 0; while (i < b.length - 1 && b[i] === 0) i++; let v = b.subarray(i); if (v[0] & 0x80) v = Buffer.concat([Buffer.from([0]), v]); return Buffer.concat([Buffer.from([2, v.length]), v]); };
  const body = Buffer.concat([int(raw.subarray(0, 32)), int(raw.subarray(32))]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}

async function authenticator() {
  const kp = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const jwk = await subtle.exportKey("jwk", kp.publicKey);
  const credId = Buffer.from(webcrypto.getRandomValues(new Uint8Array(16)));
  const cose = new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, "base64url")], [-3, Buffer.from(jwk.y, "base64url")]]);
  const flags = (up) => (up ? 1 : 0) | 4;                                   // user present + user verified
  let counter = 0;
  return {
    id: b64u(credId), privateKey: kp.privateKey,
    register(challenge, { origin = ORIGIN, rpId = RPID, up = true, type = "webauthn.create" } = {}) {
      const authData = Buffer.concat([sha(rpId), Buffer.from([flags(up) | 64]), u32(0), Buffer.alloc(16), u16(credId.length), credId, cbor(cose)]);
      return { id: b64u(credId), response: {
        clientDataJSON: b64u(JSON.stringify({ type, challenge, origin })),
        attestationObject: b64u(cbor(new Map([["fmt", "none"], ["attStmt", new Map()], ["authData", authData]]))) } };
    },
    async login(challenge, { origin = ORIGIN, rpId = RPID, up = true, count, key = kp.privateKey, type = "webauthn.get", id } = {}) {
      const authData = Buffer.concat([sha(rpId), Buffer.from([flags(up)]), u32(count ?? ++counter)]);
      const clientData = Buffer.from(JSON.stringify({ type, challenge, origin }));
      const sig = Buffer.from(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, Buffer.concat([authData, sha(clientData)])));
      return { id: id ?? b64u(credId), response: { clientDataJSON: b64u(clientData), authenticatorData: b64u(authData), signature: b64u(rawToDer(sig)) } };
    },
  };
}


const envOf = () => ({ DB: fakeD1(), RP_ID: RPID });
const rows = (env, sql) => env.DB.raw.prepare(sql).all().map((r) => ({ ...r }));

test("a save code logs in to its account; only its hash is stored; the limit is 5", async () => {
  const env = envOf(), { accountId } = await A.createAccount(env.DB);
  const { code } = await A.addCode(env.DB, accountId);
  assert.match(code, /^([2-9A-HJKMNP-Z]{4}-){4}[2-9A-HJKMNP-Z]{4}$/);
  const want = createHash("sha256").update("code:" + code.replace(/-/g, "")).digest("hex");
  assert.deepEqual(rows(env, "SELECT code_hash FROM account_codes"), [{ code_hash: want }]);
  assert.deepEqual(await A.loginCode(env.DB, code.toLowerCase(), "1.1.1.1"), { accountId });
  assert.equal((await A.loginCode(env.DB, "NOPE-NOPE", "1.1.1.1")).status, 404);
  for (let i = 0; i < 4; i++) assert.ok((await A.addCode(env.DB, accountId)).code);
  assert.match((await A.addCode(env.DB, accountId)).error, /5 save codes/);
});

test("code guesses are rate limited per address", async () => {
  const env = envOf();
  for (let i = 0; i < 10; i++) assert.equal((await A.loginCode(env.DB, "x" + i, "9.9.9.9")).status, 404);
  assert.equal((await A.loginCode(env.DB, "x", "9.9.9.9")).status, 429);
  assert.equal((await A.loginCode(env.DB, "x", "8.8.8.8")).status, 404);
});

test("an old game's code hash can be imported and then works", async () => {
  const env = envOf(), { accountId } = await A.createAccount(env.DB);
  const h = createHash("sha256").update("code:ABCDE12345FGHJK67890").digest("hex");
  assert.deepEqual(await A.importCode(env.DB, accountId, h), { ok: true, skipped: false });
  assert.deepEqual(await A.importCode(env.DB, accountId, h), { ok: true, skipped: true });
  assert.deepEqual(await A.loginCode(env.DB, "abcde-12345-fghjk-67890", "2.2.2.2"), { accountId });
});

test("one player per game per account, and a player is in one account", async () => {
  const env = envOf(), a = (await A.createAccount(env.DB)).accountId, b = (await A.createAccount(env.DB)).accountId;
  assert.deepEqual(await A.link(env.DB, a, "irl-dungeon", 5), { playerId: 5, linked: true });
  assert.deepEqual(await A.link(env.DB, a, "irl-dungeon", 6), { playerId: 5, linked: false });
  assert.deepEqual(await A.link(env.DB, b, "irl-dungeon", 5), { playerId: null, linked: false, taken: true });   // 5 stays with a
  assert.deepEqual(await A.accountOf(env.DB, "irl-dungeon", 5), { accountId: a });
  assert.deepEqual(await A.playerFor(env.DB, b, "irl-dungeon"), { playerId: null });
  assert.deepEqual(await A.link(env.DB, a, "4dungeon", 5), { playerId: 5, linked: true });
  assert.equal((await A.link(env.DB, a, "Bad Game", 1)).error, "Bad link.");
  assert.deepEqual((await A.info(env.DB, a)).games, ["4dungeon", "irl-dungeon"]);
});

test("a passkey made on one game's address logs in from another; other sites are refused", async () => {
  const env = envOf(), { accountId } = await A.createAccount(env.DB), auth = await authenticator();
  const opts = await A.passkeyRegisterOptions(env, { accountId, origin: ORIGIN });
  assert.equal(opts.rp.id, RPID);
  assert.deepEqual(await A.passkeyRegister(env, { accountId, origin: ORIGIN, credential: auth.register(opts.challenge), label: "k" }), { ok: true });
  const other = "https://scoundrel.88x31.test";
  const lo = await A.passkeyLoginOptions(env, { origin: other, ip: "3.3.3.3" });
  const r = await A.passkeyLogin(env, { origin: other, ip: "3.3.3.3", credential: await auth.login(lo.challenge, { origin: other }) });
  assert.deepEqual(r, { accountId });
  assert.match((await A.passkeyRegisterOptions(env, { accountId, origin: "https://evil.example" })).error, /only work on/);
  assert.match((await A.passkeyLoginOptions(env, { origin: "https://88x31.test.evil.com", ip: "3.3.3.3" })).error, /only work on/);
  const lo2 = await A.passkeyLoginOptions(env, { origin: ORIGIN, ip: "3.3.3.3" });
  const bad = await A.passkeyLogin(env, { origin: ORIGIN, ip: "3.3.3.3", credential: await auth.login(lo2.challenge, { origin: "https://evil.example" }) });
  assert.match(bad.error, /somewhere else/);
  assert.deepEqual(await A.passkeyRemove(env.DB, accountId, 1), { ok: true });
  assert.equal(rows(env, "SELECT * FROM account_passkeys").length, 0);
});

test("importing a game's old passkeys and codes makes one account per player, once, and skips bad hashes", async () => {
  const { importSql } = await import("../scripts/import-passkeys.mjs");
  const env = envOf();
  const jwk = await webcrypto.subtle.exportKey("jwk", (await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"])).publicKey);
  const h = "cd".repeat(32);
  const data = { passkeys: [{ user_id: 7, cred_id: "cred'7", public_key: JSON.stringify(jwk), alg: -7, sign_count: 3, label: "old", created_at: 100 }], codes: [{ user_id: 7, code_hash: h }, { user_id: 8, code_hash: "bad" }] };
  const sql = importSql("88x31", data, 500);
  env.DB.raw.exec(sql); env.DB.raw.exec(sql);                             // twice: nothing doubles
  assert.deepEqual(rows(env, "SELECT game, player_id FROM account_players"), [{ game: "88x31", player_id: 7 }]);
  assert.equal(rows(env, "SELECT * FROM accounts").length, 1);
  assert.deepEqual(rows(env, "SELECT cred_id, alg, sign_count, label FROM account_passkeys"), [{ cred_id: "cred'7", alg: -7, sign_count: 3, label: "old" }]);
  const acct = rows(env, "SELECT account_id FROM account_players")[0].account_id;
  assert.deepEqual(rows(env, "SELECT code_hash, account_id FROM account_codes"), [{ code_hash: h, account_id: acct }]);
});
