// Prints the SQL to seed a seed/*.json file:  node scripts/seed-sql.mjs seed/4dungeon.json > /tmp/seed.sql
import { readFileSync } from "node:fs";
import { seedSql } from "../src/seed.js";
process.stdout.write(seedSql(JSON.parse(readFileSync(process.argv[2], "utf8")), Math.floor(Date.now() / 1000)));
