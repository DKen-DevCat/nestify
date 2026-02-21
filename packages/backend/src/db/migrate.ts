/**
 * Drizzle マイグレーション実行スクリプト
 *
 * 使い方:
 *   DATABASE_URL=... bun run src/db/migrate.ts
 *
 * または package.json の db:migrate スクリプト経由。
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as path from "node:path";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("ERROR: DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

const migrationsFolder = path.join(import.meta.dir, "migrations");

console.log("Running migrations from:", migrationsFolder);

try {
  await migrate(db, { migrationsFolder });
  console.log("✓ Migrations completed successfully");
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
} finally {
  await client.end();
}
