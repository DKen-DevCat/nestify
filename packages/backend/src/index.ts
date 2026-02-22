import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoutes } from "./routes/auth";
import { playlistRoutes } from "./routes/playlists";
import { spotifyRoutes } from "./routes/spotify";
import { authMiddleware } from "./middleware/auth";
import { initDb, closeDb } from "./db/index";

type Variables = { userId: string };

// CF Workers のシークレット・バインディングを process.env に注入する型
type CloudflareEnv = {
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  SPOTIFY_CLIENT_ID?: string;
  SPOTIFY_CLIENT_SECRET?: string;
  SPOTIFY_REDIRECT_URI?: string;
  FRONTEND_URL?: string;
  DB_MODE?: string;
};

const app = new Hono<{ Variables: Variables }>();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) =>
      origin ?? process.env.FRONTEND_URL ?? "http://localhost:3000",
  }),
);

app.get("/", (c) => {
  return c.json({ message: "Nestify API", version: "0.1.0" });
});

// 認証不要ルート
app.route("/auth", authRoutes);

// 認証必須ルート
app.use("/api/*", authMiddleware);
app.route("/api/playlists", playlistRoutes);
app.route("/api/spotify", spotifyRoutes);

// Hono RPC のため型を export（フロントエンドが使う）
export type AppType = typeof app;

/**
 * CF Workers のバインディング（シークレット・vars）を process.env に注入してから
 * Hono ハンドラを呼ぶラッパー。
 * ローカル Bun 実行時は env が空なので process.env の既存値をそのまま使う。
 */
async function fetchHandler(
  request: Request,
  env: CloudflareEnv,
): Promise<Response> {
  // CF Workers のシークレットを process.env へ注入
  if (env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;
  if (env.JWT_SECRET) process.env.JWT_SECRET = env.JWT_SECRET;
  if (env.SPOTIFY_CLIENT_ID)
    process.env.SPOTIFY_CLIENT_ID = env.SPOTIFY_CLIENT_ID;
  if (env.SPOTIFY_CLIENT_SECRET)
    process.env.SPOTIFY_CLIENT_SECRET = env.SPOTIFY_CLIENT_SECRET;
  if (env.SPOTIFY_REDIRECT_URI)
    process.env.SPOTIFY_REDIRECT_URI = env.SPOTIFY_REDIRECT_URI;
  if (env.FRONTEND_URL) process.env.FRONTEND_URL = env.FRONTEND_URL;
  if (env.DB_MODE) process.env.DB_MODE = env.DB_MODE;

  // リクエストごとに新しい DB 接続を初期化し、終了後に破棄する
  initDb();
  try {
    return await app.fetch(request);
  } finally {
    await closeDb();
  }
}

export default {
  port: process.env.PORT ?? 3001,
  fetch: fetchHandler,
};
