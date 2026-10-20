// The registry's ledger, open to everyone: every copy made, moved, used up or marked, newest first.
//   GET /api/registry/ledger?before=ID&limit=N   JSON (N up to 100)
//   GET /ledger                                  the same thing as a page
// Records hold item ids, copy numbers and game names only (see ledger.js), never a player id. The player_id column is not
// selected here. Each entry carries the time it was sealed (`at`, seconds). The item's public details (name, rarity,
// note, alignment, nature, type, picture, home game) are added for reading; they are not part of the sealed record, so
// anyone can still rebuild the hashes from `record` alone.
import { GENESIS } from "./ledger.js";

const COLS = "id, kind, game, record, prev_hash, hash, created_at";

async function shape(db, results) {
  const ids = new Set();
  for (const r of results) { try { const n = JSON.parse(r.record).item; if (Number.isInteger(n)) ids.add(n); } catch { /* an unreadable record just has no name */ } }
  const names = new Map();
  if (ids.size) {
    const list = [...ids];
    const { results: items } = await db.prepare(`SELECT id, name, rarity, note, alignment, nature, type, image, source FROM items WHERE id IN (${list.map(() => "?").join(",")})`).bind(...list).all();
    for (const i of items) names.set(i.id, { name: i.name, rarity: i.rarity, note: i.note, alignment: i.alignment, nature: i.nature, type: i.type, image: i.image, source: i.source });
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
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>~*~ Item Registry Ledger ~*~</title>
<style>
:root{--sky:#000033;--ink:#ffff00;--text:#fff;--link:#00ffff;--panel:#000080;--edge:#c0c0c0}
*{box-sizing:border-box}[hidden]{display:none!important}
body{margin:0;color:var(--text);font:16px/1.4 "Comic Sans MS","Comic Sans","Chalkboard SE","Times New Roman",serif;background:var(--sky)}
body::before{content:"";position:fixed;inset:0;z-index:-1;background:var(--sky) url("/deco/stars.gif");image-rendering:pixelated}
main{max-width:720px;margin:0 auto;padding:16px}
h1{margin:4px 0;text-align:center;font:48px "Times New Roman",Times,serif;color:var(--ink);text-shadow:3px 3px 0 #ff00ff}
.sub{margin:0;text-align:center;color:#ff99ff;font-weight:bold}
hr{border:0;height:6px;margin:16px 0;background:linear-gradient(90deg,#f00,#f90,#ff0,#0f0,#0ff,#00f,#f0f)}
a{color:var(--link)}a:visited{color:#ff99ff}
.panel{background:var(--panel);border:3px ridge var(--edge);padding:10px;margin:12px 0;box-shadow:6px 6px 0 rgba(0,0,0,.6)}
.top{font-size:13px;color:var(--ink)}
.say{margin:4px 0;font-size:17px}
.name{text-align:center;font-weight:bold;font-size:24px;color:var(--ink);margin:0 0 8px}
.say img{float:left;width:88px;height:31px;margin:2px 10px 4px 0;image-rendering:pixelated;border:0}
.facts{clear:both;font-size:13px;color:#ff99ff}
.note{font-size:13px;font-style:italic}
.seal{margin-top:6px;font:11px/1.35 "Courier New",Courier,monospace;color:#c0c0c0;word-break:break-all}
.head{text-align:center;font:12px "Courier New",Courier,monospace;word-break:break-all;color:var(--link)}
button{font:bold 14px Arial,Helvetica,sans-serif;padding:3px 10px;cursor:pointer;color:#000;background:var(--edge);border:2px outset #fff;display:block;margin:12px auto}
/* 4Dungeon's things: its black screen and ASCII frame (colours from daily-dungeon index.html) */
@font-face{font-family:"VT323";src:url("https://dungeon.88x31.app/fonts/VT323-Regular.ttf") format("truetype");font-display:swap}
.ascii{--bg:#07090a;--fg:#e4e4df;--trail:#8f8f8a;--gold:#e3b341;--moon:#9fc4ff;background:var(--bg) linear-gradient(var(--trail),var(--trail)) .5ch 0/2px 100% no-repeat;color:var(--fg);
  font:19px/1.15 "VT323",ui-monospace,Menlo,Consolas,monospace;font-variant-ligatures:none;border:0;box-shadow:none;padding:0 2ch;text-shadow:0 0 4px rgba(228,228,223,.2)}
.ascii::after{content:"";position:absolute;top:0;bottom:0;right:.5ch;width:2px;background:var(--trail)}
.ascii{position:relative}
.ascii .rule{display:flex;margin:0 -2ch;color:var(--trail);background:var(--bg);position:relative;z-index:1}.ascii .rule i{flex:1;overflow:hidden;white-space:nowrap;font-style:normal}
.ascii .top{color:var(--trail);font-size:inherit}.ascii .say{font-size:inherit}.ascii .facts{color:var(--trail);font-size:inherit;text-transform:uppercase}
.ascii .note{font-size:inherit;font-style:normal;color:var(--fg)}.ascii .seal{font:15px/1.2 "VT323",ui-monospace,monospace;color:var(--trail)}
.ascii a,.ascii a:visited{color:#fff;text-decoration:none;text-shadow:0 0 6px #fff}.ascii a:hover{background:var(--fg);color:var(--bg)}
.ascii .name{font:inherit;font-size:28px;color:#fff;text-shadow:0 0 6px #fff;text-transform:uppercase}
.q-rare{color:#6aa6e8!important}.q-mythic,.q-relic,.q-ultra,.q-prototype{color:#f5c542!important}.q-moon{color:#c9b6ff!important}
body.dun{background:#07090a}body.dun::before{display:none}
body.dun h1{font:44px "VT323",ui-monospace,monospace;color:#fff;text-shadow:0 0 6px #fff}body.dun .sub{font:20px "VT323",ui-monospace,monospace;color:#8f8f8a;font-weight:normal}
body.dun hr{height:auto;background:none;margin:8px 0}body.dun hr::before{content:"";display:none}
body.dun .head,body.dun #list>p{font-family:"VT323",ui-monospace,monospace;font-size:19px}body.dun #list>p a{color:#fff}
</style></head><body><main>
<h1 id="title">~*~ Item Registry ~*~</h1>
<p class="sub" id="sub">Every copy ever made, moved, marked or used up, in every game. Newest first.</p>
<hr>
<div class="head" id="head"></div>
<div id="card"></div>
<div id="list"></div>
<button id="more" hidden>Older</button>
</main><script>
const $ = (s) => document.querySelector(s);
const sayGame = { "4dungeon": "4Dungeon", "88x31": "88x31", "irl-dungeon": "irl-dungeon", "scoundrel": "scoundrel.exe", "dawn-baton": "Dawn Baton" };
const g = (x) => sayGame[x] || x;
// mark words, after 4Dungeon's own (rules.js DEED_WORDS, PHASE_WORDS, OCC_WORDS, MOON_WORDS)
const PHASE = { new: "a new moon", wax_cres: "a waxing crescent moon", first_q: "a first quarter moon", wax_gib: "a waxing gibbous moon",
  full: "a full moon", wan_gib: "a waning gibbous moon", last_q: "a last quarter moon", wan_cres: "a waning crescent moon" };
const OCC = { thirteenth_moon: "under the Thirteenth Moon", eclipse_solar: "during a solar eclipse", eclipse_lunar: "during a lunar eclipse",
  blue_moon: "under a blue moon", supermoon: "under a supermoon", solstice: "on a solstice", equinox: "on an equinox", mirror_day: "on a mirror day" };
const DEED = { found_wall: "was found in a wall", from_demon: "came from a demon", given_member: "was a gift from a friend", from_stranger: "was left by a stranger",
  made_compiler: "was made by COMPILER", copied_cache: "was copied by CACHE", kit: "was brought along", moon_gift: "was a gift from the Moon",
  found_inside: "was found inside something", carried_up: "was carried up a level", first_copy: "is the very first one ever made", hundredth_copy: "is the hundredth one made" };
const MOON = { answered: "answered the Moon", blessed: "was blessed by the Moon" };
function markWords(r) {
  if (r.kind === "night") return PHASE[r.value] ? "was found under " + PHASE[r.value] : OCC[r.value] ? "was found " + OCC[r.value] : null;
  if (r.kind === "moon") return MOON[r.value] || null;
  return DEED[r.value] || null;
}
function say(e, r) {
  if (!r) return "An entry this page can't read.";
  const what = (e.item ? e.item.name : "item " + r.item) + " #" + r.copy;
  if (r.k === "copy") return what + " came into the world in " + g(r.game) + ".";
  if (r.k === "move") return r.from === r.to ? what + " changed hands in " + g(r.to) + "." : what + " travelled from " + g(r.from) + " to " + g(r.to) + ".";
  if (r.k === "spend") return what + " was used up in " + g(r.game) + ". It is gone.";
  if (r.k === "mark") { const w = markWords(r); return w ? what + " " + w + ", in " + g(r.game) + "." : what + " got a mark in " + g(r.game) + ": " + r.value.replace(/_/g, " ") + "."; }
  return "An entry this page doesn't know.";
}
const when = (t) => new Date(t * 1000).toLocaleString([], { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const qs = new URLSearchParams(location.search), one = qs.get("item") && qs.get("copy");
function el(tag, cls, text) { const x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; }
function facts(i) {
  return [i.rarity, i.type ? i.type + " button" : null, i.alignment, i.nature, i.source ? "from " + g(i.source) : null].filter(Boolean).join(" · ");
}
// 4Dungeon's things get its black ASCII panel: a +====+ rule above and below, | down each side
const dun = (i) => !!i && i.source === "4dungeon";
function rule() { const d = el("div", "rule"); d.append(el("span", null, "+"), el("i", null, "=".repeat(300)), el("span", null, "+")); return d; }
function ascii(p) { p.classList.add("ascii"); p.prepend(rule()); p.append(rule()); return p; }
function row(e) {
  let r; try { r = JSON.parse(e.record); } catch { r = null; }
  const p = el("div", "panel");
  p.append(el("div", "top", "#" + e.id + " · " + when(e.at) + (r && r.k === "mark" ? " · mark " + r.n + " on this copy" : "")));
  const s = el("div", "say");
  if (e.item && e.item.image) { const im = el("img"); im.src = e.item.image; im.alt = e.item.name; s.append(im); }
  if (dun(e.item)) s.append("> ");
  if (r && !one && Number.isInteger(r.item)) { const l = el("a", null, say(e, r)); l.href = "?item=" + r.item + "&copy=" + r.copy; s.append(l); } else s.append(say(e, r));
  p.append(s);
  if (e.item && !one) { p.append(el("div", "facts", facts(e.item))); p.lastChild.classList.add("q-" + e.item.rarity); if (e.item.note) p.append(el("div", "note", "“" + e.item.note + "”")); }
  p.append(el("div", "seal", "record " + e.record + "\\nprev " + e.prev_hash + "\\nhash " + e.hash));
  p.lastChild.style.whiteSpace = "pre-wrap";
  return dun(e.item) ? ascii(p) : p;
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
  if (!res.ok) { $("#title").textContent = "No such copy."; $("#sub").textContent = ""; return; }
  const d = await res.json(), i = d.item;
  document.title = i.name + " #" + d.copy;
  $("#sub").textContent = "Everything that has happened to this copy, newest first.";
  if (dun(i)) { document.body.classList.add("dun"); $("#title").textContent = "= ITEM REGISTRY ="; }
  const c = el("div", "panel");
  const nm = el("div", "name", i.name + " #" + d.copy); c.append(nm);
  if (i.image) { const p = el("div"); p.style.textAlign = "center"; const im = el("img"); im.src = i.image; im.alt = i.name; im.style.cssText = "width:264px;height:93px;image-rendering:pixelated"; p.append(im); c.append(p); }
  c.append(el("div", "say", facts(i))); if (dun(i)) { c.lastChild.classList.add("q-" + i.rarity); c.lastChild.style.textTransform = "uppercase"; }
  if (i.note) c.append(el("div", "note", "\u201c" + i.note + "\u201d"));
  c.append(el("div", "facts", ["made in " + g(d.born_game) + " on " + when(d.born_at), d.moves + (d.moves === 1 ? " move" : " moves"), d.used_up ? "used up" : "still around"].join(" \u00b7 ")));
  if (i.source === "88x31") { const p = el("div", "say"); const a = el("a", null, "See this button's page on 88x31 \u00bb"); a.href = "https://88x31.app/api/registry/button?item=" + i.id + "&copy=" + d.copy; p.append(a); c.append(p); }
  $("#card").append(dun(i) ? ascii(c) : c);
  for (const e of d.entries) $("#list").append(row(e));
  const back = el("p"); back.style.textAlign = "center"; const a = el("a", null, "\u00ab The whole ledger"); a.href = location.pathname; back.append(a); $("#list").append(back);
}
$("#more").onclick = load;
one ? loadCopy() : load();
</script></body></html>`;
