// Reads a button's height map from the OBJ it was 3D printed from (kura, Nov 5) and prints the SQL that stores it in reliefs:
//   node scripts/relief-from-obj.mjs <item id> <file.obj> [<item id> <file.obj> ...] > seed/reliefs.sql
// Then run the SQL on items-db. Running it again replaces that item's map.
// The OBJ is 88 x 31 units (one per pixel, millimetres), a 2 mm base, and each pixel's top 0.4 mm steps above it. Each pixel's
// level is its highest flat face's height: (top - 2) / 0.4. The map is 31 rows of 88 levels, the picture's top row first.
import { readFileSync } from "node:fs";
const W = 88, H = 31, BASE = 2, STEP = 0.4;
export function reliefFromObj(text) {
  const v = [], top = new Array(W * H).fill(-1);
  for (const line of text.split("\n")) {
    const p = line.trim().split(/\s+/);
    if (p[0] === "v") v.push(p.slice(1, 4).map(Number));
    else if (p[0] === "f") {
      const f = p.slice(1).map((s) => v[parseInt(s, 10) - 1]);
      if (!f.every((q) => Math.abs(q[2] - f[0][2]) < 1e-6)) continue;   // only flat faces
      const x = Math.floor(f.reduce((s, q) => s + q[0], 0) / f.length), y = Math.floor(f.reduce((s, q) => s + q[1], 0) / f.length);
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const i = (H - 1 - y) * W + x;   // the OBJ's y counts up from the bottom; the map starts at the top row
      top[i] = Math.max(top[i], f[0][2]);
    }
  }
  return top.map((z, i) => {
    const level = (z - BASE) / STEP;
    if (z < 0 || Math.abs(level - Math.round(level)) > 1e-3 || level < 0 || level > 9) throw new Error(`pixel ${i % W},${Math.floor(i / W)}: top ${z} is not 2 mm + a 0.4 mm step`);
    return Math.round(level);
  }).join("");
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (!args.length || args.length % 2) { console.error("usage: node scripts/relief-from-obj.mjs <item id> <file.obj> ..."); process.exit(1); }
  const t = Math.floor(Date.now() / 1000);
  for (let k = 0; k < args.length; k += 2) {
    const id = parseInt(args[k], 10), map = reliefFromObj(readFileSync(args[k + 1], "utf8"));
    console.log(`-- item ${id}: ${args[k + 1].split("/").pop()}`);
    console.log(`INSERT INTO reliefs (item_id, map, created_at, updated_at) VALUES (${id}, '${map}', ${t}, ${t}) ON CONFLICT (item_id) DO UPDATE SET map = excluded.map, updated_at = excluded.updated_at;`);
  }
}
