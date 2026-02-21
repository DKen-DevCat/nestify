import type { Context, Next } from "hono";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";

type Variables = {
  userId: string;
};

export async function authMiddleware(
  c: Context<{ Variables: Variables }>,
  next: Next,
): Promise<Response | void> {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ ok: false, error: "Unauthorized" }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    if (typeof payload.sub !== "string") {
      return c.json({ ok: false, error: "Invalid token payload" }, 401);
    }

    c.set("userId", payload.sub);
    await next();
  } catch {
    return c.json({ ok: false, error: "Invalid or expired token" }, 401);
  }
}
