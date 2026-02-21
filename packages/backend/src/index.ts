import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
  }),
);

app.get("/", (c) => {
  return c.json({ message: "Nestify API" });
});

// Hono RPC のため型を export（フロントエンドが使う）
export type AppType = typeof app;

export default {
  port: process.env.PORT ?? 3001,
  fetch: app.fetch,
};
