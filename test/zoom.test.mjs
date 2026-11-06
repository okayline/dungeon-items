import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";
import { fakeD1 } from "./helpers.mjs";

test("GET /zoom.js serves the shared big view as a script that sets up window.DDZoom once", async () => {
  const r = await worker.fetch(new Request("https://items.example/zoom.js"), {});
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /javascript/);
  const js = await r.text();
  // run it against a stand-in page: it adds its style and DDZoom, and running it again changes nothing
  const added = [], on = [];
  const el = () => ({ style: { setProperty() {} }, append() {}, appendChild(c) { added.push(c); } });
  const window = { addEventListener: (t) => on.push(t) };
  const document = { createElement: el, head: el(), addEventListener: (t) => on.push(t) };
  const run = new Function("window", "document", "addEventListener", js);
  run(window, document, window.addEventListener);
  assert.equal(typeof window.DDZoom.setup, "function");
  assert.equal(window.DDZoom.busy(), false);
  assert.equal(added.length, 1);
  const n = on.length;
  run(window, document, window.addEventListener);
  assert.equal(on.length, n);
});

test("/zoom.js still runs when the build has put __name(...) calls in it (Cloudflare's esbuild keeps function names)", async () => {
  const js = await (await worker.fetch(new Request("https://items.example/zoom.js"), {})).text();
  const built = js.replace("if (window.DDZoom) return;", "if (window.DDZoom) return; __name(function f() {}, \"f\");");   // what the build adds, in short
  assert.notEqual(built, js);
  const el = () => ({ style: { setProperty() {} }, append() {}, appendChild() {} });
  const window = { addEventListener() {} };
  new Function("window", "document", "addEventListener", built)(window, { createElement: el, head: el(), addEventListener() {} }, () => {});
  assert.equal(typeof window.DDZoom.setup, "function");
});

test("GET /api/reliefs lists printed buttons' height maps, not a mystery or retired one's", async () => {
  const db = fakeD1();
  db.raw.prepare(`INSERT INTO items (source, source_key, rarity, name, created_at, updated_at) VALUES
    ('88x31', '20', 'common', 'Island Life', 1, 1), ('88x31', '7', 'rare', 'Secret', 1, 1), ('88x31', '9', 'common', 'Gone', 1, 1)`).run();
  db.raw.prepare("UPDATE items SET retired = 1 WHERE source_key = '9'").run();
  const map = "2".repeat(88 * 31);
  db.raw.prepare("INSERT INTO reliefs (item_id, map, floor_mm, step_mm, created_at, updated_at) VALUES (1, ?, 2.8, 0.6, 1, 1), (2, ?, 2.8, 0.6, 1, 1), (3, ?, 2.8, 0.6, 1, 1)").run(map, map, map);
  const r = await worker.fetch(new Request("https://items.example/api/reliefs"), { DB: db });
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
  assert.deepEqual(await r.json(), [{ id: 1, source: "88x31", key: "20", map, floor: 2.8, step: 0.6 }]);
});
