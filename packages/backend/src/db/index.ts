import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// CF Workers ではモジュール初期化時に process.env が利用不可なため、
// DB 接続はリクエスト処理開始時（initDb()呼び出し後）に行う

export let db: ReturnType<typeof drizzle> | null = null;
export let isMockMode = true; // initDb() が呼ばれるまでのデフォルト値

let initialized = false;

/**
 * DB 接続を初期化する。
 * Hono ミドルウェアから最初のリクエスト時に1度だけ呼ばれる。
 */
export function initDb(): void {
  if (initialized) return;
  initialized = true;

  isMockMode = process.env.DB_MODE === "mock";

  if (!isMockMode) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL environment variable is required (set DB_MODE=mock to use in-memory mock)",
      );
    }
    const client = postgres(connectionString, { max: 5 });
    db = drizzle(client, { schema });
  }
}
