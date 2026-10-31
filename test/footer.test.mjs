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

test("a page set in VT323 gets a bigger footer, since VT323 is a small font", async () => {
  const js = await (await worker.fetch(new Request("https://items.example/footer.js"), {})).text();
  assert.ok(js.includes("/VT323/i.test(getComputedStyle(spot || me.parentNode).fontFamily)") && js.includes('foot.style.fontSize = "12px"'));
});

test('data-copy="no" leaves out the copyright sign', async () => {
  const js = await (await worker.fetch(new Request("https://items.example/footer.js"), {})).text();
  assert.ok(js.includes('d.copy === "no" ? "" : "\\u{1f12f} "'));
});

test('a game with <div id="ddfoot"> gets the footer drawn into it, with no waiting for load', async () => {
  const js = await (await worker.fetch(new Request("https://items.example/footer.js"), {})).text();
  assert.ok(js.includes('document.getElementById("ddfoot")') && js.includes("if (!spot) me.parentNode.insertBefore(foot, me.nextSibling)"));
});

test("the footer text can be selected and waits for the page to load before it shows", async () => {
  const js = await (await worker.fetch(new Request("https://items.example/footer.js"), {})).text();
  assert.ok(js.includes("user-select:text}") && js.includes('foot.style.visibility = "hidden"') && js.includes('addEventListener("load", reveal)'));
});
