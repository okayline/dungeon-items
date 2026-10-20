// The registry's ledger, open to everyone: every copy made, moved, used up or marked, newest first.
//   GET /api/registry/ledger?before=ID&limit=N   JSON (N up to 100)
//   GET /ledger                                  the same thing as a page
// Records hold item ids, copy numbers and game names only (see ledger.js), never a player id. The player_id column is not
// selected here. Each entry shows its date, not its time, as in irl-dungeon. The item's name is added for reading; it
// is not part of the sealed record, so anyone can still rebuild the hashes from `record` alone.
import { GENESIS } from "./ledger.js";

export async function publicLedger(db, params) {
  const before = Number(params.get("before")) || Number.MAX_SAFE_INTEGER;
  const limit = Math.min(100, Math.max(1, Number(params.get("limit")) || 50));
  const { results } = await db.prepare("SELECT id, kind, game, record, prev_hash, hash, created_at FROM ledger WHERE id < ? ORDER BY id DESC LIMIT ?").bind(before, limit).all();
  const ids = new Set();
  for (const r of results) { try { const n = JSON.parse(r.record).item; if (Number.isInteger(n)) ids.add(n); } catch { /* an unreadable record just has no name */ } }
  const names = new Map();
  if (ids.size) {
    const list = [...ids];
    const { results: items } = await db.prepare(`SELECT id, name, rarity FROM items WHERE id IN (${list.map(() => "?").join(",")})`).bind(...list).all();
    for (const i of items) names.set(i.id, { name: i.name, rarity: i.rarity });
  }
  return {
    genesis: GENESIS,
    entries: results.map((r) => {
      let item = null;
      try { item = names.get(JSON.parse(r.record).item) || null; } catch { /* as above */ }
      return { id: r.id, kind: r.kind, game: r.game, record: r.record, prev_hash: r.prev_hash, hash: r.hash, date: new Date(r.created_at * 1000).toISOString().slice(0, 10), item };
    }),
  };
}

export const LEDGER_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark">
<title>Item registry ledger</title>
<style>
body{margin:0;background:#101018;color:#e8e8f0;font:14px/1.4 ui-monospace,Menlo,Consolas,monospace}
main{max-width:720px;margin:0 auto;padding:16px}
h1{font-size:18px;margin:0 0 4px}.m{color:#9a9ab0;font-size:12px}
.e{padding:8px 0;border-bottom:1px solid #2a2a3c}.h{color:#9a9ab0;font-size:11px;word-break:break-all}
button{font:inherit;color:#e8e8f0;background:#101018;border:1px solid #5a5a80;padding:6px 12px;margin:12px 0;cursor:pointer}
</style></head><body><main>
<h1>Item registry ledger</h1>
<div class="m" id="head"></div>
<div id="list"></div>
<button id="more" hidden>Older</button>
</main><script>
const $ = (s) => document.querySelector(s);
const sayGame = { "4dungeon": "4Dungeon", "88x31": "88x31", "irl-dungeon": "irl-dungeon", "scoundrel": "scoundrel.exe", "dawn-baton": "Dawn Baton" };
const g = (x) => sayGame[x] || x;
function say(e) {
  let r; try { r = JSON.parse(e.record); } catch { return "An entry this page can't read."; }
  const what = (e.item ? e.item.name : "item " + r.item) + " #" + r.copy;
  if (r.k === "copy") return what + " was made in " + g(r.game) + ".";
  if (r.k === "move") return what + " moved from " + g(r.from) + " to " + g(r.to) + ".";
  if (r.k === "spend") return what + " was used up in " + g(r.game) + ".";
  if (r.k === "mark") return what + " got a mark in " + g(r.game) + ": " + r.kind + ", " + r.value.replace(/_/g, " ") + ".";
  return "An entry this page doesn't know.";
}
let last = null;
async function load() {
  const d = await (await fetch("/api/registry/ledger?limit=50" + (last ? "&before=" + last : ""))).json();
  if (!last && d.entries.length) $("#head").textContent = "Newest fingerprint: " + d.entries[0].hash;
  for (const e of d.entries) {
    const div = document.createElement("div"); div.className = "e";
    const a = document.createElement("div"); a.textContent = "#" + e.id + " " + e.date + "  " + say(e);
    const h = document.createElement("div"); h.className = "h"; h.textContent = "prev " + e.prev_hash.slice(0, 16) + "  hash " + e.hash.slice(0, 16);
    div.append(a, h); $("#list").append(div);
  }
  if (d.entries.length) last = d.entries[d.entries.length - 1].id;
  $("#more").hidden = d.entries.length < 50;
}
$("#more").onclick = load;
load();
</script></body></html>`;
