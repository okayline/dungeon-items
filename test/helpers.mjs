// Node's built-in SQLite standing in for D1. Expected values in tests come from raw SQL and hand-written lists,
// never from the code under test.
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
export function fakeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const prep = (sql, args = []) => ({
    bind: (...a) => prep(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
  });
  return { prepare: (sql) => prep(sql), raw: db };
}
