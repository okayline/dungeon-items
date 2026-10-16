import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../src/worker.js";
import { extract } from "../src/extract.js";
import { seedSql } from "../src/seed.js";
import { fakeD1 } from "./helpers.mjs";

const seeded = () => { const DB = fakeD1(); DB.raw.exec(seedSql(JSON.parse(readFileSync(new URL("../seed/4dungeon.json", import.meta.url), "utf8")), 1000)); return { DB }; };
const get = async (env, path, headers = {}) => { const r = await worker.fetch(new Request("https://items.example" + path, { headers }), env); let data = null; try { data = await r.json(); } catch {} return { status: r.status, data, headers: r.headers }; };
const sql = (env, q, ...a) => env.DB.raw.prepare(q).all(...a);
const fails = (env, q, ...a) => assert.throws(() => env.DB.raw.prepare(q).run(...a));

test("the seed holds 4Dungeon's 46 items: 12 common, 12 uncommon, 12 rare, 6 mythic, 4 moon", () => {
  const env = seeded();
  const n = Object.fromEntries(sql(env, "SELECT rarity, COUNT(*) AS n FROM items GROUP BY rarity").map((r) => [r.rarity, r.n]));
  assert.deepEqual(n, { common: 12, uncommon: 12, rare: 12, mythic: 6, moon: 4 });
  assert.equal(sql(env, "SELECT COUNT(*) AS n FROM items")[0].n, 46);
});

test("seeded ids run 1..46 in 4Dungeon's order, and a spot-check matches rules.js by hand", () => {
  const env = seeded();
  assert.deepEqual(sql(env, "SELECT id FROM items ORDER BY id").map((r) => r.id), Array.from({ length: 46 }, (_, i) => i + 1));
  const r = sql(env, "SELECT * FROM items WHERE id = 5")[0];
  assert.equal(r.name, "a burned-out circuit board"); assert.equal(r.rarity, "common"); assert.equal(r.alignment, "NEUTRAL");
  assert.equal(r.nature, "both"); assert.equal(JSON.parse(r.extra).both_name, "STRAY STATIC");
  const k = sql(env, "SELECT * FROM items WHERE name = 'a vial of medicine'")[0];
  assert.equal(k.note, "Heals everyone by a third."); assert.deepEqual(JSON.parse(k.extra), { has_use: true, use_text: "The party breathes easier." });
  assert.equal(sql(env, "SELECT rarity FROM items WHERE name = 'a moonstone'")[0].rarity, "moon");
});

test("seeding twice adds nothing and does not overwrite an edited item", () => {
  const env = seeded();
  env.DB.raw.exec("UPDATE items SET note = 'edited here' WHERE id = 1");
  env.DB.raw.exec(seedSql(JSON.parse(readFileSync(new URL("../seed/4dungeon.json", import.meta.url), "utf8")), 2000));
  assert.equal(sql(env, "SELECT COUNT(*) AS n FROM items")[0].n, 46);
  assert.equal(sql(env, "SELECT note FROM items WHERE id = 1")[0].note, "edited here");
});

test("seed values with quotes survive", () => {
  const env = { DB: fakeD1() };
  env.DB.raw.exec(seedSql([{ source: "t", source_key: "1", rarity: "common", name: "a saint's medal", note: "it's \"fine\"", extra: {} }], 5));
  assert.deepEqual(sql(env, "SELECT name, note FROM items").map((r) => [r.name, r.note]), [["a saint's medal", "it's \"fine\""]]);
});

test("the extractor reads rules.js and refuses an item with no alignment", () => {
  const src = 'const CATALOG = { COMMON: [["a rock","hard"]], UNCOMMON: [], RARE: [], MYTHIC: [], MOON: [] };\nconst ITEM_ALIGN = {};\nconst ITEM_NATURE = {};\nconst BOTH_NAME = {};';
  assert.throws(() => extract(src), /no alignment/);
  const ok = src.replace("ITEM_ALIGN = {}", 'ITEM_ALIGN = {"a rock":"LAW"}').replace("ITEM_NATURE = {}", 'ITEM_NATURE = {"a rock":"tech"}');
  assert.deepEqual(extract(ok), [{ source: "4dungeon", source_key: "COMMON:0", rarity: "common", name: "a rock", note: "hard", alignment: "LAW", nature: "tech", extra: {} }]);
});

test("items are never deleted", () => {
  const env = seeded();
  fails(env, "DELETE FROM items WHERE id = 1"); fails(env, "DELETE FROM items");
  assert.equal(sql(env, "SELECT COUNT(*) AS n FROM items")[0].n, 46);
});

test("an item's identity never changes: id, source, key, rarity, created_at", () => {
  const env = seeded();
  for (const set of ["id = 999", "source = 'x'", "source_key = 'x'", "rarity = 'moon'", "created_at = 5"]) fails(env, `UPDATE items SET ${set} WHERE id = 1`);
  const r = sql(env, "SELECT id, source, source_key, rarity, created_at FROM items WHERE id = 1")[0];
  assert.deepEqual({ ...r }, { id: 1, source: "4dungeon", source_key: "COMMON:0", rarity: "common", created_at: 1000 });
});

