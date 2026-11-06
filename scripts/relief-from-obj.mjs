// Reads a button's height map from the OBJ it was 3D printed from (kura, Nov 5) and prints the SQL that stores it in reliefs:
//   node scripts/relief-from-obj.mjs <item id> <file.obj> [<item id> <file.obj> ...] > seed/reliefs.sql
// Then run the SQL on items-db. Running it again replaces that item's map.
// The OBJ is 88 x 31 units (one per pixel, millimetres). Each pixel's height is its highest flat face. floor_mm is the lowest of
// those, step_mm the smallest gap between two of them, and a pixel's level (height - floor) / step, which must come out whole
// and at most 9. The map is 31 rows of 88 levels, the picture's top row first.
import { readFileSync } from "node:fs";
const W = 88, H = 31, MM = (z) => Math.round(z * 100) / 100;
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
      top[i] = Math.max(top[i], MM(f[0][2]));
    }
  }
  const missing = top.indexOf(-1);
  if (missing >= 0) throw new Error(`pixel ${missing % W},${Math.floor(missing / W)} has no flat top`);
  const heights = [...new Set(top)].sort((a, b) => a - b), floor = heights[0];
  const step = heights.length > 1 ? MM(Math.min(...heights.slice(1).map((h, k) => h - heights[k]))) : 1;
  const map = top.map((z, i) => {
    const level = (z - floor) / step;
    if (Math.abs(level - Math.round(level)) > 1e-3 || level > 9) throw new Error(`pixel ${i % W},${Math.floor(i / W)}: ${z} mm is not ${floor} mm + a whole number (at most 9) of ${step} mm steps`);
    return Math.round(level);
  }).join("");
  return { map, floor, step };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (!args.length || args.length % 2) { console.error("usage: node scripts/relief-from-obj.mjs <item id> <file.obj> ..."); process.exit(1); }
  const t = Math.floor(Date.now() / 1000);
  for (let k = 0; k < args.length; k += 2) {
    const id = parseInt(args[k], 10), { map, floor, step } = reliefFromObj(readFileSync(args[k + 1], "utf8"));
    console.log(`-- item ${id}: ${args[k + 1].split("/").pop()}, ${floor} mm + ${step} mm a level`);
    console.log(`INSERT INTO reliefs (item_id, map, floor_mm, step_mm, created_at, updated_at) VALUES (${id}, '${map}', ${floor}, ${step}, ${t}, ${t}) ON CONFLICT (item_id) DO UPDATE SET map = excluded.map, floor_mm = excluded.floor_mm, step_mm = excluded.step_mm, updated_at = excluded.updated_at;`);
  }
}
