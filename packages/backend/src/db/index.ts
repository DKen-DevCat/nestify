import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// DB_MODE=mock の場合はモックデータを使い、実 DB には接続しない
const isMockMode = process.env.DB_MODE === "mock";

let db: ReturnType<typeof drizzle> | null = null;

if (!isMockMode) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is required (set DB_MODE=mock to use in-memory mock)",
    );
  }
  const client = postgres(connectionString);
  db = drizzle(client, { schema });
}

export { db, isMockMode };
