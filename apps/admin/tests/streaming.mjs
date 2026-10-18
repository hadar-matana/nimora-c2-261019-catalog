import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  sharp = createRequire(require.resolve("next"))("sharp");
const { cookie, csrf } = JSON.parse(
  await readFile("/private/tmp/atelier-integration-session.json", "utf8"),
);
const base = "http://127.0.0.1:3002",
  fixture = "http://127.0.0.1:3003";
let target = base,
  internal = {};
if (process.env.DIRECT_WORKER_VERIFY === "1") {
  const log = await readFile(process.env.UPLOAD_PROFILE_LOG ?? "/private/tmp/atelier-integration.log", "utf8");
  const line = log
    .split("\n")
    .findLast(
      (l) =>
        l.includes("handleProxyControllerIncomingMessage") &&
        l.includes('"reloadComplete"') &&
        l.includes('"userWorkerUrl"'),
    );
  const config = JSON.parse(line.slice(line.indexOf("{"))).proxyData;
  target =
    config.userWorkerUrl.protocol +
    "//" +
    config.userWorkerUrl.hostname +
    ":" +
    config.userWorkerUrl.port;
  internal = config.headers;
}
const headers = {
  ...internal,
  Cookie: cookie,
  Origin: base,
  "X-CSRF-Token": csrf,
};
const environment = await (
  await fetch(base + "/api/catalog", { headers: { Cookie: cookie } })
).json();
assert.equal(
  environment.environment,
  "fixture",
  "Upload tests refuse real Sanity, even if live writes are enabled",
);
const image = await readFile(
  new URL("../public/demo/dress.png", import.meta.url),
);
const max = Buffer.alloc(10 * 1024 * 1024);
image.copy(max);
const checks = [],
  benchmarks = [];
