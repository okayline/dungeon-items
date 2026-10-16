// Reads 4Dungeon's rules.js (never changes it) and writes seed/4dungeon.json: every item with its rarity, note,
// alignment, nature, and the bits only 4Dungeon uses (a use, what it says when used, a both-name).
//   node scripts/extract-4dungeon.mjs ../daily-dungeon/rules.js
import { readFileSync, writeFileSync } from "node:fs";
import { extract } from "../src/extract.js";
const src = readFileSync(process.argv[2] || "../daily-dungeon/rules.js", "utf8");
const items = extract(src);
writeFileSync(new URL("../seed/4dungeon.json", import.meta.url), JSON.stringify(items, null, 1) + "\n");
console.log(items.length + " items");
