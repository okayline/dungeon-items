// Make the SQL that brings a game's existing passkeys (and save-code hashes) into the shared accounts.
//   node scripts/import-passkeys.mjs <game> <export.json> > import.sql
//   npx wrangler d1 execute items-db --remote --file=import.sql
// export.json: { "passkeys": [{ user_id, cred_id, public_key, alg, sign_count, label, created_at }], "codes": [{ user_id, code_hash }] }
// (rows straight from that game's passkeys / save_codes tables). Only passkeys made on the bare 88x31.app address can work
// with the shared RP ID; ones made on any other address import fine but will never be offered by the browser.
// Safe to run twice: a player already in an account is left alone, and existing keys / hashes are skipped.
import { readFileSync } from "node:fs";

export function importSql(game, data, at = Math.floor(Date.now() / 1000)) {
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(game)) throw new Error("Bad game name.");
  const q = (v) => v == null ? "NULL" : typeof v === "number" ? String(Math.trunc(v)) : "'" + String(v).replace(/'/g, "''") + "'";
  const link = (id) => `(SELECT account_id FROM account_players WHERE game = ${q(game)} AND player_id = ${Number(id)})`;
  const goodCodes = (data.codes || []).filter((c) => /^[0-9a-f]{64}$/.test(c.code_hash));
  const users = [...new Set([...(data.passkeys || []), ...goodCodes].map((r) => Number(r.user_id)))];
  const out = [];
  for (const id of users) {
    out.push(`INSERT INTO accounts (created_at) SELECT ${at} WHERE ${link(id)} IS NULL;`);
    out.push(`INSERT OR IGNORE INTO account_players (account_id, game, player_id, created_at) SELECT (SELECT MAX(id) FROM accounts), ${q(game)}, ${id}, ${at} WHERE ${link(id)} IS NULL;`);
  }
  for (const k of data.passkeys || []) {
    out.push(`INSERT OR IGNORE INTO account_passkeys (account_id, cred_id, public_key, alg, sign_count, label, created_at, last_used_at) SELECT ${link(k.user_id)}, ${q(k.cred_id)}, ${q(k.public_key)}, ${Number(k.alg)}, ${Number(k.sign_count) || 0}, ${q(k.label)}, ${Number(k.created_at) || at}, NULL WHERE ${link(k.user_id)} IS NOT NULL;`);
  }
  for (const c of goodCodes) {
    out.push(`INSERT OR IGNORE INTO account_codes (account_id, code_hash, created_at) SELECT ${link(c.user_id)}, ${q(c.code_hash)}, ${at} WHERE ${link(c.user_id)} IS NOT NULL;`);
  }
  return out.join("\n") + "\n";
}

if (process.argv[1]?.endsWith("import-passkeys.mjs")) {
  const [game, file] = process.argv.slice(2);
  if (!game || !file) { console.error("usage: node scripts/import-passkeys.mjs <game> <export.json>"); process.exit(1); }
  process.stdout.write(importSql(game, JSON.parse(readFileSync(file, "utf8"))));
}
