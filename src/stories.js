// Stories: the written chapters of what happens on the L4D servers (migration 008).
//   POST /rpc/stories/add    with  x-stories-key: <STORIES_KEY secret>  and a JSON array [{ day, server, map, title, body, facts }].
//                            The chapter number is the next one for that day, picked here, never by the caller. Without the key: 404.
//   GET  /api/stories        public, newest first. ?day=YYYY-MM-DD for one day, ?before=ID&limit=N (up to 50).
//                            ?id=ID for one chapter, ?map=MAP for one level's chapters, ?server=NAME for one server's.
//   GET  /stories            the stories as a page. /story/<id> (one chapter) and /map/<map> (every chapter of a level) /server/<name> (every chapter of a server) and /day/<YYYY-MM-DD> (a Hawaii day) are the same page.
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
  const day = params.get("day"), before = Number(params.get("before")) || 0, one = Number(params.get("id")) || 0, map = params.get("map"), server = params.get("server");
  const limit = Math.min(Math.max(Number(params.get("limit")) || 20, 1), 50);
  const where = [], args = [];
  if (day) { if (!DAY.test(day)) return { error: "day is YYYY-MM-DD." }; where.push("day = ?"); args.push(day); }
  if (before > 0) { where.push("id < ?"); args.push(before); }
  if (one > 0) { where.push("id = ?"); args.push(one); }
  if (map) { where.push("map = ?"); args.push(map); }
  if (server) { where.push("server = ?"); args.push(server); }
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
<title>Stories from the Safe Room</title><link rel="icon" type="image/png" sizes="32x32" href="data:image/png;base64,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"><link rel="apple-touch-icon" href="data:image/png;base64,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"><style>
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
a.t{color:inherit;margin:0}a.t:hover{color:#d9534a}
a,button{color:#d9534a;background:none;border:0;font:inherit;cursor:pointer;padding:0;margin-top:1.6rem}
a:hover,button:hover{text-decoration:underline}
</style></head><body><header><div><h1><a href="/" id="home" style="color:inherit;text-decoration:none;margin:0">Stories from the Safe Room</a></h1><div class="sub">tales from the past week on <span style="font-size:12px">~*~88x31~*~ cLuB</span> <span style="font-size:14px">l4d</span> servers</div></div></header><main><div id="list"></div><button id="more" hidden>&laquo; Older chapters</button></main>
<script>
var next=null,all=false,held=[],list=document.getElementById("list"),more=document.getElementById("more");
var path=location.pathname,pm=path.match(/^\\/(story|map|server|day)\\/([^\\/]+)$/),one=pm&&pm[1]==="story"?pm[2]:null,lvl=pm&&pm[1]==="map"?decodeURIComponent(pm[2]):null,srv=pm&&pm[1]==="server"?decodeURIComponent(pm[2]):null,dy=pm&&pm[1]==="day"?pm[2]:null;
if(location.hostname.indexOf("stories.")!==0)document.getElementById("home").href="/stories";
if(pm)all=true;   // a chapter or a level shows everything, not just the last week
function ld(t){return new Date(t*1000).toLocaleDateString("en-CA")}   // the visitor's own date (YYYY-MM-DD)
var cutoff=ld(Date.now()/1000-7*864e2);   // a week ago, by the visitor's date
function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML}
function pic(id,n){return '<img class="pic" src="/api/stories/picture/'+id+'/'+n+'" alt="" loading="lazy" onerror="this.remove()">'}   // a chapter with no pictures just shows none
function head(s){var m=s.title.match(/^(.+? #\\d+) from (.+?)(: .+)$/);   // "Tale #3 from The Apartments: Subtitle": the chapter and the level are links
 if(!m)return esc(s.title);return '<a class="t" href="/story/'+s.id+'">'+esc(m[1])+'</a> from <a class="t" href="/map/'+encodeURIComponent(s.map)+'">'+esc(m[2])+"</a>"+esc(m[3])}
function show(s){var a=document.createElement("article");
 a.innerHTML="<h2>"+head(s)+'</h2><div class="meta">Chapter '+s.chapter+" &middot; <a class=t href=/day/"+s.day+">"+ld(s.created_at)+"</a> &middot; <a class=t href=/server/"+encodeURIComponent(s.server)+">"+esc(s.server)+"</a></div>"+pic(s.id,1)+"<p>"+esc(s.body)+'</p><div class="pics">'+pic(s.id,2)+pic(s.id,3)+"</div>";list.appendChild(a);if(one)near(s)}
function near(s){fetch("/api/stories?limit=50&map="+encodeURIComponent(s.map)).then(function(r){return r.json()}).then(function(d){   // the chapters just before and after this one on the same level
 var l=(d.stories||[]).sort(function(x,y){return x.id-y.id}),i=l.findIndex(function(x){return x.id===s.id}),n=document.createElement("div"),h="";
 function lk(c,t){var m=c.title.match(/^(.+? #\\d+) from/);return '<a href="/story/'+c.id+'">'+t.replace("#",esc(m?m[1]:c.title))+"</a>"}
 if(i>0)h+=lk(l[i-1],"&laquo; #");if(i>0&&i<l.length-1)h+=" &nbsp; ";if(i>=0&&i<l.length-1)h+=lk(l[i+1],"# &raquo;");
 n.innerHTML=h;list.appendChild(n)}).catch(function(){})}
function done(){more.hidden=!(held.length||next);if(!list.children.length)list.textContent=pm?"No such chapter.":"No chapters this week."}
function load(){var q=one?"id="+one:lvl?"map="+encodeURIComponent(lvl):srv?"server="+encodeURIComponent(srv):dy?"day="+encodeURIComponent(dy):"";
 if(next)q+=(q?"&":"")+"before="+next;
 fetch("/api/stories"+(q?"?"+q:"")).then(function(r){return r.json()}).then(function(d){
 var st=d.stories||[];next=d.next;
 st.forEach(function(s){if(all||ld(s.created_at)>=cutoff)show(s);else held.push(s)});
 done()}).catch(function(){list.textContent="Couldn't load the stories."})}
more.textContent=pm?"\u00ab Older chapters":more.textContent;
more.onclick=function(){all=true;held.splice(0).forEach(show);if(next)load();else done()};
load();
</script></body></html>`;
