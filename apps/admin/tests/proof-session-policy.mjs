import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
const require = createRequire(import.meta.url);
const vars = new URL("../worker/.dev.vars", import.meta.url);
const original = await readFile(vars, "utf8");
const account = JSON.parse(
  await readFile("/private/tmp/atelier-local-proof-account.json", "utf8"),
);
const session = JSON.parse(
  await readFile("/private/tmp/atelier-local-proof-session.json", "utf8"),
);
const base = "http://127.0.0.1:3002";
let child;
async function stop() {
  if (!child) return;
  const exit = new Promise((r) => child.once("exit", r));
  child.kill("SIGINT");
  await exit;
  child = undefined;
}
async function start() {
  child = spawn(
    process.execPath,
    [
      require.resolve("wrangler"),
      "dev",
      "--config",
      "worker/wrangler.local.jsonc",
      "--local",
      "--ip",
      "127.0.0.1",
      "--port",
      "3002",
      "--inspector-port",
      "9229",
      "--persist-to",
      ".wrangler/proof-state",
    ],
    {
      cwd: new URL("../", import.meta.url),
      env: {
        ...process.env,
        WRANGLER_LOG_PATH: "/private/tmp/atelier-session-policy.log",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let ready = false;
  child.stdout.on("data", (data) => {
    if (data.toString().includes("Ready on")) ready = true;
  });
  child.stderr.on("data", () => {});
  for (let n = 0; n < 100; n++) {
    if (ready) return;
    if (child.exitCode !== null)
      throw new Error("Local Worker exited before readiness");
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Local Worker readiness timeout");
}
const results = [];
try {
  const rotated =
    original.replace(
      /^CREDENTIAL_VERSION=.*$/m,
      "CREDENTIAL_VERSION=" + randomBytes(16).toString("hex"),
    ) + "LOCAL_SESSION_TTL_MS=1200\n";
  await writeFile(vars, rotated, { mode: 0o600 });
  await start();
  assert.equal(
    (
      await fetch(base + "/api/session", {
        headers: { Cookie: session.cookie },
      })
    ).status,
    401,
  );
  results.push("Credential version rotation rejects an existing session");
  const r = await fetch(base + "/api/login", {
    method: "POST",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      "CF-Connecting-IP": "expiry-proof",
    },
    body: JSON.stringify(account),
  });
  assert.equal(r.status, 200);
  const shortCookie = r.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (await fetch(base + "/api/session", { headers: { Cookie: shortCookie } }))
      .status,
    200,
  );
  await new Promise((r) => setTimeout(r, 1600));
  assert.equal(
    (await fetch(base + "/api/session", { headers: { Cookie: shortCookie } }))
      .status,
    401,
  );
  results.push(
    "Server rejects an expired session using the same expiry check (1.2s local test TTL)",
  );
  await stop();
  await writeFile(vars, original, { mode: 0o600 });
  await start();
  assert.equal(
    (
      await fetch(base + "/api/session", {
        headers: { Cookie: session.cookie },
      })
    ).status,
    200,
  );
  results.push(
    "Original session persists after restoring local credential version and restarting",
  );
  assert.equal(
    (
      await fetch(base + "/api/logout", {
        method: "POST",
        headers: { Origin: base, Cookie: session.cookie },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/api/logout", {
        method: "POST",
        headers: {
          Origin: base,
          Cookie: session.cookie,
          "X-CSRF-Token": session.csrf,
        },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await fetch(base + "/api/session", {
        headers: { Cookie: session.cookie },
      })
    ).status,
    401,
  );
  results.push("Logout requires CSRF and revokes the server-side session");
  const concurrent = await Promise.all(
    Array.from({ length: 6 }, () =>
      fetch(base + "/api/login", {
        method: "POST",
        headers: {
          Origin: base,
          "Content-Type": "application/json",
          "CF-Connecting-IP": "concurrent-limit",
        },
        body: JSON.stringify({
          username: account.username,
          password: "invalid",
        }),
      }),
    ),
  );
  assert.deepEqual(
    concurrent.map((r) => r.status).sort(),
    [401, 401, 401, 401, 401, 429],
  );
  results.push(
    "Six concurrent wrong-password attempts produce five 401s and one 429",
  );
  await writeFile(
    new URL(
      "../../../docs/admin-screenshots/local-proof-session-policy.json",
      import.meta.url,
    ),
    JSON.stringify({ checks: results }, null, 2) + "\n",
  );
  for (const result of results) console.log("PASS", result);
} finally {
  await stop();
  await writeFile(vars, original, { mode: 0o600 });
}
