import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import pg from "pg";

const migrationsDir = resolve(process.argv[2] ?? "db/migrations");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  for (const file of files) {
    const sqlPath = join(migrationsDir, file);
    const sql = await readFile(sqlPath, "utf8");
    await client.query(sql);
    console.log(`Applied ${sqlPath}`);
  }
} finally {
  await client.end();
}
