// The shared name words: 40 of each, no repeats, plain capitalised words (counts written out here, not taken from the file).
import test from "node:test";
import assert from "node:assert/strict";
import { NAME_ADJECTIVES, NAME_NOUNS } from "../src/name-words.js";

test("the name lists are 40 adjectives and 40 nouns, no repeats, each one capitalised word", () => {
  for (const list of [NAME_ADJECTIVES, NAME_NOUNS]) {
    assert.equal(list.length, 40);
    assert.equal(new Set(list.map((w) => w.toLowerCase())).size, 40);
    for (const w of list) assert.match(w, /^[A-Z][a-z]+$/);
  }
  assert.deepEqual([NAME_ADJECTIVES[0], NAME_NOUNS[0], NAME_ADJECTIVES[39], NAME_NOUNS[39]], ["Quiet", "Modem", "Shiny", "Console"]);
});
