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
<title>Stories</title><style>
:root{--bg:#faf8f4;--fg:#222;--dim:#777;--line:#ddd}
@media (prefers-color-scheme:dark){:root{--bg:#161616;--fg:#e8e6e1;--dim:#999;--line:#333}}
body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.65 Georgia,serif}
main{max-width:40rem;margin:0 auto;padding:2rem 16px 4rem}
h1{font-size:1.4rem}article{border-top:1px solid var(--line);padding-top:1.4rem;margin-top:2rem}
h2{font-size:1.2rem;margin:.2rem 0}.meta{color:var(--dim);font:14px system-ui,sans-serif}
p{margin:.9rem 0;white-space:pre-wrap}button{font:inherit;margin-top:2rem}
</style></head><body><main><h1>Stories from the servers</h1><div id="list"></div><button id="more" hidden>Older chapters</button></main>
<script>
var next=null,list=document.getElementById("list"),more=document.getElementById("more");
function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML}
function load(){fetch("/api/stories"+(next?"?before="+next:"")).then(function(r){return r.json()}).then(function(d){
 (d.stories||[]).forEach(function(s){var a=document.createElement("article");
  a.innerHTML='<div class="meta">Chapter '+s.chapter+" · "+esc(s.day)+" · "+esc(s.server)+"</div><h2>"+esc(s.title)+"</h2><p>"+esc(s.body)+"</p>";list.appendChild(a)});
 next=d.next;more.hidden=!next;if(!(d.stories||[]).length&&!list.children.length)list.textContent="No chapters yet."}).catch(function(){list.textContent="Couldn't load the stories."})}
more.onclick=load;load();
</script></body></html>`;
