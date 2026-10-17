// The registry over plain HTTP, for 88x31 (a Pages site, which reaches this Worker through an ordinary service binding,
// the same way it reaches the accounts: see ACCOUNTS.md). POST /rpc/registry/<method> with a JSON array of arguments and
// the header x-accounts-key (the ACCOUNTS_KEY secret, set the same on both). Without the key the route answers 404.
//
// This door belongs to one game: HTTP_GAME. Every call acts as that game, whatever the arguments say, so the key can only
// ever make, move, spend, add or retire what is that game's to touch. Other games use the Registry entrypoint (rpc.js).
import { birth, moveCopy, spendCopy, heldBy, whereIs, addItems, retireItems, itemIds } from "./registry.js";

const HTTP_GAME = "88x31";
const sameKey = (a, b) => a.length === b.length && [...a].reduce((x, c, i) => x | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;
const mine = (h) => !!h && h.game === HTTP_GAME;

const CALLS = {
  birth: (db, [a]) => birth(db, { ...a, game: HTTP_GAME }),
  // a move from one of this game's players (to anyone, in any game)
  moveCopy: (db, [a]) => (mine(a && a.from) ? moveCopy(db, a) : { error: "Only " + HTTP_GAME + " players' copies move from here." }),
  spendCopy: (db, [a]) => (mine(a && a.holder) ? spendCopy(db, a) : { error: "Only " + HTTP_GAME + " players' copies are spent from here." }),
  heldBy: (db, [playerId]) => heldBy(db, HTTP_GAME, playerId),
  // where one of this game's own copies is now (88x31 notices a button coming home); other games' copies aren't its to look up
  whereIs: async (db, [itemId, copy]) => {
    const it = await db.prepare("SELECT source FROM items WHERE id = ?").bind(itemId).first();
    return it && it.source === HTTP_GAME ? whereIs(db, itemId, copy) : null;
  },
  addItems: (db, [items]) => addItems(db, HTTP_GAME, items),
  retireItems: (db, [keys]) => retireItems(db, HTTP_GAME, keys),
  itemIds: (db, [keys]) => itemIds(db, HTTP_GAME, keys),
};

export async function registryCall(req, env) {
  const m = new URL(req.url).pathname.match(/^\/rpc\/registry\/([A-Za-z]+)$/);
  const key = req.headers.get("x-accounts-key") || "";
  if (!m || req.method !== "POST" || !env.ACCOUNTS_KEY || env.ACCOUNTS_KEY.length < 16 || !sameKey(key, env.ACCOUNTS_KEY) || !Object.hasOwn(CALLS, m[1])) return null;
  let args;
  try { args = await req.json(); if (!Array.isArray(args)) throw 0; } catch { return Response.json({ error: "Send a JSON array." }, { status: 400 }); }
  try {
    return Response.json((await CALLS[m[1]](env.DB, args)) ?? null, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: String((e && e.message) || "Something broke."), busy: /busy/.test(String(e && e.message)) }, { status: 503 });
  }
}
