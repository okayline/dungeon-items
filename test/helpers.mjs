// Node's built-in SQLite standing in for D1. Expected values in tests come from raw SQL and hand-written lists,
// never from the code under test. `batch` runs its statements in one transaction and rolls the lot back if any fails,
// which is what D1 does.
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
export function fakeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const prep = (sql, args = []) => ({
    sql, args, bind: (...a) => prep(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
  });
  const batch = async (stmts) => {
    db.exec("BEGIN");
    try {
      const out = stmts.map((st) => ({ meta: { changes: Number(db.prepare(st.sql).run(...st.args).changes) } }));
      db.exec("COMMIT");
      return out;
    } catch (e) { db.exec("ROLLBACK"); throw e; }
  };
  return { prepare: (sql) => prep(sql), batch, raw: db };
}
