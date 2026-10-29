import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

test("GET /footer.js serves the shared footer script", async () => {
  const r = await worker.fetch(new Request("https://items.example/footer.js"), {});
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /^application\/javascript/);
  const js = await r.text();
  assert.ok(js.includes("/api/carry?embed=1"));   // the game's own carry window
  assert.doesNotThrow(() => new Function(js));     // it parses
});
