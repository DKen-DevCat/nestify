import { Hono } from "hono";
import { SignJWT } from "jose";
import { db, isMockMode } from "../db/index";
import { users, pkceStates } from "../db/schema";
import { eq, lt } from "drizzle-orm";

const SPOTIFY_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-public",
  "playlist-modify-private",
  "streaming",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
].join(" ");

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
const JWT_EXPIRY = "7d";

// PKCE: セッション間で code_verifier を保持するための一時ストア
// DBモードでは pkce_states テーブルを使用。モックモードではインメモリで代替。
const codeVerifierStore = new Map<string, string>();

async function saveState(state: string, codeVerifier: string): Promise<void> {
  if (!isMockMode && db) {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db
      .insert(pkceStates)
      .values({ state, codeVerifier, expiresAt })
      .onConflictDoUpdate({ target: pkceStates.state, set: { codeVerifier, expiresAt } });
    // 期限切れのエントリを削除（機会があるときにクリーンアップ）
    await db.delete(pkceStates).where(lt(pkceStates.expiresAt, new Date()));
  } else {
    codeVerifierStore.set(state, codeVerifier);
    setTimeout(() => codeVerifierStore.delete(state), 10 * 60 * 1000);
  }
}

async function getAndDeleteState(state: string): Promise<string | null> {
  if (!isMockMode && db) {
    const rows = await db
      .select()
      .from(pkceStates)
      .where(eq(pkceStates.state, state));
    if (rows.length === 0) return null;
    await db.delete(pkceStates).where(eq(pkceStates.state, state));
    // 期限切れチェック
    if (rows[0].expiresAt < new Date()) return null;
    return rows[0].codeVerifier;
  } else {
    const verifier = codeVerifierStore.get(state) ?? null;
    codeVerifierStore.delete(state);
    return verifier;
  }
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function generateCodeVerifier(): Promise<string> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array.buffer);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
}

async function generateJwt(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(secret);
}

export const authRoutes = new Hono();

// 開発用トークン発行（DB_MODE=mock かつ DEV_BYPASS_AUTH=true の場合のみ有効）
authRoutes.get("/dev-token", async (c) => {
  const isMock = process.env.DB_MODE === "mock";
  const isBypass = process.env.DEV_BYPASS_AUTH === "true";

  if (!isMock || !isBypass) {
    return c.json(
      { ok: false, error: "dev-token is only available in mock+bypass mode" },
      403,
    );
  }

  const token = await generateJwt("mock_user");
  return c.json({ ok: true, data: { token } });
});

authRoutes.get("/login", async (c) => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    return c.json(
      { ok: false, error: "Spotify credentials not configured" },
      503,
    );
  }

  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI ?? "http://localhost:3001/auth/callback";
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
  const state = crypto.randomUUID();

  const codeVerifier = await generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // state をキーに code_verifier を一時保存
  await saveState(state, codeVerifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: SPOTIFY_SCOPES,
    redirect_uri: redirectUri,
    state,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });

  // Spotify 認証ページへリダイレクト
  return c.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});

authRoutes.get("/callback", async (c) => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return c.json(
      { ok: false, error: "Spotify credentials not configured" },
      503,
    );
  }

  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  if (error) {
    return c.json({ ok: false, error: `Spotify auth error: ${error}` }, 400);
  }

  if (!code || !state) {
    return c.json({ ok: false, error: "Missing code or state" }, 400);
  }

  const codeVerifier = await getAndDeleteState(state);
  if (!codeVerifier) {
    return c.json({ ok: false, error: "Invalid or expired state" }, 400);
  }

  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI ?? "http://localhost:3001/auth/callback";

  // Spotify にトークン交換をリクエスト
  const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenResponse.ok) {
    const body = await tokenResponse.text();
    return c.json(
      { ok: false, error: `Token exchange failed: ${body}` },
      500,
    );
  }

  const tokens = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  // Spotify ユーザー情報を取得
  const profileResponse = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!profileResponse.ok) {
    return c.json({ ok: false, error: "Failed to fetch Spotify profile" }, 500);
  }

  const profile = (await profileResponse.json()) as {
    id: string;
    display_name: string;
    email: string;
    images: { url: string }[];
  };

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  let internalUserId = profile.id; // モックモード時は Spotify ID をそのまま使う

  // DB モード: users テーブルに upsert
  if (!isMockMode && db) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.spotifyId, profile.id));

    if (existing.length > 0) {
      await db
        .update(users)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: expiresAt,
          displayName: profile.display_name ?? profile.id,
          imageUrl: profile.images?.[0]?.url ?? null,
        })
        .where(eq(users.spotifyId, profile.id));
      internalUserId = existing[0].id;
    } else {
      const inserted = await db
        .insert(users)
        .values({
          spotifyId: profile.id,
          displayName: profile.display_name ?? profile.id,
          email: profile.email ?? null,
          imageUrl: profile.images?.[0]?.url ?? null,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: expiresAt,
        })
        .returning({ id: users.id });
      internalUserId = inserted[0].id;
    }
  }

  const jwt = await generateJwt(internalUserId);

  // フロントエンドのコールバックページへリダイレクト（(auth) ルートグループのため /callback）
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
  return c.redirect(`${frontendUrl}/callback?token=${jwt}`);
});
