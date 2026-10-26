// (Oct 26) THE CARRY WINDOW: one page, written once here, that every game shows on its own site as a window into the
// registry: every copy the player's account holds in any game, the one they carry on top, and a pin button on the rest.
// A game passes it through (Registry entrypoint carryWindow) for a player it has already signed in, so the window needs
// no login of its own. Inside: the registry's look, and each copy's card in its home game's look (the same looks the
// /ledger page gives checkpoints). Around it: the game's frame (a title and a few colours the game sends).
//   carryWindow(db, { game, playerId, frame?: { title, paper, ink, edge, accent, font }, pinUrl?, back?, ways? }) -> HTML string
// The pin button POSTs { itemId, copy } to pinUrl (the game's own pin route, default /api/pin) and reloads.
// (Oct 26) WAYS IN: with `ways` ({ player, codes, passkeys }, what the game's GET /api/account answers), the window also
// shows the shared account's save codes and passkeys, above the registry, and makes, removes and logs in with them through
// the game's own routes, which every game has the same: POST /api/codes, /api/passkey, /api/load, /api/logout.
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

// (Oct 26) THE HOST GAME'S LOOK: when a game has a theme here, the whole window (panels, buttons, cards, type) wears the look
// of the game it is opened from, after that game's own page (its index.html colours and fonts); each card keeps its home
// game's name as a tag. A game with no theme gets the registry's look, cards in their home games' looks.
const THEMES = {
  "aura-farm": `
body{background:radial-gradient(circle at 50% 0%,#2a1650 0%,#0b0a12 60%) fixed,#0b0a12;color:#f4f1ff;font:15px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.frame > h1{font-family:Impact,"Arial Black",sans-serif;letter-spacing:.5px;text-shadow:0 0 8px rgba(176,132,255,.6),0 0 16px rgba(255,111,207,.3);color:#f4f1ff}
.frame > p,.ways .small,.ways small{color:#c9b8ff}
.window,.ways,.card{background:#171226;border:1px solid #3a2f5c;border-radius:16px;color:#f4f1ff;font:inherit;box-shadow:none;outline:0}
.window,.ways{padding:14px}.card{border-left:1px solid #3a2f5c;border-right:1px solid #3a2f5c;border-top:1px solid #3a2f5c}
.window > .t,.ways > .t{font:20px Impact,"Arial Black",sans-serif;color:#f4f1ff;text-shadow:0 0 10px rgba(176,132,255,.75),0 0 24px rgba(176,132,255,.35)}
.card .h{color:#c9b8ff;font-family:inherit}.card .facts{color:#a99ccf;text-transform:none}.card b{text-transform:none;text-shadow:0 0 10px rgba(176,132,255,.5)}
.here{border-color:#ff6fcf;box-shadow:0 0 18px rgba(255,111,207,.45)}
button,.card button,.ways button{font:13px system-ui,sans-serif;color:#f4f1ff;background:#1b1530;border:1px solid #3a2f5c;border-radius:999px;padding:5px 12px}
.ways input{background:#1b1530;color:#f4f1ff;border:1px solid #3a2f5c;border-radius:999px;padding:5px 10px}#code{background:#1b1530;color:#ff6fcf;border-radius:12px}
.frame > a{color:#c9b8ff;font-size:12px}`,
  "scoundrel": `
@font-face{font-family:"VT323";src:url("/fonts/VT323-Regular.ttf") format("truetype");font-display:swap}
body{background:#07090a;color:#e4e4df;font:18px/1.2 "VT323",ui-monospace,monospace;font-variant-ligatures:none}
.frame > h1{font:28px "VT323",ui-monospace,monospace;color:#ffffff;text-transform:uppercase}
.frame > p,.ways .small,.ways small{color:#8f8f8a}
.window,.ways,.card{background:#07090a;color:#e4e4df;font:inherit;border:0;border-left:2px solid #8f8f8a;border-right:2px solid #8f8f8a;border-radius:0;box-shadow:none;outline:0}
.window,.ways{border-top:2px dashed #8f8f8a;border-bottom:2px dashed #8f8f8a;padding:10px 2ch}
.window > .t,.ways > .t{font:22px "VT323",ui-monospace,monospace;color:#e3b341;text-shadow:none;text-transform:uppercase}
.card{border-left-color:#4f5d52;border-right-color:#4f5d52}.card .h{color:#e3b341;font:inherit;font-size:15px}.card .facts{color:#8f8f8a;text-transform:uppercase}.card b{text-transform:uppercase;color:#ffffff}
.card .note{font-size:17px}.here{border-left-color:#e3b341;border-right-color:#e3b341}
button,.card button,.ways button{font:18px "VT323",ui-monospace,monospace;color:#e4e4df;background:none;border:0;padding:0 4px;text-transform:uppercase}
button:hover{background:#e4e4df;color:#07090a}button::before{content:"["}button::after{content:"]"}
.ways input{background:#07090a;color:#ffffff;border:0;border-bottom:2px solid #8f8f8a;font:18px "VT323",monospace}#code{background:#07090a;color:#e3b341;font:24px "VT323",monospace}
.frame > a{color:#e4e4df}`,
};

