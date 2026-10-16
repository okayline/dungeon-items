import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fromApi } from "../src/buttons.js";
import { seedSql } from "../src/seed.js";
import { fakeD1 } from "./helpers.mjs";

const d = (id, o = {}) => ({ id, name: "b" + id, type: "neon", rarity: "common", status: "active", max_editions: null, tier: "original", ...o });

test("only original, uncapped, active, visible commons and uncommons become items", () => {
  const out = fromApi([
    d(1), d(2, { rarity: "uncommon" }),
    d(3, { rarity: "rare" }), d(4, { rarity: "prototype" }), d(5, { rarity: "ultra" }), d(6, { rarity: "special" }),
    d(7, { max_editions: 100 }), d(8, { tier: "archive" }), d(9, { status: "removed" }), d(10, { status: "reward" }),
    { id: 11, hidden: true, tier: "original" }, d(12, { hidden: true }),
  ]);
  assert.deepEqual(out.map((i) => i.source_key), ["1", "2"]);
  assert.deepEqual(out.map((i) => i.rarity), ["common", "uncommon"]);
});

test("a button item has its name, type, and picture address, and no credit or license", () => {
  const [i] = fromApi([d(17, { name: "Bodacious", type: "divider", source_title: "x", license: "CC0", source_author: "someone" })]);
  assert.deepEqual(i, { source: "88x31", source_key: "17", rarity: "common", name: "Bodacious", note: null, type: "divider", image: "https://88x31.app/api/img?d=17", extra: {} });
});

test("buttons come out in design id order", () => {
  assert.deepEqual(fromApi([d(30), d(4), d(12)]).map((i) => i.source_key), ["4", "12", "30"]);
});

test("the committed 88x31 snapshot is 52 buttons (36 common, 16 uncommon) and loads next to the 4Dungeon items", () => {
  const read = (f) => JSON.parse(readFileSync(new URL("../seed/" + f, import.meta.url), "utf8"));
  const snap = read("88x31.json");
  assert.equal(snap.length, 52);
  assert.equal(snap.filter((i) => i.rarity === "common").length, 36); assert.equal(snap.filter((i) => i.rarity === "uncommon").length, 16);
  assert.ok(snap.every((i) => i.image === `https://88x31.app/api/img?d=${i.source_key}` && i.type));
  const DB = fakeD1(); DB.raw.exec(seedSql(read("4dungeon.json"), 1)); DB.raw.exec(seedSql(snap, 1));
  const r = DB.raw.prepare("SELECT MIN(id) AS lo, MAX(id) AS hi, COUNT(*) AS n FROM items WHERE source = '88x31'").get();
  assert.deepEqual({ ...r }, { lo: 47, hi: 98, n: 52 });
  DB.raw.exec(seedSql(snap, 2));                                                // seeding again adds nothing
  assert.equal(DB.raw.prepare("SELECT COUNT(*) AS n FROM items").get().n, 98);
});