const state = async () => await (await fetch(fixture + "/__state")).json();
async function control(body) {
  await fetch(fixture + "/__control", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
async function upload(data, type = "image/png", extra = {}) {
  return fetch(target + "/api/uploads", {
    method: "POST",
    // Rejected bodies can close local workerd's HTTP/1 connection while Node's
    // pool still considers it reusable. Use independent test connections,
    // matching the browser's retry/reconnection boundary without retrying writes.
    headers: { ...headers, Connection: "close", "Content-Type": type, ...extra },
    body: data,
    ...(data instanceof ReadableStream ? { duplex: "half" } : {}),
  });
}
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS", name);
}
await check("Upload authentication and CSRF reject before upstream body handling", async () => {
  const before = (await state()).events.filter(e => e.type === "upload-first-chunk").length;
  for (const [extra, status] of [
    [{ Cookie: "" }, 401],
    [{ Cookie: "__Host-atelier_session=invalid" }, 401],
    [{ "X-CSRF-Token": "" }, 403],
    [{ "X-CSRF-Token": "invalid" }, 403],
    [{ Origin: "https://untrusted.invalid" }, 403],
  ]) {
    const r = await upload(image, "image/png", extra);
    assert.equal(r.status, status);
    await r.text();
  }
  assert.equal((await state()).events.filter(e => e.type === "upload-first-chunk").length, before);
});
await check(
  "Chunked body is forwarded upstream before the browser finishes sending",
  async () => {
    const start = Date.now();
    let index = 0,
      completedAt;
    const body = new ReadableStream({
      async pull(c) {
        if (index >= image.length) {
          completedAt = Date.now();
          c.close();
          return;
        }
        const end = index === 0 ? 12 : Math.min(index + 65536, image.length);
        c.enqueue(image.subarray(index, end));
        index = end;
        await new Promise((r) => setTimeout(r, 3));
      },
    });
    const r = await upload(body);
    assert.equal(r.status, 200);
    const value = await r.json();
    assert.equal(value.bytes, image.length);
    const first = (await state()).events.find(
      (e) => e.type === "upload-first-chunk" && e.at >= start,
    );
    assert.ok(
      first && first.at < completedAt,
      "upstream must start before request EOF",
    );
  },
);
await check(
  "Real PNG JPEG and WebP accepted; unsupported types and mismatched signatures rejected",
  async () => {
    for (const [type, data] of [
      ["image/png", image],
      ["image/jpeg", await sharp(image).jpeg().toBuffer()],
      ["image/webp", await sharp(image).webp().toBuffer()],
    ]) {
      const r = await upload(data, type);
      assert.equal(r.status, 200);
      await r.json();
    }
    for (const type of ["image/svg+xml", "image/heic"]) {
      const r = await upload(image, type);
      assert.equal(r.status, 415);
      await r.text();
    }
    for (const type of ["image/png", "image/jpeg", "image/webp"]) {
      const r = await upload(Buffer.alloc(128), type);
      assert.equal(r.status, 415);
      await r.text();
    }
    const truncated = await upload(image.subarray(0, 5));
    assert.equal(truncated.status, 415);
    await truncated.text();
  },
);
await check(
  "10MiB accepted; larger fixed-length and unknown-length bodies rejected",
  async () => {
    const r = await upload(max);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).bytes, max.length);
    const over = await upload(Buffer.alloc(max.length + 1));
    assert.equal(over.status, 413);
    await over.text();
    let n = 0;
    const chunks = new ReadableStream({
      pull(c) {
        if (n++ === 0) c.enqueue(image.subarray(0, 12));
        else if (n < 163) c.enqueue(new Uint8Array(65536));
        else c.close();
      },
    });
    const chunked = await upload(chunks);
    assert.equal(chunked.status, 413);
    await chunked.text();
  },
);
await check(
  "Upstream errors, early success and malformed metadata never report upload success",
  async () => {
    for (const status of [401, 429, 500]) {
      await control({ failNext: { operation: "upload", status } });
      const r = await upload(image);
      assert.equal(r.status, 502);
      assert.ok(!(await r.text()).includes("private-fixture"));
    }
    for (const mode of ["early", "invalid"]) {
      await control({ assetResponse: mode });
      const r = await upload(image);
      assert.equal(r.status, 502);
      await r.text();
    }
  },
);
await check(
  "Known and unknown-length cancellation do not create partial assets",
  async () => {
    const before = (await state()).documents.filter(
      (d) => d._type === "sanity.imageAsset",
    ).length;
    for (const knownLength of [false, true]) {
    const abort = new AbortController();
    let index = 0;
    const body = new ReadableStream({
      async pull(c) {
        if (abort.signal.aborted) {
          c.close();
          return;
        }
        c.enqueue(
          index++ === 0 ? image.subarray(0, 12) : image.subarray(12, 65536),
        );
        await new Promise((r) => setTimeout(r, 20));
      },
    });
    const timer = setTimeout(() => abort.abort(), 90);
    await assert.rejects(
      fetch(target + "/api/uploads", {
        method: "POST",
        headers: { ...headers, "Content-Type": "image/png", ...(knownLength ? { "Content-Length": String(image.length) } : {}) },
        body,
        duplex: "half",
        signal: abort.signal,
      }),
    );
    clearTimeout(timer);
    await new Promise((r) => setTimeout(r, 200));
    }
    assert.equal(
      (await state()).documents.filter((d) => d._type === "sanity.imageAsset")
        .length,
      before,
    );
  },
);
await check(
  "Three concurrent maximum-size uploads complete with valid references",
  async () => {
    const responses = await Promise.all(
      Array.from({ length: 3 }, () => upload(max)),
    );
    for (const r of responses) {
      assert.equal(r.status, 200);
      assert.equal((await r.json()).bytes, max.length);
    }
  },
);
for (const [label, data] of [
  ["2.2MB real PNG", image],
  ["10MiB padded PNG", max],
]) {
  const timings = [];
  for (let n = 0; n < 10; n++) {
    const start = performance.now();
    const r = await upload(data);
    assert.equal(r.status, 200);
    await r.json();
    timings.push(performance.now() - start);
  }
  benchmarks.push({
    scenario: label,
    requests: 10,
    requestWallMs: {
      average: timings.reduce((a, b) => a + b, 0) / 10,
      max: Math.max(...timings),
    },
    qualification:
      "Request elapsed time includes local fixture decode/hash/I/O, not Worker CPU or remote billed CPU.",
  });
}
const result = {
  runtime:
    "local workerd; streaming handler; authenticated isolated Sanity HTTP fixture",
  path: target === base ? "Wrangler proxy" : "Direct local workerd",
  checks,
  benchmarks,
  buffering:
    "Outer application copies only a 12-byte signature and forwards native chunks under pull/backpressure. Runtime/native/network buffers and a single incoming chunk are additional and not a remote peak-memory certification.",
  limitations:
    "10MiB PNG fixture contains trailing padding accepted by local Sharp. Real Sanity image acceptance, remote CPU/128MiB enforcement and billing remain untested.",
};
await writeFile(
  new URL(
    "../../../docs/admin-screenshots/integration-streaming.json",
    import.meta.url,
  ),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify({ benchmarks }, null, 2));
