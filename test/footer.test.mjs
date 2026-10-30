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

test("a data-carry starting with # goes to that place on the page instead of popping up the window", async () => {
  const js = await (await worker.fetch(new Request("https://items.example/footer.js"), {})).text();
  assert.ok(js.includes('carry.charAt(0) === "#"') && js.includes("location.hash = carry"));
});

test("data-align=center centers the footer line", async () => {
  const js = await (await worker.fetch(new Request("https://items.example/footer.js"), {})).text();
  assert.ok(js.includes('d.align === "center"') && js.includes('foot.style.textAlign = "center"'));
});

test('data-copy="no" leaves out the copyright sign', async () => {
  const js = await (await worker.fetch(new Request("https://items.example/footer.js"), {})).text();
  assert.ok(js.includes('d.copy === "no" ? "" : "\\u{1f12f} "'));
});
