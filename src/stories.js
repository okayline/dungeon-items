// Stories: the written chapters of what happens on the L4D servers (migration 008).
//   POST /rpc/stories/add    with  x-stories-key: <STORIES_KEY secret>  and a JSON array [{ day, server, map, title, body, facts }].
//                            The chapter number is the next one for that day, picked here, never by the caller. Without the key: 404.
//   GET  /api/stories        public, newest first. ?day=YYYY-MM-DD for one day, ?before=ID&limit=N (up to 50).
//   GET  /stories            the stories as a page.
// A chapter holds titles and character names only. Anything that looks like a Steam ID or an address is refused.
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
  try {
    const r = await db.prepare(
      `INSERT INTO stories (day, chapter, server, map, title, body, facts, created_at)
       VALUES (?, COALESCE((SELECT MAX(chapter) FROM stories WHERE day = ?), 0) + 1, ?, ?, ?, ?, ?, ?)`
    ).bind(day, day, server, map, title, body, facts, Math.floor(Date.now() / 1000)).run();
    const row = await db.prepare("SELECT id, chapter FROM stories WHERE id = last_insert_rowid()").first();
    return { ok: true, id: row && row.id, chapter: row && row.chapter, changes: r.meta && r.meta.changes };
  } catch (e) {
    return { error: /busy|UNIQUE/.test(String(e && e.message)) ? "Another chapter was saved at the same moment: try again." : String((e && e.message) || "Something broke.") };
  }
}

export async function storiesCall(req, env) {
  if (!/^\/rpc\/stories\/add$/.test(new URL(req.url).pathname)) return null;
  const key = req.headers.get("x-stories-key") || "";
  if (req.method !== "POST" || !env.STORIES_KEY || env.STORIES_KEY.length < 16 || !sameKey(key, env.STORIES_KEY)) return null;
  let args;
  try { args = await req.json(); if (!Array.isArray(args)) throw 0; } catch { return Response.json({ error: "Send a JSON array." }, { status: 400 }); }
  return Response.json(await addStory(env.DB, args[0]), { headers: { "cache-control": "no-store" } });
}

export async function listStories(db, params) {
  const day = params.get("day"), before = Number(params.get("before")) || 0;
  const limit = Math.min(Math.max(Number(params.get("limit")) || 20, 1), 50);
  const where = [], args = [];
  if (day) { if (!DAY.test(day)) return { error: "day is YYYY-MM-DD." }; where.push("day = ?"); args.push(day); }
  if (before > 0) { where.push("id < ?"); args.push(before); }
  const { results } = await db.prepare(
    `SELECT id, day, chapter, server, map, title, body, created_at FROM stories ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC LIMIT ?`
  ).bind(...args, limit).all();
  return { stories: results, next: results.length === limit ? results[results.length - 1].id : null };
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
p{margin:.9rem 0;white-space:pre-wrap}
a,button{color:#d9534a;background:none;border:0;font:inherit;cursor:pointer;padding:0;margin-top:1.6rem}
a:hover,button:hover{text-decoration:underline}
</style></head><body><header><div><h1>Tales from the Safe Room</h1><div class="sub">Stories from the past week</div></div></header><main><div id="list"></div><button id="more" hidden>&laquo; Older chapters</button></main>
<script>
var next=null,all=false,held=[],list=document.getElementById("list"),more=document.getElementById("more");
function ld(t){return new Date(t*1000).toLocaleDateString("en-CA")}   // the visitor's own date (YYYY-MM-DD)
var cutoff=ld(Date.now()/1000-7*864e2);   // a week ago, by the visitor's date
function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML}
function show(s){var a=document.createElement("article");
 a.innerHTML="<h2>"+esc(s.title)+'</h2><div class="meta">Chapter '+s.chapter+" &middot; "+ld(s.created_at)+" &middot; "+esc(s.server)+"</div><p>"+esc(s.body)+"</p>";list.appendChild(a)}
function done(){more.hidden=!(held.length||next);if(!list.children.length)list.textContent="No chapters this week."}
function load(){fetch("/api/stories"+(next?"?before="+next:"")).then(function(r){return r.json()}).then(function(d){
 var st=d.stories||[];next=d.next;
 st.forEach(function(s){if(all||ld(s.created_at)>=cutoff)show(s);else held.push(s)});
 done()}).catch(function(){list.textContent="Couldn't load the stories."})}
more.onclick=function(){all=true;held.splice(0).forEach(show);if(next)load();else done()};
load();
</script></body></html>`;
