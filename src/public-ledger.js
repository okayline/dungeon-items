// The registry's ledger, open to everyone: every copy made, moved, used up or marked, newest first.
//   GET /api/registry/ledger?before=ID&limit=N   JSON (N up to 100)
//   GET /ledger                                  the same thing as a page
// Records hold item ids, copy numbers and game names only (see ledger.js), never a player id. The player_id column is not
// selected here. Each entry carries the time it was sealed (`at`, seconds). The item's name is added for reading; it
// is not part of the sealed record, so anyone can still rebuild the hashes from `record` alone.
import { GENESIS } from "./ledger.js";

const COLS = "id, kind, game, record, prev_hash, hash, created_at";

async function shape(db, results) {
  const ids = new Set();
  for (const r of results) { try { const n = JSON.parse(r.record).item; if (Number.isInteger(n)) ids.add(n); } catch { /* an unreadable record just has no name */ } }
  const names = new Map();
  if (ids.size) {
    const list = [...ids];
    const { results: items } = await db.prepare(`SELECT id, name, rarity FROM items WHERE id IN (${list.map(() => "?").join(",")})`).bind(...list).all();
    for (const i of items) names.set(i.id, { name: i.name, rarity: i.rarity });
  }
  return results.map((r) => {
    let item = null;
    try { item = names.get(JSON.parse(r.record).item) || null; } catch { /* as above */ }
    return { id: r.id, kind: r.kind, game: r.game, record: r.record, prev_hash: r.prev_hash, hash: r.hash, at: r.created_at, item };
  });
}

export async function publicLedger(db, params) {
  const before = Number(params.get("before")) || Number.MAX_SAFE_INTEGER;
  const limit = Math.min(100, Math.max(1, Number(params.get("limit")) || 50));
  const { results } = await db.prepare(`SELECT ${COLS} FROM ledger WHERE id < ? ORDER BY id DESC LIMIT ?`).bind(before, limit).all();
  return { genesis: GENESIS, entries: await shape(db, results) };
}

// One copy's whole story: the item, the game that made it, when, how many copies of the item exist, and every ledger
// entry about it (made, moved, marked, used up), newest first. Who holds it now is not shown. Returns null when there is
// no such copy. The games call copyStory through the registry service binding; the web routes call copyHistory.
export async function copyStory(db, item, copy) {
  if (!Number.isInteger(item) || !Number.isInteger(copy) || item < 1 || copy < 1) return null;
  const c = await db.prepare("SELECT c.born_game, c.born_at, c.moves, c.spent, i.id, i.name, i.note, i.rarity, i.source, i.type, i.image, i.alignment, i.nature, (SELECT MAX(copy) FROM copies WHERE item_id = c.item_id) AS made FROM copies c JOIN items i ON i.id = c.item_id WHERE c.item_id = ? AND c.copy = ?").bind(item, copy).first();
  if (!c) return null;
  const { results } = await db.prepare(`SELECT ${COLS} FROM ledger WHERE json_extract(record, '$.item') = ? AND json_extract(record, '$.copy') = ? ORDER BY id DESC`).bind(item, copy).all();
  return {
    item: { id: c.id, name: c.name, note: c.note, rarity: c.rarity, source: c.source, type: c.type, image: c.image, alignment: c.alignment, nature: c.nature },
    copy, of: c.made, born_game: c.born_game, born_at: c.born_at, moves: c.moves, used_up: !!c.spent, entries: await shape(db, results),
  };
}
export const copyHistory = (db, params) => copyStory(db, Number(params.get("item")), Number(params.get("copy")));

export const LEDGER_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark">
<title>Item registry ledger</title>
<style>
body{margin:0;background:#101018;color:#e8e8f0;font:14px/1.4 ui-monospace,Menlo,Consolas,monospace}
main{max-width:720px;margin:0 auto;padding:16px}
h1{font-size:18px;margin:0 0 4px}.m{color:#9a9ab0;font-size:12px}
a{color:#9ec5ff}.card{border:1px solid #2a2a3c;padding:10px;margin:8px 0}.e{padding:8px 0;border-bottom:1px solid #2a2a3c}.h{color:#9a9ab0;font-size:11px;word-break:break-all}
button{font:inherit;color:#e8e8f0;background:#101018;border:1px solid #5a5a80;padding:6px 12px;margin:12px 0;cursor:pointer}
</style></head><body><main>
<h1 id="title">Item registry ledger</h1>
<div class="m" id="head"></div>
<div id="card"></div>
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
const qs = new URLSearchParams(location.search), one = qs.get("item") && qs.get("copy");
function row(e) {
  const div = document.createElement("div"); div.className = "e";
  const a = document.createElement("div");
  a.append("#" + e.id + " " + new Date(e.at * 1000).toLocaleString() + "  ");
  let r; try { r = JSON.parse(e.record); } catch { r = null; }
  if (r && !one && Number.isInteger(r.item)) { const l = document.createElement("a"); l.href = "?item=" + r.item + "&copy=" + r.copy; l.textContent = say(e); a.append(l); } else a.append(say(e));
  const h = document.createElement("div"); h.className = "h"; h.textContent = "prev " + e.prev_hash.slice(0, 16) + "  hash " + e.hash.slice(0, 16);
  div.append(a, h); return div;
}
let last = null;
async function load() {
  const d = await (await fetch("/api/registry/ledger?limit=50" + (last ? "&before=" + last : ""))).json();
  if (!last && d.entries.length) $("#head").textContent = "Newest fingerprint: " + d.entries[0].hash;
  for (const e of d.entries) $("#list").append(row(e));
  if (d.entries.length) last = d.entries[d.entries.length - 1].id;
  $("#more").hidden = d.entries.length < 50;
}
async function loadCopy() {
  const res = await fetch("/api/registry/copy?item=" + encodeURIComponent(qs.get("item")) + "&copy=" + encodeURIComponent(qs.get("copy")));
  if (!res.ok) { $("#title").textContent = "No such copy."; return; }
  const d = await res.json();
  $("#title").textContent = d.item.name + " #" + d.copy;
  const c = document.createElement("div"); c.className = "card";
  const facts = [d.item.rarity, "made in " + g(d.born_game), d.moves + (d.moves === 1 ? " move" : " moves"), d.used_up ? "used up" : null,
    d.item.alignment, d.item.nature].filter(Boolean).join(" \u00b7 ");
  c.append(facts); if (d.item.note) { const n = document.createElement("div"); n.className = "m"; n.textContent = d.item.note; c.append(n); }
  $("#card").append(c);
  $("#head").textContent = "Everything that has happened to this copy, newest first.";
  for (const e of d.entries) $("#list").append(row(e));
  const back = document.createElement("a"); back.href = "/ledger"; back.textContent = "The whole ledger"; $("#list").append(back);
}
$("#more").onclick = load;
one ? loadCopy() : load();
</script></body></html>`;
