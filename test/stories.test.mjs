// Stories: chapters number themselves per day, can't be edited, and refuse anything that looks private.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeD1 } from "./helpers.mjs";
import { addStory, storiesCall, listStories } from "../src/stories.js";

test("chapters count up per day, refuse private-looking text, need the key, and read back newest first", async () => {
  const db = fakeD1(), c = (day, body = "Zoey, the Calm Scout, held the hallway.") => addStory(db, { day, server: "versus", map: "l4d_hospital01_apartment", title: "The Apartments", body });
  assert.equal((await c("2026-10-27")).chapter, 1);
  assert.equal((await c("2026-10-27")).chapter, 2);
  assert.equal((await c("2026-10-28")).chapter, 1);
  assert.ok((await c("2026-10-27", "STEAM_0:1:123 did it")).error);
  assert.ok((await c("2026-10-27", "joined from 10.1.2.3")).error);
  assert.ok((await c("27-10-2026")).error);
  assert.throws(() => db.raw.prepare("UPDATE stories SET body = 'x'").run());
  assert.throws(() => db.raw.prepare("DELETE FROM stories").run());
  const post = (key) => new Request("https://x/rpc/stories/add", { method: "POST", headers: { "x-stories-key": key }, body: JSON.stringify([{ day: "2026-10-27", server: "versus", map: "m", title: "t", body: "b" }]) });
  const env = { DB: db, STORIES_KEY: "k".repeat(20) };
  assert.equal(await storiesCall(post("wrong"), env), null);
  assert.equal(await storiesCall(post("k".repeat(20)), { DB: db }), null);
  assert.equal((await (await storiesCall(post("k".repeat(20)), env)).json()).chapter, 3);
  const l = await listStories(db, new URLSearchParams("day=2026-10-27"));
  assert.deepEqual(l.stories.map((s) => s.chapter), [3, 2, 1]);
});

test("the main page of a stories.* address is the stories page; other addresses keep no main page", async () => {
  const { default: worker } = await import("../src/worker.js");
  const env = { DB: fakeD1() };
  const home = await worker.fetch(new Request("https://stories.88x31.app/"), env);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Tales from the Safe Room/);
  assert.equal((await worker.fetch(new Request("https://dungeon-items.example.dev/"), env)).status, 404);
});
