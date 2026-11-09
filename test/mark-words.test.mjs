import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

test("GET /mark-words.js serves the ledger's mark words, its names kept inside", async () => {
  const r = await worker.fetch(new Request("https://items.example/mark-words.js"), {});
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /^application\/javascript/);
  const window = {};
  new Function("window", await r.text())(window);
  assert.equal(window.DDMarkWords.markWords({ kind: "night", value: "full" }), "was found under a full moon");   // PHASE.full, by hand
  assert.equal(window.DDMarkWords.markWords({ kind: "deed", value: "pulled_pack" }), "was pulled from a pack");   // DEED.pulled_pack
});
