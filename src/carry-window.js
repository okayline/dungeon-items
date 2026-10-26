// (Oct 26) THE CARRY WINDOW: one page, written once here, that every game shows on its own site as a window into the
// registry: every copy the player's account holds in any game, the one they carry on top, and a pin button on the rest.
// A game passes it through (Registry entrypoint carryWindow) for a player it has already signed in, so the window needs
// no login of its own. Inside: the registry's look, and each copy's card in its home game's look (the same looks the
// /ledger page gives checkpoints). Around it: the game's frame (a title and a few colours the game sends).
//   carryWindow(db, { game, playerId, frame?: { title, paper, ink, edge, accent, font }, pinUrl?, back? }) -> HTML string
// The pin button POSTs { itemId, copy } to pinUrl (the game's own pin route, default /api/pin) and reloads.
import { heldAcross, pinned } from "./registry.js";
import { markWords } from "./mark-words.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const colour = (c, d) => (typeof c === "string" && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : d);
const font = (f, d) => (typeof f === "string" && /^[A-Za-z0-9 ,"'-]{1,120}$/.test(f) ? f : d);
const path = (u, d) => (typeof u === "string" && /^\/[A-Za-z0-9/_.?=&-]{0,100}$/.test(u) ? u : d);
// a copy's card wears its home game's look (the /ledger page's classes): 4Dungeon and scoundrel.exe the ASCII screen,
// Dawn Baton its navy panel, Aura Farm and Nano Pitch the purple glow, everything else the registry's own panel
const LOOK = { "4dungeon": "ascii", "scoundrel": "ascii", "dawn-baton": "baton", "aura-farm": "aura", "nano-pitch": "aura" };
const GAME_NAME = { "4dungeon": "4Dungeon", "88x31": "88x31", "irl-dungeon": "irl-dungeon", "dawn-baton": "Dawn Baton", "scoundrel": "scoundrel.exe",
  "aura-farm": "Aura Farm", "nano-pitch": "Nano Pitch", "moba-beat": "moba-beat", "tilt": "TILT.EXE", "clutch-feed-tilt": "TILT.EXE",
  "scatter-exe": "SCATTER.EXE", "triviamoba": "TriviaMoba" };

async function marksFor(db, list) {
  const by = new Map(list.map((c) => [c.itemId + ":" + c.copy, []]));
  if (!list.length) return by;
  const { results } = await db.prepare(`SELECT m.item_id, m.copy, m.kind, m.value FROM marks m
    JOIN json_each(?) j ON m.item_id = json_extract(j.value, '$[0]') AND m.copy = json_extract(j.value, '$[1]') ORDER BY m.n`)
    .bind(JSON.stringify(list.map((c) => [c.itemId, c.copy]))).all();
  for (const r of results) by.get(r.item_id + ":" + r.copy)?.push(r);
  return by;
}

function card(c, marks, images) {
  const look = LOOK[c.item.source] || "panel", blessed = marks.filter((m) => m.kind === "moon" && m.value === "blessed").length;
  const words = marks.map(markWords).filter(Boolean);
  const img = images.get(c.itemId);
  return `<div class="${look} card${c.carried ? " here" : ""}">
  <div class="h">${c.carried ? "CARRIED · " : ""}${esc(GAME_NAME[c.item.source] || c.item.source)}</div>
  <div class="say">${img ? `<img src="${esc(img)}" alt="">` : ""}<b class="q-${esc(c.item.rarity)}">${esc(c.item.name)} #${c.copy}</b>${blessed ? ` <span class="gold">blessed${blessed > 1 ? " ×" + blessed : ""}</span>` : ""}</div>
  <div class="facts">${esc(c.item.rarity)} · held in ${esc(GAME_NAME[c.game] || c.game)}</div>
  ${words.length ? `<div class="note">It ${esc(words.join(", "))}.</div>` : ""}
  ${c.carried ? "" : `<button type="button" data-item="${c.itemId}" data-copy="${c.copy}">carry this</button>`}
</div>`;
}

export async function carryWindow(db, { game, playerId, frame = {}, pinUrl, back } = {}) {
  // the carried one (the pin, else the newest) goes on top, even when nothing is pinned
  const [all, p] = await Promise.all([heldAcross(db, game, playerId, 50), pinned(db, game, playerId)]);
  const list = all.map((c) => ({ ...c, carried: !!p && c.itemId === p.itemId && c.copy === p.copy })).sort((a, b) => b.carried - a.carried);
  const by = await marksFor(db, list);
  const ids = [...new Set(list.map((c) => c.itemId))];
  const images = new Map();
  if (ids.length) {
    const { results } = await db.prepare(`SELECT id, image FROM items WHERE id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(ids)).all();
    for (const r of results) if (r.image) images.set(r.id, r.image);
  }
  const f = { title: esc(frame.title || "Carry"), paper: colour(frame.paper, "#000033"), ink: colour(frame.ink, "#ffffff"),
    edge: colour(frame.edge, "#c0c0c0"), accent: colour(frame.accent, "#ffff00"), font: font(frame.font, "system-ui, sans-serif") };
  const cards = list.map((c) => card(c, by.get(c.itemId + ":" + c.copy) || [], images)).join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${f.title}</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:${f.paper};color:${f.ink};font:15px/1.4 ${f.font}}
.frame{max-width:560px;margin:0 auto;padding:16px}
.frame > h1{margin:0 0 4px;font:inherit;font-size:22px;font-weight:bold;color:${f.accent};text-align:center}
.frame > p{margin:0 0 10px;text-align:center;font-size:13px;opacity:.8}
.frame > a{display:block;text-align:center;color:${f.accent};margin-top:12px}
/* the window: the registry's own sky and ridge, whatever the frame */
.window{border:4px ridge ${f.edge};background:#000033;color:#fff;padding:10px;font:15px/1.4 "Comic Sans MS","Comic Sans","Chalkboard SE",serif;max-height:70vh;overflow:auto}
.window > .t{text-align:center;color:#ffff00;text-shadow:2px 2px 0 #ff00ff;font:20px "Times New Roman",Times,serif;margin:0 0 8px}
.card{margin:10px 0;padding:10px;position:relative}
.card .h{font-size:11px;letter-spacing:.08em;font-weight:700;margin:0 0 4px}
.card .say img{float:left;width:88px;height:31px;margin:2px 10px 4px 0;image-rendering:pixelated}
.card .facts{clear:both;font-size:12px;opacity:.8}.card .note{font-size:13px;margin-top:4px}
.card button{display:block;margin:8px 0 0 auto;font:bold 13px Arial,sans-serif;padding:3px 10px;cursor:pointer;color:#000;background:#c0c0c0;border:2px outset #fff}
.gold{color:#e3b341}.here{outline:3px solid #ff6fcf;outline-offset:2px}
.panel{background:#000080;border:3px ridge #c0c0c0;color:#fff}.panel .h{color:#ffff00}.panel .facts{color:#ff99ff}
@font-face{font-family:"VT323";src:url("https://dungeon.88x31.app/fonts/VT323-Regular.ttf") format("truetype");font-display:swap;size-adjust:130%}
.ascii{background:#07090a;color:#e4e4df;border-left:2px solid #8f8f8a;border-right:2px solid #8f8f8a;font:16px/1.2 "VT323",ui-monospace,monospace}
.ascii .h{color:#e3b341}.ascii .facts{text-transform:uppercase;color:#8f8f8a}.ascii b{text-transform:uppercase}
.baton{background:#1d1d63;border:2px solid #6c6cff;border-radius:6px;color:#f2f2ff;font:14px/1.35 "Trebuchet MS",Verdana,sans-serif;border-top:6px solid #ffb84d}.baton .h{color:#ffe066}
.aura{background:radial-gradient(circle at 50% 0%,#2a1650 0%,#171226 70%);border:1px solid #3a2f5c;border-radius:16px;box-shadow:0 0 18px rgba(176,132,255,.25);color:#f4f1ff;font:15px/1.35 system-ui,sans-serif}
.aura .h{font-family:Impact,"Arial Black",sans-serif;text-shadow:0 0 8px rgba(176,132,255,.6)}
.q-rare{color:#6aa6e8}.q-mythic,.q-relic,.q-ultra,.q-prototype{color:#f5c542}
.empty{text-align:center;opacity:.8}
</style></head><body><div class="frame">
<h1>${f.title}</h1>
<p>The one on top goes with you into every game. Pick another to carry it instead.</p>
<div class="window"><div class="t">~*~ The Registry ~*~</div>
${cards || `<p class="empty">Nothing here yet. Things you find, win or make in any game show up here.</p>`}
</div>
<p id="say"></p>
${back ? `<a href="${esc(path(back, "/"))}">back</a>` : ""}
</div>
<script>
document.querySelectorAll("button[data-item]").forEach(function (b) { b.onclick = async function () {
  b.disabled = true;
  try {
    var r = await fetch(${JSON.stringify(path(pinUrl, "/api/pin"))}, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
      body: JSON.stringify({ itemId: Number(b.dataset.item), copy: Number(b.dataset.copy) }) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || j.error) { document.getElementById("say").textContent = j.error || "That didn't work. Try again."; b.disabled = false; return; }
    location.reload();
  } catch (e) { document.getElementById("say").textContent = "That didn't work. Try again."; b.disabled = false; }
}; });
</script></body></html>`;
}
