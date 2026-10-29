// Stories: the written chapters of what happens on the L4D servers (migration 008).
//   POST /rpc/stories/add    with  x-stories-key: <STORIES_KEY secret>  and a JSON array [{ day, server, map, title, body, facts }].
//                            The chapter number is the next one for that day, picked here, never by the caller. Without the key: 404.
//   GET  /api/stories        public, newest first. ?day=YYYY-MM-DD for one day, ?before=ID&limit=N (up to 50).
//   GET  /stories            the stories as a page.
//   POST /rpc/stories/seal   (same key) seals any chapter that is not on the ledger yet (the ones saved before sealing existed); safe to repeat.
//   POST /rpc/stories/picture-file?id=<id>&slot=<1-3> (same key) with a PNG or JPEG as the body saves that picture as is (one made elsewhere).
//   GET  /api/stories/picture/<id>/<1|2|3>   public, the picture itself (404 if the chapter has none).
// Every chapter is sealed on the registry's one ledger in the same D1 batch that saves it (kind "story", game "l4d", no player):
// the record holds the day, chapter, server, map and a SHA-256 fingerprint of the title and text, never the text itself.
// A chapter holds titles and character names only. Anything that looks like a Steam ID or an address is refused.
import { chainInsert, head, chainClash, isUnique, sha256 } from "./ledger.js";
const GAME = "l4d", TRIES = 5;
const sameKey = (a, b) => a.length === b.length && [...a].reduce((x, c, i) => x | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;
const PRIVATE = /STEAM_\d|\[U:\d|\b7656\d{13}\b|\b\d{1,3}(\.\d{1,3}){3}\b/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function addStory(db, a) {
  a = a || {};
  const day = String(a.day || ""), server = String(a.server || ""), map = String(a.map || ""), title = String(a.title || ""), body = String(a.body || "");
  const facts = a.facts == null ? null : typeof a.facts === "string" ? a.facts : JSON.stringify(a.facts);
  if (!DAY.test(day)) return { error: "day is YYYY-MM-DD (Hawaii date)." };
  if (!server || server.length > 40 || !map || !title || title.length > 200) return { error: "server, map and title are needed (title up to 200)." };
  if (!body || body.length > 20000) return { error: "body is needed (up to 20000)." };
  if ([title, body, facts || "", server, map].some((t) => PRIVATE.test(t))) return { error: "Looks like a Steam ID or an address: titles and character names only." };
  const fp = await sha256(title + "\n" + body);
  for (let i = 0; i < TRIES; i++) {
    const n = (await db.prepare("SELECT COALESCE(MAX(chapter), 0) + 1 AS n FROM stories WHERE day = ?").bind(day).first()).n;
    const record = JSON.stringify({ k: "story", game: GAME, day, chapter: n, server, map, hash: fp });
    const t = Math.floor(Date.now() / 1000);
    try {
      await db.batch([
        db.prepare("INSERT INTO stories (day, chapter, server, map, title, body, facts, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(day, n, server, map, title, body, facts, t),
        await chainInsert(db, await head(db), { kind: "story", game: GAME, playerId: 0, record, t }),
      ]);
      const row = await db.prepare("SELECT id FROM stories WHERE day = ? AND chapter = ?").bind(day, n).first();
      return { ok: true, id: row && row.id, chapter: n, sealed: true };
    } catch (e) {
      if (chainClash(e) || isUnique(e)) continue;   // someone else took the chapter number or the head: look again
      return { error: String((e && e.message) || "Something broke.") };
    }
  }
  return { error: "Another chapter was saved at the same moment: try again." };
}

// Seals every chapter that has no ledger entry yet (chapters saved before sealing existed). Safe to repeat.
export async function sealStories(db) {
  const { results } = await db.prepare(
    `SELECT id, day, chapter, server, map, title, body FROM stories s
     WHERE NOT EXISTS (SELECT 1 FROM ledger WHERE kind = 'story' AND json_extract(record, '$.day') = s.day AND json_extract(record, '$.chapter') = s.chapter) ORDER BY id`
  ).all();
  let sealed = 0;
  for (const r of results) {
    const record = JSON.stringify({ k: "story", game: GAME, day: r.day, chapter: r.chapter, server: r.server, map: r.map, hash: await sha256(r.title + "\n" + r.body) });
    for (let i = 0; i < TRIES; i++) {
      try { await db.batch([await chainInsert(db, await head(db), { kind: "story", game: GAME, playerId: 0, record, t: Math.floor(Date.now() / 1000) })]); sealed++; break; }
      catch (e) { if (!chainClash(e)) throw e; }
    }
  }
  return { ok: true, sealed };
}

// Pictures: 3 per chapter, made elsewhere and uploaded, kept in R2 (never in D1) as story-<id>/1, /2, /3.
const imageType = (b) => b[0] === 0x89 && b[1] === 0x50 ? "image/png" : b[0] === 0xff && b[1] === 0xd8 ? "image/jpeg" : null;

// A picture made somewhere else (the owner's playground), saved as is into a slot: POST /rpc/stories/picture-file?id=<chapter id>&slot=<1-3>
// with the image as the body (PNG or JPEG, up to 5 MB). Replaces what the slot held.
export async function uploadPicture(env, params, buf) {
  const id = Number(params.get("id")), slot = Number(params.get("slot")), bytes = new Uint8Array(buf), type = imageType(bytes);
  if (!Number.isInteger(id) || id < 1 || ![1, 2, 3].includes(slot)) return { error: "id and slot (1 to 3) are needed." };
  if (!type || bytes.length > 5e6) return { error: "Send a PNG or JPEG up to 5 MB as the body." };
  if (!env.PICTURES) return { error: "Pictures are not set up." };
  if (!(await env.DB.prepare("SELECT 1 FROM stories WHERE id = ?").bind(id).first())) return { error: "No such chapter." };
  await env.PICTURES.put(`story-${id}/${slot}`, bytes, { httpMetadata: { contentType: type }, customMetadata: { prompt: "(made in the Cloudflare playground, uploaded by the owner)", model: String(params.get("model") || "upload").slice(0, 40) } });
  return { ok: true, id, slot, bytes: bytes.length };
}

export async function servePicture(env, pathname) {
  const m = pathname.match(/^\/api\/stories\/picture\/(\d{1,9})\/([123])$/);
  if (!m || !env.PICTURES) return null;
  const o = await env.PICTURES.get(`story-${m[1]}/${m[2]}`);
  return o ? new Response(o.body, { headers: { "content-type": (o.httpMetadata && o.httpMetadata.contentType) || "image/png", "cache-control": "public, max-age=300" } }) : null;
}

export async function storiesCall(req, env) {
  const m = new URL(req.url).pathname.match(/^\/rpc\/stories\/(add|seal|picture-file)$/);
  if (!m) return null;
  const key = req.headers.get("x-stories-key") || "";
  if (req.method !== "POST" || !env.STORIES_KEY || env.STORIES_KEY.length < 16 || !sameKey(key, env.STORIES_KEY)) return null;
  if (m[1] === "picture-file") return Response.json(await uploadPicture(env, new URL(req.url).searchParams, await req.arrayBuffer()), { headers: { "cache-control": "no-store" } });
  let args;
  try { args = await req.json(); if (!Array.isArray(args)) throw 0; } catch { return Response.json({ error: "Send a JSON array." }, { status: 400 }); }
  return Response.json(m[1] === "seal" ? await sealStories(env.DB) : await addStory(env.DB, args[0]), { headers: { "cache-control": "no-store" } });
}

export async function listStories(db, params) {
  const day = params.get("day"), before = Number(params.get("before")) || 0;
  const limit = Math.min(Math.max(Number(params.get("limit")) || 20, 1), 50);
  const where = [], args = [];
  if (day) { if (!DAY.test(day)) return { error: "day is YYYY-MM-DD." }; where.push("day = ?"); args.push(day); }
  if (before > 0) { where.push("id < ?"); args.push(before); }
  const { results } = await db.prepare(
    // series: the stored number, or for older chapters (saved before the column) their place among the same map's chapters
    `SELECT id, day, chapter, server, map, title, body, created_at, series FROM (
       SELECT id, day, chapter, server, map, title, body, created_at,
              COALESCE(series, ROW_NUMBER() OVER (PARTITION BY map ORDER BY created_at, id)) AS series FROM stories
     ) ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC LIMIT ?`
  ).bind(...args, limit).all();
  return { stories: results, next: results.length === limit ? results[results.length - 1].id : null };
}

// What happened in the world, for the games to stamp on the copies they make (a `night` mark, like the moon): the
// events in the chapters of today and yesterday (Hawaii dates). Read from the chapters' facts ("killed the tank with ...").
// -> { events: ["tank_fell", "witch_fell"] }, only the ones that happened, in that order. No chapter text, no players.
const WORLD = [["tank_fell", "%killed the tank%"], ["witch_fell", "%killed the witch%"]];
const hawaii = (ms) => new Date(ms - 10 * 3600 * 1000).toISOString().slice(0, 10);
export async function worldEvents(db, nowMs = Date.now()) {
  const days = [hawaii(nowMs), hawaii(nowMs - 86400000)], events = [];
  for (const [id, like] of WORLD) {
    const row = await db.prepare("SELECT 1 AS hit FROM stories WHERE day IN (?, ?) AND facts LIKE ? LIMIT 1").bind(days[0], days[1], like).first();
    if (row) events.push(id);
  }
  return { events };
}

export const STORIES_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tales from the Safe Room</title><style>
:root{--bg:#0e0d0d;--fg:#dcd6cf;--dim:#8d857c;--line:#3a2a28;--red:#b3261e}
body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.75 "Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua","Hoefler Text",Georgia,serif;text-wrap:pretty}
header{border-bottom:3px solid var(--red);background:#151212}
header>div{max-width:42rem;margin:0 auto;padding:1.6rem 16px}
h1{font:400 1.8rem/1.2 "Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua","Hoefler Text",Georgia,serif;letter-spacing:.14em;text-transform:uppercase;margin:0}
.sub{color:var(--dim);font:italic 15px "Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua","Hoefler Text",Georgia,serif;margin-top:.3rem}
main{max-width:42rem;margin:0 auto;padding:1rem 16px 4rem}
article{padding:1.6rem 0 .4rem}
article+article:before,.rule{content:"";display:block;height:2px;margin:0 0 1.6rem;background:linear-gradient(90deg,var(--red),transparent)}
h2{font:italic 400 1.6rem/1.3 "Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua","Hoefler Text",Georgia,serif;margin:0 0 .3rem;color:#f0e9e1}
.meta{color:var(--dim);font:13px "Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua","Hoefler Text",Georgia,serif;letter-spacing:.08em;text-transform:uppercase;margin-bottom:1rem}
p{margin:.9rem 0;padding:0 8rem 0 3.5rem;white-space:pre-wrap}
.meta+p{margin-top:1.9rem}
.pic{display:block;width:100%;height:auto;margin:1rem 0;border:1px solid var(--line)}
.pics{display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin:1.2rem 0}.pics:empty{display:none}.pics .pic{margin:0}
@media (max-width:640px){p{padding:0 2rem 0 1rem}}
a,button{color:#d9534a;background:none;border:0;font:inherit;cursor:pointer;padding:0;margin-top:1.6rem}
a:hover,button:hover{text-decoration:underline}
</style></head><body><header><div><h1>Tales from the Safe Room</h1><div class="sub">stories from the past week on <span style="font-size:12px">~*~88x31~*~ cLuB</span> <span style="font-size:14px">l4d</span> servers</div></div></header><main><div id="list"></div><button id="more" hidden>&laquo; Older chapters</button></main>
<script>
var next=null,all=false,held=[],list=document.getElementById("list"),more=document.getElementById("more");
function ld(t){return new Date(t*1000).toLocaleDateString("en-CA")}   // the visitor's own date (YYYY-MM-DD)
var cutoff=ld(Date.now()/1000-7*864e2);   // a week ago, by the visitor's date
function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML}
function pic(id,n){return '<img class="pic" src="/api/stories/picture/'+id+'/'+n+'" alt="" loading="lazy" onerror="this.remove()">'}   // a chapter with no pictures just shows none
function show(s){var a=document.createElement("article");
 a.innerHTML="<h2>"+esc(s.title)+'</h2><div class="meta">Chapter '+s.chapter+(s.series?" &middot; Series #"+s.series:"")+" &middot; "+ld(s.created_at)+" &middot; "+esc(s.server)+"</div>"+pic(s.id,1)+"<p>"+esc(s.body)+'</p><div class="pics">'+pic(s.id,2)+pic(s.id,3)+"</div>";list.appendChild(a)}
function done(){more.hidden=!(held.length||next);if(!list.children.length)list.textContent="No chapters this week."}
function load(){fetch("/api/stories"+(next?"?before="+next:"")).then(function(r){return r.json()}).then(function(d){
 var st=d.stories||[];next=d.next;
 st.forEach(function(s){if(all||ld(s.created_at)>=cutoff)show(s);else held.push(s)});
 done()}).catch(function(){list.textContent="Couldn't load the stories."})}
more.onclick=function(){all=true;held.splice(0).forEach(show);if(next)load();else done()};
load();
</script></body></html>`;
