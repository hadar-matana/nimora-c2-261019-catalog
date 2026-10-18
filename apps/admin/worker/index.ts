import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import bcrypt from "bcryptjs";
import {
  ApiError,
  readJson,
  catalog,
  catalogView,
  view,
  id,
  saveProduct,
  saveCategories,
  uploadRetestActive,
  type SanityEnv,
} from "./sanity";
import { readAbout, saveAbout } from "./about";
import { readOptions, changeOption } from "./catalog-options";
import { uploadImage } from "./uploads";
import { allowedHost } from "./access";
import { sessionLifetime } from "./session-policy";

type Env = SanityEnv & {
  ASSETS: Fetcher;
  AUTH: DurableObjectNamespace;
  LOCAL_COMPAT_PROOF: string;
  ADMIN_REMOTE_ENABLED?: string;
  ADMIN_ORIGIN: string;
  OWNER_USERNAME: string;
  OWNER_PASSWORD_HASH: string;
  CREDENTIAL_VERSION: string;
  TEST_UPLOAD_ORIGIN?: string;
  LOCAL_SESSION_TTL_MS?: string;
  SESSION_TTL_SECONDS?: string;
  ADMIN_QA_PRODUCT_ID?: string;
};
type Session = { expires: number; csrf: string; version: string };
const cookie = "__Host-atelier_session";

const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
const random = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
async function digest(token: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}

// This one local SQLite-backed DO contains security records only, never products.
export class OwnerAuth implements DurableObject {
  private metrics = { verifications: 0, verificationElapsedMs: 0 };
  constructor(
    private state: DurableObjectState,
    private env: Env,
  ) {}
  async alarm() {
    const now = Date.now();
    for (const prefix of ["session:", "rate:"]) {
      const rows = await this.state.storage.list<{
        expires?: number;
        until?: number;
      }>({ prefix });
      for (const [key, value] of rows)
        if ((value.expires ?? value.until ?? 0) <= now)
          await this.state.storage.delete(key);
    }
    if ((await this.state.storage.list({ limit: 1 })).size)
      await this.state.storage.setAlarm(now + 5 * 60 * 1000);
  }
  async fetch(request: Request) {
    const path = new URL(request.url).pathname;
    const input = (await request.json()) as {
      username?: string;
      password?: string;
      ip?: string;
      token?: string;
    };
    if (path === "/login") {
      if (!this.env.OWNER_PASSWORD_HASH || !this.env.OWNER_USERNAME)
        return json({ error: "חשבון מקומי לא הוגדר" }, 503);
      if (
        typeof input.username !== "string" ||
        typeof input.password !== "string" ||
        input.username.length > 80 ||
        bcrypt.truncates(input.password)
      )
        return json({ error: "פרטי כניסה לא תקינים" }, 400);
      if (
        !/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(
          this.env.OWNER_PASSWORD_HASH,
        ) ||
        !this.env.CREDENTIAL_VERSION
      )
        return json({ error: "חשבון מקומי לא הוגדר" }, 503);
      const now = Date.now();
      if ((await this.state.storage.getAlarm()) === null)
        await this.state.storage.setAlarm(now + 5 * 60 * 1000);
      const keys = [
        "rate:owner",
        "rate:ip:" + (await digest(input.ip ?? "unknown")),
      ];
      const allowed = await this.state.storage.transaction(async (tx) => {
        const rows = await Promise.all(
          keys.map(async (key) => ({
            key,
            value: await tx.get<{ count: number; until: number }>(key),
          })),
        );
        if (
          rows.some(
            (row) =>
              row.value &&
              row.value.until > now &&
              row.value.count >= (row.key === "rate:owner" ? 20 : 5),
          )
        )
          return false;
        for (const row of rows)
          await tx.put(row.key, {
            count: row.value && row.value.until > now ? row.value.count + 1 : 1,
            until:
              row.value && row.value.until > now
                ? row.value.until
                : now + 15 * 60 * 1000,
          });
        return true;
      });
      if (!allowed)
        return json({ error: "יותר מדי ניסיונות. נסי שוב מאוחר יותר." }, 429);
      const started = performance.now();
      const passwordValid = await bcrypt.compare(
        input.password,
        this.env.OWNER_PASSWORD_HASH,
      );
      this.metrics = {
        verifications: this.metrics.verifications + 1,
        verificationElapsedMs: performance.now() - started,
      };
      if (
        input.username.trim().toLowerCase() !==
          this.env.OWNER_USERNAME.toLowerCase() ||
        !passwordValid
      )
        return json(
          { error: "שם המשתמש או הסיסמה אינם נכונים. נסי שוב." },
          401,
        );
      const token = random();
      const session: Session = {
        expires: now + sessionLifetime(this.env),
        csrf: random(),
        version: this.env.CREDENTIAL_VERSION,
      };
      await this.state.storage.put("session:" + (await digest(token)), session);
      return json({ token, csrf: session.csrf, expires: session.expires });
    }
    if (path === "/metrics") return json(this.metrics);
    if (typeof input.token !== "string" || !/^[a-f0-9]{64}$/.test(input.token))
      return json({ error: "נדרשת כניסה" }, 401);
    const key = "session:" + (await digest(input.token));
    const session = await this.state.storage.get<Session>(key);
    if (
      !session ||
      session.expires <= Date.now() ||
      session.version !== this.env.CREDENTIAL_VERSION
    )
      return json({ error: "נדרשת כניסה" }, 401);
    if (path === "/logout") {
      await this.state.storage.delete(key);
      return json({ ok: true });
    }
    return json({ csrf: session.csrf, expires: session.expires });
  }
}

