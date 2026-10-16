// SQL that adds items. INSERT OR IGNORE on (source, source_key): running it twice adds nothing, and an item already
// in the table is never overwritten (the table is the master once seeded).
const lit = (v) => v === null || v === undefined ? "NULL" : typeof v === "number" ? String(Math.trunc(v)) : "'" + String(v).replaceAll("'", "''") + "'";
export function seedSql(items, now) {
  return items.map((i) => `INSERT OR IGNORE INTO items (source, source_key, rarity, name, note, alignment, nature, type, image, extra, created_at, updated_at) VALUES (${[i.source, i.source_key, i.rarity, i.name, i.note ?? null, i.alignment ?? null, i.nature ?? null, i.type ?? null, i.image ?? null, JSON.stringify(i.extra || {}), now, now].map(lit).join(", ")});`).join("\n") + "\n";
}
