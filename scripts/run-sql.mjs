import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const sqlPath = process.argv[2];

if (!sqlPath) {
  console.error("Usage: node scripts/run-sql.mjs <path-to-sql>");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const absoluteSqlPath = resolve(sqlPath);
const sql = await readFile(absoluteSqlPath, "utf8");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query(sql);
  console.log(`Applied ${absoluteSqlPath}`);
} finally {
  await client.end();
}
