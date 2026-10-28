// Stories: chapters number themselves per day, can't be edited, and refuse anything that looks private.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeD1 } from "./helpers.mjs";
import { createHash } from "node:crypto";
import { addStory, storiesCall, listStories, sealStories } from "../src/stories.js";
import { verify } from "../src/registry.js";

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

test("every chapter is sealed on the ledger as it is saved, and older ones can be sealed later", async () => {
  const db = fakeD1();
  await addStory(db, { day: "2026-10-27", server: "versus", map: "m", title: "T1", body: "Zoey held the hallway." });
  const rows = db.raw.prepare("SELECT kind, game, player_id, record FROM ledger").all();
  const fp = createHash("sha256").update("T1\nZoey held the hallway.").digest("hex");
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].kind, rows[0].game, rows[0].player_id], ["story", "l4d", 0]);
  assert.equal(rows[0].record, '{"k":"story","game":"l4d","day":"2026-10-27","chapter":1,"server":"versus","map":"m","hash":"' + fp + '"}');
  // a chapter saved before sealing existed: sealed once, then nothing more to do
  db.raw.prepare("INSERT INTO stories (day, chapter, server, map, title, body, created_at) VALUES ('2026-10-27', 2, 'versus', 'm', 'T2', 'Old one.', 1)").run();
  assert.deepEqual(await sealStories(db), { ok: true, sealed: 1 });
  assert.deepEqual(await sealStories(db), { ok: true, sealed: 0 });
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM ledger WHERE kind = 'story'").get().c, 2);
  assert.equal((await verify(db)).ok, true);
});

test("worldEvents reads the Tank and Witch from today's and yesterday's chapters only, and the mark words show", async () => {
  const { worldEvents } = await import("../src/stories.js");
  const { markWords } = await import("../src/mark-words.js");
  const db = fakeD1(), add = (day, moments) => addStory(db, { day, server: "versus", map: "m", title: "T", body: "Zoey held the hallway.", facts: { moments } });
  const noon = Date.UTC(2026, 9, 28, 22, 0);   // 12:00 Hawaii, Oct 28
  assert.deepEqual(await worldEvents(db, noon), { events: [] });
  await add("2026-10-20", [[1, "Zoey, the Calm Scout", "killed the tank with rifle"]]);
  assert.deepEqual(await worldEvents(db, noon), { events: [] });
  await add("2026-10-27", [[1, "Zoey, the Calm Scout", "killed the witch with shotgun"]]);
  assert.deepEqual(await worldEvents(db, noon), { events: ["witch_fell"] });
  await add("2026-10-28", [[1, "Bill, the Brave Falcon", "killed the tank with rifle"]]);
  assert.deepEqual(await worldEvents(db, noon), { events: ["tank_fell", "witch_fell"] });
  assert.equal(markWords({ kind: "night", value: "tank_fell" }), "was found on the day a Tank fell");
  assert.equal(markWords({ kind: "night", value: "witch_fell" }), "was found on the day a Witch fell");
});
