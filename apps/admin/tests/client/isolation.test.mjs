import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { setTimeout as pause } from "node:timers/promises";
import { client } from "./helpers.mjs";
const require = createRequire(import.meta.url),
  esbuild = createRequire(require.resolve("wrangler"))("esbuild");
async function load(path) {
  const result = await esbuild.build({
    entryPoints: [new URL(path, import.meta.url).pathname],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
  });
  return import(
    "data:text/javascript;base64," +
      Buffer.from(result.outputFiles[0].contents).toString("base64")
  );
}
const { default: app, OwnerAuth } = await load("../../worker/index.ts");
const { connection, query, mutate } = await load("../../worker/sanity.ts");
const { uploadImage } = await load("../../worker/uploads.ts");
const bcrypt = require("bcryptjs");
function storage() {
  const rows = new Map();
  let alarm = null;
  const s = {
    get: async (k) => rows.get(k),
    put: async (k, v) => {
      rows.set(k, v);
    },
    delete: async (k) => rows.delete(k),
    getAlarm: async () => alarm,
    setAlarm: async (value) => {
      alarm = value;
    },
    list: async ({ prefix = "", limit = Infinity } = {}) =>
      new Map([...rows].filter(([k]) => k.startsWith(prefix)).slice(0, limit)),
    transaction: async (fn) => fn(s),
  };
  return s;
}
async function tenant(slug, password) {
  const m = client(slug);
  const env = {
    LOCAL_COMPAT_PROOF: "0",
    ADMIN_REMOTE_ENABLED: "approved",
    ADMIN_ORIGIN: m.worker.adminOrigin,
    OWNER_USERNAME: slug,
    OWNER_PASSWORD_HASH: await bcrypt.hash(password, 12),
    CREDENTIAL_VERSION: slug + "-credential-v1",
    SANITY_MODE: "production",
    SANITY_PROJECT_ID: m.sanity.projectId,
    SANITY_DATASET: m.sanity.dataset,
    SANITY_API_VERSION: m.sanity.apiVersion,
    SANITY_API_TOKEN: slug + "-fixture-only-token",
    SANITY_ALLOW_PRODUCTION_WRITES: "disabled",
    ASSETS: { fetch: async () => new Response("static fixture") },
  };
  const auth = new OwnerAuth({ storage: storage() }, env);
  env.AUTH = {
    idFromName: () => slug,
    get: () => ({ fetch: (req) => auth.fetch(req) }),
  };
  return { m, env };
}
async function request(t, path, { cookie, csrf, origin, body } = {}) {
  return app.fetch(
    new Request(t.env.ADMIN_ORIGIN + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Origin: origin ?? t.env.ADMIN_ORIGIN,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        "Content-Type": "application/json",
        "CF-Connecting-IP": "unit-isolation",
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
    t.env,
  );
}
test("actual OwnerAuth + Worker: separate storage sessions, passwords, credentials, host/Origin/CSRF and initial write gate", async () => {
  const a = await tenant("alpha", "alpha-fixture-password"),
    b = await tenant("beta", "beta-fixture-password");
  const original = globalThis.fetch;
  let upstream = 0;
  globalThis.fetch = async () => {
    upstream++;
    throw new Error("Security rejection must precede CMS network");
  };
  try {
    const login = await request(a, "/api/login", {
      body: { username: "alpha", password: "alpha-fixture-password" },
    });
    assert.equal(login.status, 200);
    const data = await login.json(),
      cookie = login.headers.get("Set-Cookie").split(";")[0];
    assert.match(login.headers.get("Set-Cookie"), /Secure/);
    assert.match(login.headers.get("Set-Cookie"), /HttpOnly/);
    assert.match(login.headers.get("Set-Cookie"), /SameSite=Lax/);
    assert.ok(!login.headers.get("Set-Cookie").includes("Domain="));
    assert.equal((await request(a, "/api/session", { cookie })).status, 200);
    assert.equal((await request(b, "/api/session", { cookie })).status, 401);
    assert.equal(
      (
        await request(b, "/api/login", {
          body: { username: "beta", password: "alpha-fixture-password" },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await request(a, "/api/login", {
          origin: b.env.ADMIN_ORIGIN,
          body: { username: "alpha", password: "alpha-fixture-password" },
        })
      ).status,
      403,
    );
    for (const path of [
      "/api/products/product-one",
      "/api/uploads",
      "/api/about",
      "/api/categories",
      "/api/catalog-options",
    ]) {
      assert.equal(
        (
          await request(a, path, {
            cookie,
            csrf: data.csrf,
            origin: b.env.ADMIN_ORIGIN,
            body: {},
          })
        ).status,
        403,
      );
      assert.equal(
        (await request(a, path, { cookie, csrf: "bad", body: {} })).status,
        403,
      );
      assert.equal(
        (await request(a, path, { cookie, csrf: data.csrf, body: {} })).status,
        403,
        "new client writes must stay disabled",
      );
      assert.equal(
        (await request(b, path, { cookie, csrf: data.csrf, body: {} })).status,
        401,
      );
    }
    assert.equal(
      (
        await app.fetch(
          new Request(b.env.ADMIN_ORIGIN + "/api/session", {
            headers: { Cookie: cookie },
          }),
          a.env,
        )
      ).status,
      404,
    );
    const changed = { ...a.env, CREDENTIAL_VERSION: "new-version" }; // Existing DO is per-env deployment; direct new instance tests version revocation against the same storage.
    const sameStore = storage(),
      old = new OwnerAuth({ storage: sameStore }, a.env);
    const signed = await (
      await old.fetch(
        new Request("https://auth.local/login", {
          method: "POST",
          body: JSON.stringify({
            username: "alpha",
            password: "alpha-fixture-password",
            ip: "unit",
          }),
        }),
      )
    ).json();
    const rotated = new OwnerAuth({ storage: sameStore }, changed);
    assert.equal(
      (
        await rotated.fetch(
          new Request("https://auth.local/session", {
            method: "POST",
            body: JSON.stringify({ token: signed.token }),
          }),
        )
      ).status,
      401,
    );
    assert.equal(upstream, 0);
  } finally {
    globalThis.fetch = original;
  }
});
test("actual CMS reads/mutations and streaming uploads are pinned to each server-side client target", async () => {
  const original = globalThis.fetch,
    originalFixed = globalThis.FixedLengthStream;
  const seen = [];
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  globalThis.FixedLengthStream = class {
    constructor(expected) {
      let bytes = 0;
      const stream = new TransformStream({
        transform(chunk, c) {
          bytes += chunk.byteLength;
          if (bytes > expected) throw new Error("length");
          c.enqueue(chunk);
        },
        flush() {
          if (bytes !== expected) throw new Error("length");
        },
      });
      this.readable = stream.readable;
      this.writable = stream.writable;
    }
  };
  try {
    for (const slug of ["alpha", "beta"]) {
      const m = client(slug),
        env = {
          SANITY_MODE: "production",
          SANITY_PROJECT_ID: m.sanity.projectId,
          SANITY_DATASET: m.sanity.dataset,
          SANITY_API_VERSION: m.sanity.apiVersion,
          SANITY_API_TOKEN: slug + "-mock-token",
          SANITY_ALLOW_PRODUCTION_WRITES: "approved",
        };
      const assetId = "image-" + "a".repeat(40) + "-1x1-png";
      let crossAsset = false;
      globalThis.fetch = async (url, options) => {
        seen.push(String(url));
        assert.equal(
          new URL(url).hostname,
          m.sanity.projectId + ".api.sanity.io",
        );
        assert.equal(
          options.headers.Authorization,
          "Bearer " + slug + "-mock-token",
        );
        if (String(url).includes("/data/query/"))
          return Response.json({ result: [] });
        if (String(url).includes("/data/mutate/"))
          return Response.json({ transactionId: "fixture" });
        assert.ok(String(url).endsWith("/assets/images/" + m.sanity.dataset));
        await new Response(options.body).arrayBuffer();
        await pause(0);
        return Response.json({
          document: {
            _id: assetId,
            _type: "sanity.imageAsset",
            size: png.length,
            mimeType: "image/png",
            url: `https://cdn.sanity.io/images/${crossAsset ? "3ahm0828" : m.sanity.projectId}/${m.sanity.dataset}/${"a".repeat(40)}-1x1.png`,
            metadata: { dimensions: { width: 1, height: 1 } },
          },
        });
      };
      await query(env, "*[]", {
        projectId: "3ahm0828",
        dataset: "another-client",
      });
      await mutate(env, [
        {
          create: {
            _id: "unit",
            _type: "product",
            SANITY_PROJECT_ID: "3ahm0828",
          },
        },
      ]);
      const req = () =>
        new Request("https://admin.invalid/api/uploads", {
          method: "POST",
          headers: {
            "Content-Type": "image/png",
            "Content-Length": String(png.length),
          },
          body: png,
        });
      assert.ok(
        (await uploadImage(req(), env)).src.includes(
          "/" + m.sanity.projectId + "/",
        ),
      );
      crossAsset = true;
      await assert.rejects(uploadImage(req(), env), (e) => e.status === 502);
      assert.equal(
        connection(env).assetPrefix,
        `https://cdn.sanity.io/images/${m.sanity.projectId}/${m.sanity.dataset}/`,
      );
    }
    assert.ok(seen.length === 8);
    assert.ok(
      seen.every((url) => new URL(url).hostname !== "3ahm0828.api.sanity.io"),
    );
  } finally {
    globalThis.fetch = original;
    globalThis.FixedLengthStream = originalFixed;
  }
});
