import { Hono } from "hono";
import { SignJWT } from "jose";

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
// 本番では Redis や DB を使う。ここではインメモリで代替。
const codeVerifierStore = new Map<string, string>();

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
  codeVerifierStore.set(state, codeVerifier);
  // 10 分後に自動削除
  setTimeout(() => codeVerifierStore.delete(state), 10 * 60 * 1000);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: SPOTIFY_SCOPES,
    redirect_uri: redirectUri,
    state,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });

  // フロントエンドへの認証 URL を返す（リダイレクトはフロント側で行う）
  return c.json({
    ok: true,
    data: {
      authUrl: `https://accounts.spotify.com/authorize?${params.toString()}`,
      frontendUrl,
    },
  });
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

  const codeVerifier = codeVerifierStore.get(state);
  if (!codeVerifier) {
    return c.json({ ok: false, error: "Invalid or expired state" }, 400);
  }
  codeVerifierStore.delete(state);

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
      client_verifier: codeVerifier,
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

  // TODO: DB にユーザー情報を upsert（DB 接続後に実装）
  // 現時点では Spotify ID を JWT の sub として使う
  const jwt = await generateJwt(profile.id);

  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
  return c.redirect(`${frontendUrl}/auth/callback?token=${jwt}`);
});