const app = new Hono<{ Bindings: Env; Variables: { session: Session } }>();
function auth(env: Env, path: string, input: unknown) {
  return env.AUTH.get(env.AUTH.idFromName("atelier-owner")).fetch(
    new Request("https://auth.local" + path, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}
app.use("*", async (c, next) => {
  if (!allowedHost(c.env, c.req.url))
    return c.text("Admin host unavailable", 404);
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "same-origin");
  c.header("X-Frame-Options", "DENY");
  const publicPath =
    c.req.path === "/login" ||
    c.req.path === "/login/" ||
    c.req.path.startsWith("/_next/") ||
    c.req.path.startsWith("/demo/") ||
    c.req.path === "/favicon.ico";
  if (c.req.path === "/api/login") {
    if (
      c.req.method !== "POST" ||
      c.req.header("Origin") !== c.env.ADMIN_ORIGIN ||
      !c.req.header("Content-Type")?.startsWith("application/json")
    )
      return c.json({ error: "בקשה לא מורשית" }, 403);
  } else if (!publicPath) {
    const response = await auth(c.env, "/session", {
      token: getCookie(c, cookie),
    });
    if (!response.ok)
      return c.req.path.startsWith("/api/")
        ? c.json({ error: "נדרשת כניסה" }, 401)
        : c.redirect("/login/");
    c.set("session", (await response.json()) as Session);
    if (
      !["GET", "HEAD"].includes(c.req.method) &&
      (c.req.header("Origin") !== c.env.ADMIN_ORIGIN ||
        c.req.header("X-CSRF-Token") !== c.get("session").csrf)
    )
      return c.json({ error: "בקשה לא מורשית" }, 403);
  }
  await next();
});
// Read-only Stage 1 rejects mutations before parsing images/JSON or contacting
// Sanity. Authentication and CSRF checks above still apply to these requests.
app.use("/api/*", async (c, next) => {
  // Temporary controlled activation: owner authentication and CSRF have already
  // passed. Reject every other content write before parsing or contacting Sanity.
  if (c.env.ADMIN_QA_PRODUCT_ID && !["GET", "HEAD"].includes(c.req.method)) {
    const productPath = "/api/products/" + c.env.ADMIN_QA_PRODUCT_ID;
    if ((c.req.path.startsWith("/api/products/") && c.req.path !== productPath) ||
        c.req.path.startsWith("/api/about") || c.req.path.startsWith("/api/categories") || c.req.path.startsWith("/api/catalog-options"))
      return c.json({ error: "בשלב הבדיקה ניתן לשנות רק את מוצר ה־QA המאושר." }, 403);
  }
  if (
    c.env.SANITY_MODE !== "fixture" &&
    c.env.SANITY_ALLOW_PRODUCTION_WRITES !== "approved" &&
    !(c.req.path === "/api/uploads" && uploadRetestActive(c.env)) &&
    !["GET", "HEAD"].includes(c.req.method) &&
    /^\/api\/(products(?:\/|$)|categories(?:\/|$)|uploads(?:\/|$)|catalog-options(?:\/|$)|about(?:\/|$))/.test(c.req.path)
  ) return c.json({ error: "הקטלוג זמין לקריאה בלבד. שמירה והעלאת תמונות אינן פעילות." }, 403);
  await next();
});
app.post("/api/login", async (c) => {
  if (Number(c.req.header("Content-Length") ?? 0) > 2048)
    return c.json({ error: "בקשה גדולה מדי" }, 413);
  const reader = c.req.raw.body?.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  if (reader)
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 2048) {
        await reader.cancel();
        return c.json({ error: "בקשה גדולה מדי" }, 413);
      }
      chunks.push(part.value);
    }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const text = new TextDecoder().decode(bytes);
  let input;
  try {
    input = JSON.parse(text);
  } catch {
    return c.json({ error: "בקשה לא תקינה" }, 400);
  }
  const response = await auth(c.env, "/login", {
    username: input?.username,
    password: input?.password,
    ip: c.req.header("CF-Connecting-IP") ?? "loopback",
  });
  const result = (await response.json()) as {
    token?: string;
    csrf?: string;
    error?: string;
    expires?: number;
  };
  if (!response.ok || !result.token)
    return c.json({ error: result.error }, response.status as 400);
  setCookie(c, cookie, result.token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: Math.max(1, Math.ceil(((result.expires ?? Date.now()) - Date.now()) / 1000)),
  });
  return c.json({ csrf: result.csrf });
});
app.get("/api/session", (c) => c.json({ csrf: c.get("session").csrf, expires: c.get("session").expires }));
app.post("/api/logout", async (c) => {
  const response = await auth(c.env, "/logout", {
    token: getCookie(c, cookie),
  });
  if (!response.ok) return c.json({ error: "היציאה נכשלה. נסי שוב." }, 500);
  deleteCookie(c, cookie, { secure: true, path: "/" });
  return c.json({ ok: true });
});
app.get("/api/proof/metrics", async (c) => {
  if (c.env.LOCAL_COMPAT_PROOF !== "1")
    return c.json({ error: "הפעולה אינה זמינה" }, 404);
  const response = await auth(c.env, "/metrics", {});
  return c.json(await response.json());
});
async function body(request: Request) {
  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    throw new ApiError(415, "בקשה לא תקינה");
  return (await readJson(new Response(request.body), 65536, 400)) as Record<
    string,
    unknown
  >;
}
app.get("/api/about", async (c) => c.json(await readAbout(c.env)));
app.post("/api/about", async (c) => c.json(await saveAbout(c.env, await body(c.req.raw))));
app.get("/api/catalog-options", async (c) => c.json(await readOptions(c.env)));
app.post("/api/catalog-options", async (c) => c.json(await changeOption(c.env, await body(c.req.raw))));
app.get("/api/catalog", async (c) =>
  c.json(catalogView(await catalog(c.env), c.env)),
);
app.get("/api/products/:id/preview", async (c) =>
  c.json(view(await catalog(c.env), id(c.req.param("id")))),
);
app.post("/api/products/:id", async (c) => {
  const input = await body(c.req.raw);
  return c.json(
    await saveProduct(
      c.env,
      id(c.req.param("id")),
      input.product as Record<string, unknown>,
      input.action,
    ),
  );
});
app.post("/api/categories", async (c) =>
  c.json(await saveCategories(c.env, (await body(c.req.raw)).categories)),
);
app.post("/api/uploads", async (c) => {
  const diagnostics = uploadRetestActive(c.env);
  const result = await uploadImage(c.req.raw, c.env, diagnostics ? (transport) => {
    // Explicitly allowlisted test telemetry. Never log request headers or body.
    console.log(JSON.stringify({ event: "atelier-upload-retest", phase: "transport",
      transport, declaredBytes: Number(c.req.header("Content-Length")) || null }));
  } : undefined);
  if (diagnostics) console.log(JSON.stringify({ event: "atelier-upload-retest",
    phase: "accepted", assetId: result.assetId, bytes: result.bytes }));
  return c.json(result);
});
app.all("/api/*", (c) => c.json({ error: "הפעולה אינה זמינה" }, 405));
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));
app.onError((error) =>
  json(
    {
      error:
        error instanceof ApiError ? error.message : "הפעולה נכשלה. נסי שוב.",
    },
    error instanceof ApiError ? error.status : 500,
  ),
);
export default app;
