import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// CF Workers では I/O オブジェクト（TCP接続）をリクエストをまたいで共有できない。
// そのため、リクエストごとに新しい接続を作り、レスポンス後に破棄する。

export let db: ReturnType<typeof drizzle> | null = null;
export let isMockMode = true;

let _client: ReturnType<typeof postgres> | null = null;

/**
 * リクエスト開始時に呼び出す。
 * CF Workers 対応のためリクエストごとに新しい DB 接続を生成する。
 */
export function initDb(): void {
  isMockMode = process.env.DB_MODE === "mock";

  if (!isMockMode) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL environment variable is required (set DB_MODE=mock to use in-memory mock)",
      );
    }
    // 前の接続を非同期でクローズ（エラーは無視）
    if (_client) {
      _client.end().catch(() => {});
    }
    // リクエストごとに新しい接続を作成
    _client = postgres(connectionString, { max: 1 });
    db = drizzle(_client, { schema });
  } else {
    db = null;
  }
}

/**
 * リクエスト終了後に呼び出す（CF Workers では finally で呼ぶ）。
 */
export async function closeDb(): Promise<void> {
  if (_client) {
    await _client.end().catch(() => {});
    _client = null;
    db = null;
  }
}
