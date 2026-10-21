// The registry's ledger, open to everyone: every copy made, moved, used up or marked, newest first.
//   GET /api/registry/ledger?before=ID&limit=N   JSON (N up to 100)
//   GET /ledger                                  the same thing as a page
// Records hold item ids, copy numbers and game names only (see ledger.js), never a player id. The player_id column is not
// selected here. Each entry carries the time it was sealed (`at`, seconds). The item's public details (name, rarity,
// note, alignment, nature, type, picture, home game) are added for reading; they are not part of the sealed record, so
// anyone can still rebuild the hashes from `record` alone.
import { GENESIS } from "./ledger.js";

const COLS = "id, kind, game, record, prev_hash, hash, created_at, name";

// Only 88x31's commons show in public: every other 88x31 item is a mystery, the same rule as 88x31's logged-out Wall
// (88x31 functions/api/designs.js): no name, picture, rarity or anything else, only that it is an 88x31 button.
// The sealed records hold item ids only, so the hashes still check. Used by the ledger, a copy's story and /api/items.
export const isMystery = (i) => !!i && i.source === "88x31" && i.rarity !== "common";
export const mysteryItem = (i) => ({ source: i.source, hidden: true });

// the item ids a record names: one (item), a mark many copies share (copies: [{ item, copy, n }]), or a move's marks
// (marks: [{ kind, value, copies }]), each copy as often as the record names it
const named = (r) => Array.isArray(r.marks) ? r.marks.flatMap((m) => (m && Array.isArray(m.copies) ? m.copies : [])) : Array.isArray(r.copies) ? r.copies : null;
const idsOf = (rec) => { try { const r = JSON.parse(rec), cs = named(r); return cs ? cs.map((c) => c && c.item) : [r.item]; } catch { return []; } };   // an unreadable record just has no name
async function shape(db, results) {
  const ids = new Set();
  for (const r of results) for (const n of idsOf(r.record)) if (Number.isInteger(n)) ids.add(n);
  const names = new Map();
  if (ids.size) {
    const list = [...ids];
    const { results: items } = await db.prepare(`SELECT id, name, rarity, note, alignment, nature, type, image, source FROM items WHERE id IN (${list.map(() => "?").join(",")})`).bind(...list).all();
    for (const i of items) names.set(i.id, isMystery(i) ? mysteryItem(i) : { name: i.name, rarity: i.rarity, note: i.note, alignment: i.alignment, nature: i.nature, type: i.type, image: i.image, source: i.source });
  }
  return results.map((r) => {
    let item = null, items;
    try { const rec = JSON.parse(r.record); if (named(rec)) { items = idsOf(r.record).map((n) => names.get(n) || null); if (items.length === 1) item = items[0]; } else item = names.get(rec.item) || null; } catch { /* as above */ }
    return { id: r.id, kind: r.kind, game: r.game, record: r.record, prev_hash: r.prev_hash, hash: r.hash, at: r.created_at, ...(r.name ? { name: r.name } : {}), item, ...(items ? { items } : {}) };
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
  const { results } = await db.prepare(`SELECT ${COLS} FROM ledger WHERE (json_extract(record, '$.item') = ? AND json_extract(record, '$.copy') = ?)
    OR EXISTS (SELECT 1 FROM json_each(record, '$.copies') j WHERE json_extract(j.value, '$.item') = ? AND json_extract(j.value, '$.copy') = ?)
    OR EXISTS (SELECT 1 FROM json_each(record, '$.marks') m, json_each(m.value, '$.copies') j WHERE json_extract(j.value, '$.item') = ? AND json_extract(j.value, '$.copy') = ?)
    ORDER BY id DESC`).bind(item, copy, item, copy, item, copy).all();   // a mark it shares with other copies too, or a move's marks
  return {
    item: isMystery(c) ? { id: c.id, ...mysteryItem(c) } : { id: c.id, name: c.name, note: c.note, rarity: c.rarity, source: c.source, type: c.type, image: c.image, alignment: c.alignment, nature: c.nature },
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
.panel > .h{font-size:11px;letter-spacing:.08em;font-weight:700;margin:0 0 4px;color:var(--ink)}   /* a game's heading above the entry number */
.say{margin:4px 0;font-size:16px}
.name{text-align:center;font-weight:bold;font-size:22px;color:var(--ink);margin:0 0 8px}
.say img{float:left;width:88px;height:31px;margin:2px 10px 4px 0;image-rendering:pixelated;border:0}
.facts{clear:both;font-size:13px;color:#ff99ff}
.note{font-size:13px;font-style:italic}
.seal{margin-top:6px;font:11px/1.35 "Courier New",Courier,monospace;color:#c0c0c0;word-break:break-all}
.head{text-align:center;font:12px "Courier New",Courier,monospace;word-break:break-all;color:var(--link)}
button{font:bold 14px Arial,Helvetica,sans-serif;padding:3px 10px;cursor:pointer;color:#000;background:var(--edge);border:2px outset #fff;display:block;margin:12px auto}
/* 4Dungeon's things: its black screen and ASCII frame (colours from daily-dungeon index.html) */
@font-face{font-family:"VT323";src:url("https://dungeon.88x31.app/fonts/VT323-Regular.ttf") format("truetype");font-display:swap;size-adjust:130%}
.ascii{--bg:#07090a;--fg:#e4e4df;--trail:#8f8f8a;--gold:#e3b341;--moon:#9fc4ff;background:var(--bg) linear-gradient(var(--trail),var(--trail)) .5ch 0/2px 100% no-repeat;color:var(--fg);
  font:16px/1.2 "VT323",ui-monospace,Menlo,Consolas,monospace;font-variant-ligatures:none;border:0;box-shadow:none;padding:0 2ch}
.ascii::after{content:"";position:absolute;top:0;bottom:0;right:.5ch;width:2px;background:var(--trail)}
.ascii{position:relative}
.ascii .rule{display:flex;margin:0 -2ch;color:var(--trail);background:var(--bg);position:relative;z-index:1}.ascii .rule i{flex:1;overflow:hidden;white-space:nowrap;font-style:normal}
.ascii .top{color:var(--trail);font-size:13px}.ascii .say{font-size:16px}.ascii .facts{color:var(--trail);font-size:13px;text-transform:uppercase}
.ascii .note{font-size:13px;font-style:normal;color:var(--fg)}.ascii .seal{font:11px/1.35 "VT323",ui-monospace,monospace;color:var(--trail)}
.ascii a,.ascii a:visited{color:#fff;text-decoration:none}.ascii a:hover{background:var(--fg);color:var(--bg)}
.ascii .name{font:inherit;font-size:22px;color:#fff;text-transform:uppercase}
.q-rare{color:#6aa6e8!important}.q-mythic,.q-relic,.q-ultra,.q-prototype{color:#f5c542!important}.q-moon{color:#c9b6ff!important}
/* Dawn Baton's checkpoints: its own page's navy panel, rainbow bar and gold heading (dawn-baton public/index.html) */
.baton{background:#1d1d63;border:2px solid #6c6cff;border-radius:6px;box-shadow:none;padding:0 12px 10px;color:#f2f2ff;font:14px/1.35 "Trebuchet MS",Verdana,sans-serif;overflow:hidden}
.baton .bar{height:6px;margin:0 -12px 8px;background:linear-gradient(90deg,#ff5d5d,#ffb84d,#ffe066,#6be08a,#5dc8ff,#8a7bff,#ff7bd0)}
.baton .h{font-size:11px;letter-spacing:.08em;color:#ffe066;font-weight:700;margin:0 0 4px}
.baton .grad{display:flex;height:22px;border:2px solid #fff;margin:6px 0 2px}.baton .grad i{flex:1}.baton .grad i.none{background:#0b0b2b}
.baton .tune{display:flex;color:#ffe066;font-size:13px}.baton .tune span{flex:1;text-align:center}
.ascii .run{font-size:15px;color:var(--fg)}.ascii > .h{font-size:11px;color:var(--gold);letter-spacing:.08em;font-weight:700;margin:0 0 4px}.ascii .run.won{color:var(--gold)}
.baton .top{color:#b9b9ff;font-size:12px}.baton .say{font-size:15px}.baton .seal{color:#b9b9ff;font-family:"Courier New",Courier,monospace}
body.dun{background:#07090a}body.dun::before{display:none}
body.dun h1{font:44px "VT323",ui-monospace,monospace;color:#fff}body.dun .sub{font:20px "VT323",ui-monospace,monospace;color:#8f8f8a;font-weight:normal}
body.dun hr{height:auto;background:none;margin:8px 0}body.dun hr::before{content:"";display:none}
body.dun .head,body.dun #list>p{font-family:"VT323",ui-monospace,monospace;font-size:19px}body.dun #list>p a{color:#fff}
</style></head><body><main>
<h1 id="title">~*~ The Registry ~*~</h1>
<p class="sub" id="sub">Every copy ever made, moved, marked or used up, in every game. Newest first.</p>
<hr>
<div class="head" id="head"></div>
<div id="card"></div>
<div id="list"></div>
<button id="more" hidden>Older</button>
</main><script>
const $ = (s) => document.querySelector(s);
const sayGame = { "4dungeon": "4Dungeon", "88x31": "88x31", "irl-dungeon": "irl-dungeon", "scoundrel": "scoundrel.exe", "dawn-baton": "Dawn Baton", "aura-farm": "Aura Farm" };
const g = (x) => sayGame[x] || x;
// mark words, after 4Dungeon's own (rules.js DEED_WORDS, PHASE_WORDS, OCC_WORDS, MOON_WORDS, MORE_WORDS) and irl-dungeon's
const PHASE = { new: "a new moon", wax_cres: "a waxing crescent moon", first_q: "a first quarter moon", wax_gib: "a waxing gibbous moon",
  full: "a full moon", wan_gib: "a waning gibbous moon", last_q: "a last quarter moon", wan_cres: "a waning crescent moon" };
const OCC = { thirteenth_moon: "under the Thirteenth Moon", eclipse_solar: "during a solar eclipse", eclipse_lunar: "during a lunar eclipse",
  blue_moon: "under a blue moon", supermoon: "under a supermoon", solstice: "on a solstice", equinox: "on an equinox", mirror_day: "on a mirror day" };
const DEED = { found_wall: "was found in a wall", from_demon: "came from a demon", given_member: "was a gift from a friend", from_stranger: "was left by a stranger",
  made_compiler: "was made by COMPILER", copied_cache: "was copied by CACHE", kit: "was brought along", moon_gift: "was a gift from the Moon",
  found_inside: "was found inside something", carried_up: "was carried up a level", first_copy: "is the very first one ever made", hundredth_copy: "is the hundredth one made",
  in_locker: "was in a hidden locker", in_archive: "was in the Archive", deep_stone: "was deep in the stone",   // 4Dungeon v1.33
  beat_demon: "saw a demon fall", talked_down: "saw a demon talked down", fled_fight: "escaped a fight", through_door: "went through a locked door",
  found_outside: "was found outside, in the real world",                                                  // irl-dungeon v0.22
  pulled_pack: "was pulled from a pack", free_pack: "came in a Free Pack", welcome_gift: "was a welcome gift", daily_pick: "was a daily pick",   // 88x31 v0.46
  passed_on: "was passed on by another player", set_reward: "was a reward for a finished set", from_webmaster: "came from the webmaster",
  first_print: "is a First Print, made before foils", traded: "was traded", gifted: "was given as a gift", guestbook_gift: "was left in a guestbook",
  filled_request: "filled a request", fused: "survived a fusion" };
// an 88x31 finish (foil_holo, pattern_etched, effect_crt_vhs): its name from the id, except the effects that are written oddly
const EFFECT = { dialup: "Dial-Up", crt: "CRT", vhs: "VHS", crt_vhs: "CRT+VHS" };
const title = (id) => EFFECT[id] || id.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
const an = (w) => (/^[AEIOU]/.test(w) ? "an " : "a ") + w;
function finishWords(v) {
  const m = v.match(/^(foil|pattern|effect)_([a-z0-9_]+)$/);
  return m ? "has " + an(title(m[2])) + " " + m[1] : null;
}
const MOON = { answered: "answered the Moon", blessed: "was blessed by the Moon" };
function markWords(r) {
  if (r.kind === "night") return PHASE[r.value] ? "was found under " + PHASE[r.value] : OCC[r.value] ? "was found " + OCC[r.value] : null;
  if (r.kind === "moon") return MOON[r.value] || null;
  if (/^on_(b[0-9]|[0-9]+)f$/.test(r.value)) return "was picked up on " + r.value.slice(3).toUpperCase();   // the level (4Dungeon v1.33)
  return DEED[r.value] || finishWords(r.value);
}
// a checkpoint's detail, told in its game's own voice
const isInt = (v) => Number.isInteger(v), plural = (v, one, many) => v + " " + (v === 1 ? one : many);
function lapWords(r) {
  const d = r.detail;
  if (r.game !== "dawn-baton" || !d || !isInt(d.lap)) return null;
  const held = isInt(d.people) && d.people > 0 ? plural(d.people, "person", "people") + " passed the baton along." : "nobody passed the baton.";
  return "Lap " + d.lap + " came home, and " + held + (isInt(d.unheld) && d.unheld > 0 ? " " + plural(d.unheld, "band", "bands") + " went unheld." : "");
}
function runWords(r, who) {
  const d = r.detail;
  if (r.game !== "scoundrel" || !d || !isInt(d.score)) return null;
  const day = isInt(d.day) ? "Day #" + d.day + ": " : "", end = "Score " + d.score + (isInt(d.moves) ? " after " + d.moves + " moves." : ".");
  if (d.status === "won") return day + who + " CLEARED the deck! " + (isInt(d.hp) ? d.hp + " HP left. " : "") + end;
  return day + who + " was DELETED" + (isInt(d.room) ? " in Room " + d.room : "") + ". " + (isInt(d.demons_left) ? plural(d.demons_left, "Demon", "Demons") + " still in the deck. " : "") + end;
}
// an aura-farm farm, told with the two styles and never a player
function farmWords(r) {
  const d = r.detail, ok = (v) => typeof v === "string" && v;
  if (r.game !== "aura-farm" || !d || !isInt(d.farm) || !Array.isArray(d.styles) || !ok(d.styles[0]) || !ok(d.styles[1])) return null;
  const n = "Farm #" + d.farm + ": ", amt = Array.isArray(d.aura) && isInt(d.aura[0]) && d.aura[0] !== 0 ? Math.abs(d.aura[0]).toLocaleString("en-US") : null;
  if (d.winner !== "poster" && d.winner !== "taker") return n + d.styles[0] + " met " + d.styles[1] + ". MUTUAL MOG. Nobody blinked.";
  const won = d.winner === "poster" ? 0 : 1;
  return n + d.styles[won] + " beat " + d.styles[1 - won] + "." + (amt ? " +" + amt + " aura." : "") + " " + d.styles[1 - won] + " got COOKED.";
}
// a 4Dungeon run's moments (sealRun): what happened, where, on which day and under which moon
function momentWords(r) {
  const d = r.detail;
  if (r.game !== "4dungeon" || !d) return null;
  const lv = typeof d.level === "string" && d.level ? d.level : null, on = lv ? " on " + lv : "", day = isInt(d.day) ? ", day " + d.day : "";
  const sky = PHASE[d.moon] ? ", under " + PHASE[d.moon] : "", when = day + sky + ".", who = typeof d.demon === "string" && d.demon ? d.demon : "A demon";
  switch (r.moment) {
    case "enter": return "KURA woke at the bottom of the pit" + on + when;
    case "talked_down": return who + " was appeased" + on + when;
    case "joined": return who + " joined KURA's party" + on + when;
    case "climbed": return "KURA climbed" + (lv ? " to " + lv : "") + when;
    case "offering": return "KURA made an offering to the Moon" + on + when + (d.blessed === 1 ? " The Moon blessed one of her things." : "");
    case "leave": return "KURA climbed out of the pit, into open air" + when;
    case "end": {
      const how = d.end === "fell" ? "KURA fell" + on + (typeof d.killer === "string" && d.killer ? " to " + d.killer : "") : "The dark rose over KURA" + on;
      const more = [isInt(d.climbed) ? plural(d.climbed, "level", "levels") + " climbed" : null, isInt(d.demons) ? plural(d.demons, "demon", "demons") + " beaten" : null, isInt(d.turn) ? plural(d.turn, "turn", "turns") : null].filter(Boolean);
      return how + when + (more.length ? " " + more.join(", ") + "." : "");
    }
  }
  return null;
}
// marks naming copies (addMarks): one moment many copies share ({ copies, kind, value }, 4Dungeon v1.38), or several marks
// at once ({ marks: [{ kind, value, copies }] }, v1.39). Copies with the same marks share a sentence: "a scratched data
// disc #2 and a neon tube fragment #3 were found under a waxing gibbous moon and came from a demon; a cracked phone #2
// saw a demon fall, in irl-dungeon."
const were = (w) => w.replace(/^was /, "were ").replace(/^is /, "are ").replace(/^has /, "have ");
const shared = (r) => !!r && r.k === "mark" && (Array.isArray(r.copies) || Array.isArray(r.marks));
const andList = (xs) => xs.length > 1 ? xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1] : xs[0] || "";
// each copy once, with its marks and their numbers in order (e.items follows the copies as the record names them)
function copiesOf(e, r) {
  const out = new Map();
  let k = 0;
  for (const m of Array.isArray(r.marks) ? r.marks : [{ kind: r.kind, value: r.value, copies: r.copies }]) for (const c of (m && Array.isArray(m.copies) ? m.copies : [])) {
    const look = (e.items || [])[k++];
    if (!c) continue;
    const id = c.item + ":" + c.copy;
    if (!out.has(id)) out.set(id, { item: c.item, copy: c.copy, look, ns: [], marks: [] });
    out.get(id).ns.push(c.n); out.get(id).marks.push(m);
  }
  return [...out.values()];
}
// the copies grouped by their marks; the move's earliest marks first (its new finds), then by item and copy number,
// so the same things sit together
function groupsOf(e, r) {
  const by = new Map(), low = (cs) => Math.min(...cs.flatMap((c) => c.ns));
  for (const c of copiesOf(e, r)) { const k = c.marks.map((m) => m.kind + " " + m.value).join(","); if (!by.has(k)) by.set(k, []); by.get(k).push(c); }
  const order = (a, b) => a.item - b.item || a.copy - b.copy;
  return [...by.values()].map((cs) => cs.sort(order)).sort((a, b) => low(a) - low(b) || order(a[0], b[0]));
}
const copyName = (c) => (c.look ? nameOf(c.look) : "item " + c.item) + " #" + c.copy;
function groupWords(cs) {
  const hid = cs.some((c) => c.look && c.look.hidden);
  return " " + andList(cs[0].marks.map((m) => {
    const w = hid && /^(foil|pattern|effect)_/.test(m.value) ? "came with some kind of " + m.value.split("_")[0] : markWords(m);
    return w ? (cs.length > 1 ? were(w) : w) : "got a mark: " + m.value.replace(/_/g, " ");
  }));
}
// where it happened, as the end of a line: " in scoundrel.exe". A 4Dungeon line leaves it out (its heading says 4DUNGEON).
const inGame = (x, lead = " in ") => x === "4dungeon" ? "" : lead + g(x);
const thisCopy = (e, r) => one ? copiesOf(e, r).find((c) => String(c.item) === qs.get("item") && String(c.copy) === qs.get("copy")) : null;
// a mystery button's finish (foil_, pattern_, effect_) stays a mystery too: "came with some kind of foil"
function say(e, r) {
  if (!r) return "An entry this page can't read.";
  if (r.k === "run") return momentWords(r) || g(r.game) + " sealed a moment of a run.";
  if (shared(r)) return groupsOf(e, r).map((cs) => andList(cs.map(copyName)) + groupWords(cs)).join("; ") + inGame(r.game, ", in ") + ".";   // (row() writes it with links)
  if (r.k === "checkpoint") return lapWords(r) || farmWords(r) || runWords(r, typeof e.name === "string" && e.name ? e.name : "A Scoundrel") || g(r.game) + " sealed its ledger here.";   // the record's head is shown in the seal lines
  const what = (e.item ? nameOf(e.item) : "item " + r.item) + " #" + r.copy;
  if (r.k === "copy") return what + " came into the world" + inGame(r.game) + ".";
  if (r.k === "move") return r.from === r.to ? what + " changed hands" + inGame(r.to) + "." : what + " travelled from " + g(r.from) + " to " + g(r.to) + ".";
  if (r.k === "spend") return what + " was used up" + inGame(r.game) + ". It is gone.";
  if (r.k === "mark") { const w = e.item && e.item.hidden && /^(foil|pattern|effect)_/.test(r.value) ? "came with some kind of " + r.value.split("_")[0] : markWords(r); return w ? what + " " + w + inGame(r.game, ", in ") + "." : what + " got a mark" + inGame(r.game) + ": " + r.value.replace(/_/g, " ") + "."; }
  return "An entry this page doesn't know.";
}
const when = (t) => new Date(t * 1000).toLocaleString([], { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const qs = new URLSearchParams(location.search), one = qs.get("item") && qs.get("copy");
function el(tag, cls, text) { const x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; }
const nameOf = (i) => (i.hidden ? "a mystery button" : i.name);   // 88x31's rares and up (isMystery above)
function facts(i) {
  return [i.rarity, i.type ? i.type + " button" : null, i.alignment, i.nature, i.source ? "from " + g(i.source) : null].filter(Boolean).join(" · ");
}
// 4Dungeon's things get its black ASCII panel: a +====+ rule above and below, | down each side
const dun = (i) => !!i && i.source === "4dungeon";
function rule() { const d = el("div", "rule"); d.append(el("span", null, "+"), el("i", null, "=".repeat(300)), el("span", null, "+")); return d; }
function ascii(p) { p.classList.add("ascii"); p.prepend(rule()); p.append(rule()); return p; }
// the heading above the entry number: the game, then what happened, in that game's own words (88x31, irl-dungeon and
// scoundrel.exe lowercase; 4Dungeon in capitals, like its screen; Dawn Baton as a sentence). A move between games is headed by the
// game it went to ("arrive"). A game or kind missing here gets the plain words in ANY.
const ANY = { copy: "new copy", move: "copy changed hands", arrive: "copy arrived", spend: "copy used up", mark: "copy marked", marks: "copies marked", checkpoint: "checkpoint", run: "run" };
const HEAD = {
  "88x31": { copy: "new button", move: "button traveled", arrive: "button arrived", spend: "button gone", mark: "button marked" },
  "4dungeon": { copy: "ITEM FOUND", move: "ITEM CHANGED HANDS", arrive: "ITEM IN BAG", spend: "ITEM LEFT BAG", mark: "ITEM MARKED", marks: "ITEMS MARKED", checkpoint: "CHECKPOINT",
    run_enter: "INTO THE PIT", run_talked_down: "DEMON APPEASED", run_joined: "DEMON JOINED", run_climbed: "LEVEL CLIMBED", run_offering: "OFFERING", run_leave: "OUT OF THE PIT", run_end: "RUN OVER" },
  "irl-dungeon": { copy: "new find", move: "find changed hands", arrive: "find arrived", spend: "find used up", mark: "find marked" },
  "dawn-baton": { copy: "Baton made", move: "Baton changed hands", arrive: "Baton arrived", spend: "Baton used up", mark: "Baton marked", checkpoint: "Baton came home" },
  "aura-farm": { checkpoint: "farm finished" },
  "scoundrel": { checkpoint: (d) => d && d.status === "won" ? "run cleared" : d && Number.isInteger(d.score) ? "run deleted" : "run" },
};
const CAPS = { "4dungeon": "4DUNGEON" };
function heading(r) {
  if (!r) return null;
  const at = r.k === "move" ? r.to : r.game, k = r.k === "move" && r.from !== r.to ? "arrive" : shared(r) && copiesOf({}, r).length > 1 ? "marks" : r.k;
  let w = (HEAD[at] && (HEAD[at][k + "_" + r.moment] || HEAD[at][k])) || ANY[k];   // a run's moment has its own heading (run_enter ...)
  if (typeof w === "function") w = w(r.detail);
  if (!w) return null;
  if (CAPS[at] && w === ANY[k]) w = w.toUpperCase();
  return el("div", "h", (CAPS[at] || g(at)) + " \u00b7 " + w);
}
function row(e) {
  let r; try { r = JSON.parse(e.record); } catch { r = null; }
  const p = el("div", "panel");
  const cs = shared(r) ? copiesOf(e, r) : null, mine = cs ? (cs.length === 1 ? cs[0] : thisCopy(e, r)) : null;
  const ns = mine ? mine.ns.filter(Number.isInteger) : r && r.k === "mark" && Number.isInteger(r.n) ? [r.n] : [];
  const nw = ns.length === 1 ? "mark " + ns[0] : ns.every((n, i) => !i || n === ns[i - 1] + 1) ? "marks " + ns[0] + "\u2013" + ns[ns.length - 1] : "marks " + andList(ns.map(String));
  p.append(el("div", "top", "#" + e.id + " · " + when(e.at) + (ns.length ? " · " + nw + " on this copy" : "")));
  const s = el("div", "say"), lead = e.item || (e.items || []).find(Boolean);   // a shared mark wears its first thing's look
  const pic = e.item || (mine && mine.look);   // a mark on one copy (one or several marks) shows its picture too
  if (pic && pic.image) { const im = el("img"); im.src = pic.image; im.alt = pic.name; s.append(im); }
  if (dun(lead)) s.append("> ");
  if (shared(r)) {   // each thing links to its own story
    groupsOf(e, r).forEach((group, gi) => {
      if (gi) s.append("; ");
      group.forEach((c, k) => {
        if (k) s.append(k === group.length - 1 ? " and " : ", ");
        if (one) s.append(copyName(c)); else { const l = el("a", null, copyName(c)); l.href = "?item=" + c.item + "&copy=" + c.copy; s.append(l); }
      });
      s.append(groupWords(group));
    });
    s.append(inGame(r.game, ", in ") + ".");
  } else if (r && !one && Number.isInteger(r.item)) { const l = el("a", null, say(e, r)); l.href = "?item=" + r.item + "&copy=" + r.copy; s.append(l); } else s.append(say(e, r));
  let end = s; while (end.lastChild) end = end.lastChild;   // an entry ends without a period (min, Oct 20); its sentences inside keep theirs
  if (end.nodeType === 3) end.textContent = end.textContent.replace(/[.]$/, "");
  p.append(s);
  if (e.item && !one) { p.append(el("div", "facts", facts(e.item))); p.lastChild.classList.add("q-" + e.item.rarity); if (e.item.note) p.append(el("div", "note", "“" + e.item.note + "”")); }
  p.append(el("div", "seal", "record " + e.record + "\\nprev " + e.prev_hash + "\\nhash " + e.hash));
  p.lastChild.style.whiteSpace = "pre-wrap";
  const h = heading(r); if (h) p.prepend(h);
  // a game's checkpoint wears that game's own look: Dawn Baton's panel, scoundrel.exe's ASCII frame (the same as 4Dungeon's)
  const d = r && r.k === "checkpoint" && r.detail && typeof r.detail === "object" ? r.detail : null, int = (v) => Number.isInteger(v);
  if (r && r.k === "checkpoint" && r.game === "dawn-baton") {
    p.classList.add("baton"); p.prepend(el("div", "bar"));
    if (d && int(d.lap)) {   // under the sentence: the lap's 24 colours and its tune (s settle, l lean, - silent)
      const add = [];
      if (Array.isArray(d.colors) && d.colors.length) { const gr = el("div", "grad"); for (const c of d.colors) { const i = el("i"); if (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)) i.style.background = c; else i.className = "none"; gr.append(i); } add.push(gr); }
      if (typeof d.tune === "string" && d.tune.length) { const tn = el("div", "tune"); for (const ch of d.tune) tn.append(el("span", null, ch === "s" ? "\u266a" : ch === "l" ? "\u266d" : "\u00b7")); add.push(tn); }
      s.after(...add);
    }
    return p;
  }
  if (r && r.k === "checkpoint" && r.game === "scoundrel") {
    s.prepend("> ");
    if (d && int(d.score)) { s.classList.add("run"); if (d.status === "won") s.classList.add("won"); }   // the sentence wears the run's colour
    return ascii(p);
  }
  if (r && r.k === "run" && r.game === "4dungeon") { s.prepend("> "); return ascii(p); }   // a run's moment wears 4Dungeon's ASCII frame
  return dun(lead) ? ascii(p) : p;
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
  document.title = nameOf(i) + " #" + d.copy;
  $("#sub").textContent = "Everything that has happened to this copy, newest first.";
  if (dun(i)) { document.body.classList.add("dun"); $("#title").textContent = "= ITEM REGISTRY ="; }
  const c = el("div", "panel");
  const nm = el("div", "name", nameOf(i) + " #" + d.copy); c.append(nm);
  if (i.image) { const p = el("div"); p.style.textAlign = "center"; const im = el("img"); im.src = i.image; im.alt = i.name; im.style.cssText = "width:264px;height:93px;image-rendering:pixelated"; p.append(im); c.append(p); }
  c.append(el("div", "say", facts(i))); if (dun(i)) { c.lastChild.classList.add("q-" + i.rarity); c.lastChild.style.textTransform = "uppercase"; }
  if (i.note) c.append(el("div", "note", "\u201c" + i.note + "\u201d"));
  c.append(el("div", "facts", ["made in " + g(d.born_game) + " on " + when(d.born_at), d.moves + (d.moves === 1 ? " move" : " moves"), d.used_up ? "used up" : "still around"].join(" \u00b7 ")));
  if (i.source === "88x31" && !i.hidden) { const p = el("div", "say"); const a = el("a", null, "See this button's page on 88x31 \u00bb"); a.href = "https://88x31.app/api/registry/button?item=" + i.id + "&copy=" + d.copy; p.append(a); c.append(p); }
  $("#card").append(dun(i) ? ascii(c) : c);
  for (const e of d.entries) $("#list").append(row(e));
  const back = el("p"); back.style.textAlign = "center"; const a = el("a", null, "\u00ab The whole ledger"); a.href = location.pathname; back.append(a); $("#list").append(back);
}
$("#more").onclick = load;
one ? loadCopy() : load();
</script></body></html>`;
