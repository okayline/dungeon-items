// Rebuilds seed/88x31.json from 88x31's public catalog. Run where 88x31.app can be reached:
//   node scripts/sync-88x31.mjs                       (fetches https://88x31.app/api/designs)
//   node scripts/sync-88x31.mjs designs.json          (or reads a saved copy of that response)
// Then: node scripts/seed-sql.mjs seed/88x31.json, and run the SQL on items-db. Buttons already in the table are
// left alone (INSERT OR IGNORE); a button that has left the catalog is retired by hand (retired = 1).
import { readFileSync, writeFileSync } from "node:fs";
import { fromApi } from "../src/buttons.js";
const body = process.argv[2] ? JSON.parse(readFileSync(process.argv[2], "utf8")) : await (await fetch("https://88x31.app/api/designs")).json();
const items = fromApi(body.designs);
writeFileSync(new URL("../seed/88x31.json", import.meta.url), JSON.stringify(items, null, 1) + "\n");
console.log(items.length + " buttons");
