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

test("voice: a chapter is read aloud once in order, kept as mp3, served back, replaced only on redo", async () => {
  const { addVoice, serveVoice } = await import("../src/stories.js");
  const db = fakeD1(), store = new Map(), calls = [], mp3 = Uint8Array.from({ length: 200 }, (_, i) => i);
  const PICTURES = { head: async (k) => store.get(k) || null, put: async (k, b, o) => { store.set(k, { body: b, httpMetadata: o.httpMetadata }); }, get: async (k) => store.get(k) || null };
  const AI = { run: async (model, input) => { calls.push([model, input]); return new Response(mp3).body; } };
  const para = (c) => (c + " ").repeat(900).trim();   // 1,799 characters: each paragraph is its own piece
  const id = (await addStory(db, { day: "2026-10-27", server: "versus", map: "m", title: "t", body: para("a") + "\n\n" + para("b") })).id, env = { DB: db, AI, PICTURES };
  assert.ok((await addVoice(env, { id: 999 })).error);
  assert.ok((await addVoice(env, { id, speaker: "Bad Name" })).error);
  const r = await addVoice(env, { id, speaker: "luna" });
  assert.deepEqual([r.ok, r.pieces, r.bytes], [true, 2, 400]);
  assert.deepEqual(calls.map(([m, i]) => [m, i.text[0], i.speaker, i.encoding]), [["@cf/deepgram/aura-2-en", "a", "luna", "mp3"], ["@cf/deepgram/aura-2-en", "b", "luna", "mp3"]]);
  assert.ok((await addVoice(env, { id })).error);   // never replaced without redo
  assert.equal((await addVoice(env, { id, redo: true })).redone, true);
  assert.equal((await serveVoice(env, `/api/stories/voice/${id}`)).headers.get("content-type"), "audio/mpeg");
  assert.equal(await serveVoice(env, "/api/stories/voice/999"), null);
  calls.length = 0;
  const t = await addVoice(env, { id: (await addStory(db, { day: "2026-10-27", server: "versus", map: "m", title: "t2", body: "One here. Two here. Three here." })).id, sentences: 2 });
  assert.deepEqual([t.ok, calls.length, calls[0][1].text], [true, 1, "One here. Two here."]);   // a short test reads only the first sentences
});

test("pictures: 3 are made once per chapter (setting, then two subjects), kept as given, served back, never replaced", async () => {
  const { addPictures, servePicture } = await import("../src/stories.js");
  const db = fakeD1(), store = new Map(), png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  const PICTURES = { head: async (k) => store.get(k) || null, put: async (k, b, o) => { store.set(k, { body: b, httpMetadata: o.httpMetadata }); }, get: async (k) => store.get(k) || null };
  const AI = { run: async (model) => model.includes("phoenix") ? new Response(png).body : { image: Buffer.from(png).toString("base64") } };
  const id = (await addStory(db, { day: "2026-10-27", server: "versus", map: "m", title: "t", body: "b" })).id, env = { DB: db, AI, PICTURES };
  assert.ok((await addPictures(env, { id, prompts: ["a", "b"] })).error);
  assert.ok((await addPictures(env, { id: 999, prompts: ["a", "b", "c"] })).error);
  assert.equal((await addPictures(env, { id, prompts: ["a tunnel", "a man", "a woman"] })).pictures, 3);
  assert.ok((await addPictures(env, { id, prompts: ["a", "b", "c"] })).error);
  assert.equal((await servePicture(env, `/api/stories/picture/${id}/2`)).headers.get("content-type"), "image/png");
  assert.equal(await servePicture(env, `/api/stories/picture/${id}/4`), null);
  assert.ok((await addPictures(env, { id, redo: { 4: "x" } })).error);   // three pictures per chapter, no fourth
  const { uploadPicture } = await import("../src/stories.js"), jpg = Uint8Array.from([0xff, 0xd8, 0xff, 9, 9]);
  assert.equal((await uploadPicture(env, new URLSearchParams(`id=${id}&slot=2`), jpg)).ok, true);   // a picture made elsewhere, saved as is
  assert.equal(store.get(`story-${id}/2`).httpMetadata.contentType, "image/jpeg");
  assert.ok((await uploadPicture(env, new URLSearchParams(`id=${id}&slot=2`), Uint8Array.from([1, 2, 3]))).error);
  assert.ok((await uploadPicture(env, new URLSearchParams(`id=999&slot=2`), jpg)).error);
  assert.equal((await addPictures(env, { id, redo: { 2: "a new man" } })).pictures, 1);   // a redo replaces just that slot
  assert.equal(store.get(`story-${id}/2`).httpMetadata.contentType, "image/png");
});