async function marksFor(db, list) {
  const by = new Map(list.map((c) => [c.itemId + ":" + c.copy, []]));
  if (!list.length) return by;
  const { results } = await db.prepare(`SELECT m.item_id, m.copy, m.kind, m.value FROM marks m
    JOIN json_each(?) j ON m.item_id = json_extract(j.value, '$[0]') AND m.copy = json_extract(j.value, '$[1]') ORDER BY m.n`)
    .bind(JSON.stringify(list.map((c) => [c.itemId, c.copy]))).all();
  for (const r of results) by.get(r.item_id + ":" + r.copy)?.push(r);
  return by;
}

function card(c, marks, images, themed) {
  const look = themed ? "" : LOOK[c.item.source] || "panel", blessed = marks.filter((m) => m.kind === "moon" && m.value === "blessed").length;
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

const day = (t) => (t ? new Date(t * 1000).toISOString().slice(0, 10) : "");
function waysPanel(w) {
  if (!w) return "";
  const rows = [...(w.codes || []).map((c) => `<div class="way"><span>🔑 Save code <small>made ${day(c.created_at)}${c.last_used_at ? " · last used " + day(c.last_used_at) : " · never used"}</small></span>
    <button type="button" data-forget="codes" data-id="${Number(c.id)}">forget</button></div>`),
    ...(w.passkeys || []).map((k) => `<div class="way"><span>👆 Passkey: ${esc(k.label || "passkey")} <small>${k.created_at ? "made " + day(k.created_at) : ""}</small></span>
    <button type="button" data-forget="passkey" data-id="${Number(k.id)}">remove</button></div>`)].join("");
  const has = (w.codes || []).length + (w.passkeys || []).length > 0;
  return `<div class="ways"><div class="t">Ways in</div>
<p class="small">A save code or passkey logs you in as this player anywhere, in every 88x31 game.</p>
${rows || `<p class="small">No save codes or passkeys yet.</p>`}
<div id="code" hidden></div>
<div class="row"><button type="button" id="newcode">🔑 New code</button><button type="button" id="addkey" data-pk>👆 Add passkey</button><button type="button" id="loadkey" data-pk>👆 Use passkey</button></div>
<div class="row"><input id="typed" placeholder="SAVE-CODE" autocomplete="off" spellcheck="false"><button type="button" id="loadcode">Log in</button></div>
${w.player && has ? `<div class="row"><button type="button" id="logout">log out of this browser</button></div>` : ""}
</div>`;
}

export async function carryWindow(db, { game, playerId, frame = {}, pinUrl, back, ways } = {}) {
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
  const cards = list.map((c) => card(c, by.get(c.itemId + ":" + c.copy) || [], images, !!THEMES[game])).join("\n");
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
@font-face{font-family:"VT323";src:url("/fonts/VT323-Regular.ttf") format("truetype"),url("https://dungeon.88x31.app/fonts/VT323-Regular.ttf") format("truetype");font-display:swap;size-adjust:130%}
.ascii{background:#07090a;color:#e4e4df;border-left:2px solid #8f8f8a;border-right:2px solid #8f8f8a;font:16px/1.2 "VT323",ui-monospace,monospace}
.ascii .h{color:#e3b341}.ascii .facts{text-transform:uppercase;color:#8f8f8a}.ascii b{text-transform:uppercase}
.baton{background:#1d1d63;border:2px solid #6c6cff;border-radius:6px;color:#f2f2ff;font:14px/1.35 "Trebuchet MS",Verdana,sans-serif;border-top:6px solid #ffb84d}.baton .h{color:#ffe066}
.aura{background:radial-gradient(circle at 50% 0%,#2a1650 0%,#171226 70%);border:1px solid #3a2f5c;border-radius:16px;box-shadow:0 0 18px rgba(176,132,255,.25);color:#f4f1ff;font:15px/1.35 system-ui,sans-serif}
.aura .h{font-family:Impact,"Arial Black",sans-serif;text-shadow:0 0 8px rgba(176,132,255,.6)}
.q-rare{color:#6aa6e8}.q-mythic,.q-relic,.q-ultra,.q-prototype{color:#f5c542}
.empty{text-align:center;opacity:.8}
.ways{border:4px ridge ${f.edge};background:#000080;color:#fff;padding:10px;margin-bottom:12px;font:15px/1.4 "Comic Sans MS","Comic Sans","Chalkboard SE",serif}
.ways > .t{color:#ffff00;text-shadow:2px 2px 0 #ff00ff;font:20px "Times New Roman",Times,serif;text-align:center}
.ways .small,.ways small{font-size:12px;color:#ff99ff}.ways .way{display:flex;justify-content:space-between;gap:8px;align-items:center;margin:6px 0}
.ways .row{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.ways button{font:bold 13px Arial,sans-serif;padding:3px 10px;cursor:pointer;color:#000;background:#c0c0c0;border:2px outset #fff}
.ways input{flex:1;min-width:0;font:14px "Courier New",monospace;padding:3px}#code{margin:8px 0;padding:8px;background:#000;color:#0f0;font:18px "Courier New",monospace;text-align:center;word-break:break-all}
${THEMES[game] || ""}
</style></head><body><div class="frame">
<h1>${f.title}</h1>
<p>The one on top goes with you into every game. Pick another to carry it instead.</p>
${waysPanel(ways)}
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
// ways in (only when the game sent them): the same calls every game's own account screen makes
var say = function (t) { document.getElementById("say").textContent = t; };
async function call(path, body) {
  var r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
  var j = await r.json().catch(function () { return {}; });
  if (!r.ok || j.error) throw new Error(j.error || "That didn't work. Try again.");
  return j;
}
var B = function (s) { var t = s.replace(/-/g, "+").replace(/_/g, "/"); return Uint8Array.from(atob(t + "===".slice((t.length + 3) % 4)), function (c) { return c.charCodeAt(0); }).buffer; };
var U = function (b) { return btoa(String.fromCharCode.apply(null, new Uint8Array(b))).replace(/[+]/g, "-").replace(/[/]/g, "_").replace(/=+$/, ""); };
var pkOops = function (e) { return new Error(e && e.name === "NotAllowedError" ? "Passkey cancelled (or it timed out)." : e && e.name === "InvalidStateError" ? "This device already has a passkey for you." : (e && e.message) || "The passkey didn't work."); };
function on(id, fn) { var b = document.getElementById(id); if (b) b.onclick = async function () { b.disabled = true; try { await fn(); } catch (e) { say(e.message); } b.disabled = false; }; }
if (!(window.PublicKeyCredential && navigator.credentials)) document.querySelectorAll("[data-pk]").forEach(function (b) { b.hidden = true; });
on("newcode", async function () { var j = await call("/api/codes", { action: "new" }); var c = document.getElementById("code"); c.hidden = false; c.textContent = j.code; say("Write it down or keep it in a password manager. It won't be shown again."); });
on("loadcode", async function () { var j = await call("/api/load", { code: document.getElementById("typed").value.trim() }); say("Logged in as " + (j.name || "your player") + "."); setTimeout(function () { location.reload(); }, 600); });
on("logout", async function () { await call("/api/logout", {}); location.reload(); });
on("addkey", async function () {
  try { var o = await call("/api/passkey", { action: "register_options" });
    var cr = await navigator.credentials.create({ publicKey: Object.assign({}, o, { challenge: B(o.challenge), user: Object.assign({}, o.user, { id: B(o.user.id) }),
      excludeCredentials: o.excludeCredentials.map(function (c) { return Object.assign({}, c, { id: B(c.id) }); }) }) });
    await call("/api/passkey", { action: "register", label: /iPhone/.test(navigator.userAgent) ? "iPhone" : /Android/.test(navigator.userAgent) ? "Android" : /Mac/.test(navigator.userAgent) ? "Mac" : /Windows/.test(navigator.userAgent) ? "Windows PC" : "this device",
      credential: { id: cr.id, response: { clientDataJSON: U(cr.response.clientDataJSON), attestationObject: U(cr.response.attestationObject) } } });
  } catch (e) { throw pkOops(e); }
  location.reload();
});
on("loadkey", async function () {
  try { var o = await call("/api/passkey", { action: "login_options" });
    var cr = await navigator.credentials.get({ publicKey: Object.assign({}, o, { challenge: B(o.challenge) }) });
    await call("/api/passkey", { action: "login", credential: { id: cr.id, response: { clientDataJSON: U(cr.response.clientDataJSON), authenticatorData: U(cr.response.authenticatorData), signature: U(cr.response.signature) } } });
  } catch (e) { throw pkOops(e); }
  location.reload();
});
document.querySelectorAll("[data-forget]").forEach(function (b) { b.onclick = async function () {
  if (!confirm(b.dataset.forget === "codes" ? "Forget this save code? It stops working everywhere." : "Remove this passkey? It stops working everywhere.")) return;
  try { await call("/api/" + b.dataset.forget, { action: "remove", id: Number(b.dataset.id) }); location.reload(); } catch (e) { say(e.message); }
}; });
</script></body></html>`;
}
