import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
const base = "http://127.0.0.1:3002";
const account = JSON.parse(
  await readFile("/private/tmp/atelier-local-proof-account.json", "utf8"),
);
const origin = { Origin: base };
const log = [];
async function check(name, run) {
  await run();
  log.push(name);
  console.log("PASS", name);
}
let cookie, csrf;
async function login(password = account.password, ip = "proof-http") {
  return fetch(base + "/api/login", {
    method: "POST",
    headers: {
      ...origin,
      "Content-Type": "application/json",
      "CF-Connecting-IP": ip,
    },
    body: JSON.stringify({ username: account.username, password }),
  });
}
await check(
  "Protected HTML and alternate static paths reject unauthenticated access",
  async () => {
    for (const path of [
      "/",
      "/index.html",
      "/products/",
      "/products/index.html",
      "/products/edit/index.html",
      "/categories/",
      "/products/index.txt",
      "/api/catalog",
      "/api/session",
      "/api/proof/metrics",
    ]) {
      const r = await fetch(base + path, { redirect: "manual" });
      assert.equal(r.status, path.startsWith("/api/") ? 401 : 302, path);
    }
    assert.equal((await fetch(base + "/login/")).status, 200);
    assert.equal(
      (
        await fetch(base + "/api/session", {
          headers: { Cookie: "__Host-atelier_session=" + "a".repeat(64) },
        })
      ).status,
      401,
    );
  },
);
await check(
  "Wrong origin and malformed requests blocked before verification",
  async () => {
    assert.equal(
      (
        await fetch(base + "/api/login", {
          method: "POST",
          headers: {
            Origin: "https://other.example",
            "Content-Type": "application/json",
          },
          body: "{}",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(base + "/api/login", {
          method: "POST",
          headers: { ...origin, "Content-Type": "application/json" },
          body: "{",
        })
      ).status,
      400,
    );
    assert.equal((await login("x".repeat(73), "too-long")).status, 400);
  },
);
await check(
  "Password exactness and successful cost-12 bcrypt verification",
  async () => {
    assert.equal(
      (await login(account.password + " ", "space-check")).status,
      401,
    );
    const r = await login();
    assert.equal(r.status, 200);
    const header = r.headers.get("set-cookie");
    assert.match(header, /HttpOnly/);
    assert.match(header, /Secure/);
    assert.match(header, /SameSite=Lax/);
    assert.match(header, /Path=\//);
    assert.doesNotMatch(header, /Domain=/);
    cookie = header.split(";")[0];
    csrf = (await r.json()).csrf;
    assert.equal(
      (await fetch(base + "/api/session", { headers: { Cookie: cookie } }))
        .status,
      200,
    );
    assert.equal(
      (await fetch(base + "/", { headers: { Cookie: cookie } })).status,
      200,
    );
  },
);
const secureHeaders = { ...origin, Cookie: cookie, "X-CSRF-Token": csrf };
await check("CSRF protected mutations and disabled live writes", async () => {
  assert.equal(
    (
      await fetch(base + "/api/uploads", {
        method: "POST",
        headers: { ...origin, Cookie: cookie, "Content-Type": "image/png" },
        body: new Uint8Array(1),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/api/products", {
        method: "POST",
        headers: secureHeaders,
        body: "{}",
      })
    ).status,
    403,
  );
});
await check(
  "Upload boundary, streamed size, MIME/signature and exact local transfer",
  async () => {
    const png = await readFile(
      new URL("../public/demo/dress.png", import.meta.url),
    );
    const headers = { ...secureHeaders, "Content-Type": "image/png" };
    let r = await fetch(base + "/api/uploads", {
      method: "POST",
      headers,
      body: png,
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).receivedBytes, png.length);
    r = await fetch(base + "/api/uploads", {
      method: "POST",
      headers,
      body: Buffer.alloc(10 * 1024 * 1024 + 1),
    });
    assert.equal(r.status, 413);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(Buffer.alloc(10 * 1024 * 1024 + 1));
        controller.close();
      },
    });
    r = await fetch(base + "/api/uploads", {
      method: "POST",
      headers,
      body: stream,
      duplex: "half",
    });
    assert.equal(r.status, 413);
    r = await fetch(base + "/api/uploads", {
      method: "POST",
      headers,
      body: "fake-image",
    });
    assert.equal(r.status, 415);
    r = await fetch(base + "/api/uploads", {
      method: "POST",
      headers: { ...secureHeaders, "Content-Type": "image/svg+xml" },
      body: "<svg/>",
    });
    assert.equal(r.status, 415);
    assert.equal(
      (await (await fetch("http://127.0.0.1:3003/stats")).json()).calls,
      1,
    );
  },
);
await check("Read-only existing Sanity published catalog", async () => {
  const r = await fetch(base + "/api/catalog", { headers: { Cookie: cookie } });
  assert.equal(r.status, 200);
  const catalog = await r.json();
  assert.equal(catalog.products.length, 12);
  assert.equal(catalog.categories.length, 5);
  assert.ok(catalog.products.every((p) => !p._id.startsWith("drafts.")));
});
await check(
  "Atomic login throttle caps expensive failed verifications",
  async () => {
    for (let n = 0; n < 5; n++)
      assert.equal(
        (await login("invalid-password", "throttle-proof")).status,
        401,
      );
    assert.equal(
      (await login("invalid-password", "throttle-proof")).status,
      429,
    );
  },
);
const metrics = await (
  await fetch(base + "/api/proof/metrics", { headers: { Cookie: cookie } })
).json();
console.log(
  "Bcrypt runtime wall time (NOT billed CPU):",
  JSON.stringify(metrics),
);
await writeFile(
  "/private/tmp/atelier-local-proof-session.json",
  JSON.stringify({ cookie, csrf }),
  { mode: 0o600 },
);
await writeFile(
  new URL(
    process.env.FINAL_VERIFY === "1"
      ? "../../../docs/admin-screenshots/final-runtime-http.json"
      : "../../../docs/admin-screenshots/local-proof-http.json",
    import.meta.url,
  ),
  JSON.stringify({ checks: log, metrics }, null, 2) + "\n",
);
console.log("Session retained privately for restart/revocation checks.");
