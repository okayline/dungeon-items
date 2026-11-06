// Height maps of 3D printed buttons (kura, Nov 5), both ways:
//   node scripts/relief.mjs read <item id> <file.obj> [<item id> <file.obj> ...] > seed/reliefs.sql
//     reads each map from the OBJ the button was printed from and prints the SQL that stores it in reliefs (run it on items-db;
//     running it again replaces that item's map)
//   node scripts/relief.mjs make <item id> <name> [reliefs.sql]
//     builds <name>.obj and <name>.mtl from that item's map in seed/reliefs.sql (or the file given), for the printer: a closed
//     solid, each pixel a column floor + level * step mm tall, coloured from <name>.png (the picture, any size, pixel (x, y) at
//     its ((x + .5) / 88, (y + .5) / 31)). Reading the OBJ back gives the same map.
// The OBJ is 88 x 31 units (one per pixel, millimetres). Reading: each pixel's height is its highest flat face; floor_mm is the
// lowest of those, step_mm the smallest gap between two of them, and a pixel's level (height - floor) / step, which must come out
// whole and at most 9. The map is 31 rows of 88 levels, the picture's top row first.
import { readFileSync, writeFileSync } from "node:fs";
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
// a closed solid from a map: tops, walls where neighbours differ (split at every height met at each corner, so no edge ends in
// the middle of another), the outside walls and the bottom; faces wound outward, each coloured by its pixel
export function objFromRelief({ map, floor, step }, name) {
  const h = (x, y) => (x < 0 || x >= W || y < 0 || y >= H ? 0 : MM(floor + Number(map[y * W + x]) * step));   // y from the top
  const vs = [], vi = new Map(), vts = [], ti = new Map(), fs = [];
  const V = (x, y, z) => { const k = `${x},${y},${z}`; if (!vi.has(k)) { vi.set(k, vs.length + 1); vs.push(`v ${x.toFixed(4)} ${(H - y).toFixed(4)} ${z.toFixed(4)}`); } return vi.get(k); };
  const T = (x, y) => { const k = `${x},${y}`; if (!ti.has(k)) { ti.set(k, vts.length + 1); vts.push(`vt ${((x + 0.5) / W).toFixed(6)} ${(1 - (y + 0.5) / H).toFixed(6)}`); } return ti.get(k); };
  const F = (t, ...ids) => { for (let k = 1; k < ids.length - 1; k++) fs.push(`f ${ids[0]}/${t} ${ids[k]}/${t} ${ids[k + 1]}/${t}`); };
  // the heights met at a corner (x, y): 0 and its four pixels' tops
  const at = (x, y) => [...new Set([0, h(x - 1, y - 1), h(x, y - 1), h(x - 1, y), h(x, y)])].sort((a, b) => a - b);
  // a wall on the edge from corner a to corner b (seen from outside, a on the left), from lo to hi: the two sides' points
  // zipped into triangles, so it meets every point the corners have
  const wall = (t, a, b, lo, hi) => {
    const L = at(...a).filter((z) => z >= lo && z <= hi), R = at(...b).filter((z) => z >= lo && z <= hi);
    let i = 0, j = 0;
    while (i < L.length - 1 || j < R.length - 1) {
      if (j < R.length - 1 && (i >= L.length - 1 || R[j + 1] <= L[i + 1])) { F(t, V(...a, L[i]), V(...b, R[j]), V(...b, R[j + 1])); j++; }
      else { F(t, V(...a, L[i]), V(...b, R[j]), V(...a, L[i + 1])); i++; }
    }
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const z = h(x, y), t = T(x, y);
    F(t, V(x, y + 1, z), V(x + 1, y + 1, z), V(x + 1, y, z), V(x, y, z));   // top (y counts down the picture, so this is anticlockwise from above)
    F(t, V(x, y, 0), V(x + 1, y, 0), V(x + 1, y + 1, 0), V(x, y + 1, 0));   // bottom
    // each side where this pixel stands above its neighbour (or the outside), from the neighbour's height up
    if (z > h(x, y - 1)) wall(t, [x + 1, y], [x, y], h(x, y - 1), z);            // the side toward the picture's top
    if (z > h(x, y + 1)) wall(t, [x, y + 1], [x + 1, y + 1], h(x, y + 1), z);    // toward its bottom
    if (z > h(x - 1, y)) wall(t, [x, y], [x, y + 1], h(x - 1, y), z);            // left
    if (z > h(x + 1, y)) wall(t, [x + 1, y + 1], [x + 1, y], h(x + 1, y), z);    // right
  }
  return { obj: [`mtllib ${name}.mtl`, ...vs, ...vts, "usemtl tile", ...fs].join("\n") + "\n", mtl: `newmtl tile\nKa 1 1 1\nKd 1 1 1\nKs 0 0 0\nmap_Kd ${name}.png\n` };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === "read" && args.length && !(args.length % 2)) {
    const t = Math.floor(Date.now() / 1000);
    for (let k = 0; k < args.length; k += 2) {
      const id = parseInt(args[k], 10), { map, floor, step } = reliefFromObj(readFileSync(args[k + 1], "utf8"));
      console.log(`-- item ${id}: ${args[k + 1].split("/").pop()}, ${floor} mm + ${step} mm a level`);
      console.log(`INSERT INTO reliefs (item_id, map, floor_mm, step_mm, created_at, updated_at) VALUES (${id}, '${map}', ${floor}, ${step}, ${t}, ${t}) ON CONFLICT (item_id) DO UPDATE SET map = excluded.map, floor_mm = excluded.floor_mm, step_mm = excluded.step_mm, updated_at = excluded.updated_at;`);
    }
  } else if (cmd === "make" && (args.length === 2 || args.length === 3)) {
    const sql = readFileSync(args[2] || new URL("../seed/reliefs.sql", import.meta.url), "utf8");
    const row = [...sql.matchAll(/VALUES \((\d+), '(\d+)', ([\d.]+), ([\d.]+)/g)].find((r) => r[1] === args[0]);
    if (!row) { console.error(`no map for item ${args[0]}`); process.exit(1); }
    const { obj, mtl } = objFromRelief({ map: row[2], floor: Number(row[3]), step: Number(row[4]) }, args[1].split("/").pop());
    writeFileSync(args[1] + ".obj", obj); writeFileSync(args[1] + ".mtl", mtl);
    console.log(`${args[1]}.obj and .mtl (needs ${args[1].split("/").pop()}.png beside them)`);
  } else { console.error("usage: node scripts/relief.mjs read <item id> <file.obj> ... | make <item id> <name> [reliefs.sql]"); process.exit(1); }
}