test("text can be edited and updated_at moves; retiring is a flag, not a removal", () => {
  const env = seeded();
  env.DB.raw.exec("UPDATE items SET note = 'new words', retired = 1 WHERE id = 2");
  const r = sql(env, "SELECT note, retired, updated_at FROM items WHERE id = 2")[0];
  assert.equal(r.note, "new words"); assert.equal(r.retired, 1); assert.ok(r.updated_at > 1000);
});

test("ids are never reused, even after the newest item is retired", () => {
  const env = seeded();
  env.DB.raw.exec("UPDATE items SET retired = 1 WHERE id = 46");
  env.DB.raw.exec(seedSql([{ source: "irl-dungeon", source_key: "a", rarity: "common", name: "new", extra: {} }], 5));
  assert.equal(sql(env, "SELECT id FROM items WHERE source = 'irl-dungeon'")[0].id, 47);
});

test("the table refuses bad values: rarity, alignment, nature, duplicate source key, bad JSON, empty name", () => {
  const env = seeded();
  const ins = (o) => { const v = { source: "t", source_key: "k" + Math.random(), rarity: "common", name: "n", alignment: null, nature: null, extra: "{}", ...o };
    env.DB.raw.prepare("INSERT INTO items (source, source_key, rarity, name, alignment, nature, extra, created_at, updated_at) VALUES (?,?,?,?,?,?,?,1,1)").run(v.source, v.source_key, v.rarity, v.name, v.alignment, v.nature, v.extra); };
  ins({});
  assert.throws(() => ins({ rarity: "legendary" })); assert.throws(() => ins({ alignment: "GOOD" })); assert.throws(() => ins({ nature: "ghost" }));
  assert.throws(() => ins({ extra: "{nope" })); assert.throws(() => ins({ name: "" }));
  assert.throws(() => ins({ source: "4dungeon", source_key: "COMMON:0" }));
});

test("GET /api/items lists active items in id order, with extra parsed", async () => {
  const env = seeded();
  env.DB.raw.exec("UPDATE items SET retired = 1 WHERE id = 3");
  const { status, data, headers } = await get(env, "/api/items");
  assert.equal(status, 200); assert.equal(headers.get("access-control-allow-origin"), "*");
  assert.equal(data.items.length, 45); assert.ok(!data.items.some((i) => i.id === 3));
  assert.deepEqual(data.items.map((i) => i.id), sql(env, "SELECT id FROM items WHERE retired = 0 ORDER BY id").map((r) => r.id));
  assert.deepEqual(data.items.find((i) => i.id === 13).extra, { has_use: true, use_text: "The party breathes easier." });
  assert.equal((await get(env, "/api/items?all=1")).data.items.length, 46);
});

test("filters by source and rarity; a bad rarity is refused", async () => {
  const env = seeded();
  assert.deepEqual((await get(env, "/api/items?rarity=moon")).data.items.map((i) => i.name), ["a moonstone", "a shard of pale moonlight", "a fang still warm", "a silver-veined horn"]);
  assert.equal((await get(env, "/api/items?source=4dungeon&rarity=mythic")).data.items.length, 6);
  assert.equal((await get(env, "/api/items?source=88x31")).data.items.length, 0);
  assert.equal((await get(env, "/api/items?rarity=legendary")).status, 400);
});

test("one item by id, a retired one still resolves, an unknown one is 404", async () => {
  const env = seeded();
  env.DB.raw.exec("UPDATE items SET retired = 1 WHERE id = 4");
  const r = await get(env, "/api/items/4");
  assert.equal(r.status, 200); assert.equal(r.data.name, "a subway token"); assert.equal(r.data.retired, true);
  assert.equal((await get(env, "/api/items/9999")).status, 404); assert.equal((await get(env, "/api/items/abc")).status, 404);
});

test("ETag: the same list answers 304 to If-None-Match, a changed list does not", async () => {
  const env = seeded();
  const a = await get(env, "/api/items"), tag = a.headers.get("etag");
  assert.ok(tag);
  assert.equal((await get(env, "/api/items", { "if-none-match": tag })).status, 304);
  env.DB.raw.exec("UPDATE items SET note = 'changed' WHERE id = 1");
  assert.equal((await get(env, "/api/items", { "if-none-match": tag })).status, 200);
});

test("read only: POST, PUT and DELETE are refused and change nothing; OPTIONS works for the itch.io page", async () => {
  const env = seeded();
  for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
    const r = await worker.fetch(new Request("https://items.example/api/items", { method, body: method === "DELETE" ? undefined : "{}" }), env);
    assert.equal(r.status, 405);
  }
  assert.equal(sql(env, "SELECT COUNT(*) AS n FROM items")[0].n, 46);
  const o = await worker.fetch(new Request("https://items.example/api/items", { method: "OPTIONS" }), env);
  assert.equal(o.status, 204); assert.equal(o.headers.get("access-control-allow-origin"), "*");
});

test("the committed seed matches 4Dungeon's rules.js", { skip: !process.env.RULES_JS && !(await import("node:fs")).existsSync("../daily-dungeon/rules.js") }, () => {
  const live = extract(readFileSync(process.env.RULES_JS || "../daily-dungeon/rules.js", "utf8"));
  assert.deepEqual(JSON.parse(readFileSync(new URL("../seed/4dungeon.json", import.meta.url), "utf8")), live);
});
