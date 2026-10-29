// dungeon-items: the read side of the one item table. Games ask; nothing here writes (items are added by seed/sync
// scripts run by the owner). Public, GET only.
//   GET /api/items            active items. ?source= ?rarity= filter; ?all=1 includes retired ones.
//   GET /api/items/:id        one item by id (retired ones too, so an old find still resolves).
//   GET /api/registry/head    the registry ledger's newest hash and entry count, for the outside anchor (88x31-anchors).
//                             Counts and a hash only: no holders, no copies listed.
//   GET /api/registry/ledger  the registry ledger itself, newest first (?before=ID&limit=N, up to 100); no player ids.
//   GET /api/registry/copy    one copy's story: ?item=ID&copy=N, its item and every ledger entry about it, newest first.
//   GET /api/stories          the written chapters, newest first (?day= ?before= ?limit=); POST /rpc/stories/add saves one (STORIES_KEY).
//   GET /stories              the chapters as a page (/story/<id>, /map/<map> and /server/<name> and /day/<date> are the same page); on a stories.* host the main page (/) is the same page.
//   GET /ledger               the ledger as a page; /ledger?item=ID&copy=N shows one copy.
//   GET /footer.js            the footer every game shows: "© ~*~88x31~*~ cLuB, year · ≡ version"; ≡ pops up the game's own carry window (src/footer.js).
import { httpCall } from "./accounts.js";
import { registryCall } from "./registry-http.js";
import { storiesCall, listStories, servePicture, STORIES_PAGE } from "./stories.js";
import { FOOTER_JS } from "./footer.js";
import { verify } from "./registry.js";
import { publicLedger, copyHistory, LEDGER_PAGE, isMystery, mysteryItem } from "./public-ledger.js";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "if-none-match" };
const RARITIES = ["common", "uncommon", "rare", "prototype", "relic", "ultra", "moon", "mythic"];
const shape = (r) => (isMystery(r) ? { id: r.id, ...mysteryItem(r), retired: !!r.retired } : {
  id: r.id, source: r.source, source_key: r.source_key, rarity: r.rarity, name: r.name, note: r.note,
  alignment: r.alignment, nature: r.nature, type: r.type, image: r.image, extra: JSON.parse(r.extra || "{}"),
  retired: !!r.retired, updated_at: r.updated_at,
});
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...CORS, ...extra } });

async function etagOf(text) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return '"' + [...d.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("") + '"';
}
async function cached(req, data) {
  const body = JSON.stringify(data), tag = await etagOf(body), h = { etag: tag, "cache-control": "public, max-age=300" };
  if (req.headers.get("if-none-match") === tag) return new Response(null, { status: 304, headers: { ...CORS, ...h } });
  return new Response(body, { status: 200, headers: { "content-type": "application/json", ...CORS, ...h } });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/rpc/accounts/")) return (await httpCall(req, env)) || json({ error: "Not found." }, 404);
    if (url.pathname.startsWith("/rpc/registry/")) return (await registryCall(req, env)) || json({ error: "Not found." }, 404);
    if (url.pathname.startsWith("/rpc/stories/")) return (await storiesCall(req, env)) || json({ error: "Not found." }, 404);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (req.method !== "GET") return json({ error: "Read only." }, 405, { allow: "GET, OPTIONS" });
    if (url.pathname === "/api/items") {
      const where = [], args = [];
      const source = url.searchParams.get("source"), rarity = url.searchParams.get("rarity");
      if (rarity !== null && !RARITIES.includes(rarity)) return json({ error: "rarity is one of " + RARITIES.join(", ") + "." }, 400);
      if (source !== null) { where.push("source = ?"); args.push(source); }
      if (rarity !== null) { where.push("rarity = ?"); args.push(rarity); }
      if (url.searchParams.get("all") !== "1") where.push("retired = 0");
      const { results } = await env.DB.prepare(`SELECT * FROM items ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id`).bind(...args).all();
      return cached(req, { items: results.map(shape) });
    }
    if (url.pathname === "/api/registry/head") {
      const v = await verify(env.DB), copies = (await env.DB.prepare("SELECT COUNT(*) AS n FROM copies").first()).n;
      return json(v.ok ? { ok: true, entries: v.count, head: v.head, copies } : { ok: false, broken_at: v.at }, 200, { "cache-control": "public, max-age=300" });
    }
    if (url.pathname === "/api/registry/ledger") return json(await publicLedger(env.DB, url.searchParams), 200, { "cache-control": "public, max-age=60" });
    if (url.pathname === "/api/registry/copy") {
      const c = await copyHistory(env.DB, url.searchParams);
      return c ? json(c, 200, { "cache-control": "public, max-age=60" }) : json({ error: "No such copy." }, 404);
    }
    if (url.pathname.startsWith("/api/stories/picture/")) return (await servePicture(env, url.pathname)) || json({ error: "No such picture." }, 404);
    if (url.pathname === "/api/stories") { const r = await listStories(env.DB, url.searchParams); return r.error ? json(r, 400) : json(r, 200, { "cache-control": "public, max-age=60" }); }
    if (url.pathname === "/stories" || /^\/(story\/\d{1,9}|(map|server)\/[\w.-]{1,80}|day\/\d{4}-\d{2}-\d{2})$/.test(url.pathname) || (url.pathname === "/" && url.hostname.startsWith("stories."))) return new Response(STORIES_PAGE, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
    if (url.pathname === "/footer.js") return new Response(FOOTER_JS, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=300" } });
    if (url.pathname === "/ledger") return new Response(LEDGER_PAGE, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
    const m = url.pathname.match(/^\/api\/items\/(\d{1,12})$/);
    if (m) {
      const row = await env.DB.prepare("SELECT * FROM items WHERE id = ?").bind(Number(m[1])).first();
      return row ? cached(req, shape(row)) : json({ error: "No such item." }, 404);
    }
    return json({ error: "Not found." }, 404);
  },
};
