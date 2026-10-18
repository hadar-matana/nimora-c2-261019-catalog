import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next"))("sharp");
const { cookie, csrf } = JSON.parse(
  await readFile("/private/tmp/atelier-local-proof-session.json", "utf8"),
);
const base = "http://127.0.0.1:3002";
let target = base,
  internalHeaders = {};
if (process.env.DIRECT_WORKER_VERIFY === "1") {
  const log = await readFile(
    "/private/tmp/atelier-final-verification.log",
    "utf8",
  );
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
  internalHeaders = config.headers;
}
const headers = {
  ...internalHeaders,
  Origin: base,
  Cookie: cookie,
  "X-CSRF-Token": csrf,
};
const png = await readFile(
  new URL("../public/demo/dress.png", import.meta.url),
);
const images = [
  { type: "image/png", data: png },
  { type: "image/jpeg", data: await sharp(png).jpeg().toBuffer() },
  { type: "image/webp", data: await sharp(png).webp().toBuffer() },
];
const checks = [];
async function upload(type, data, extra = {}) {
  return fetch(target + "/api/uploads", {
    method: "POST",
    headers: { ...headers, "Content-Type": type, ...extra },
    body: data,
  });
}
async function control(status) {
  assert.equal(
    (
      await fetch("http://127.0.0.1:3003/fixture/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
    ).status,
    200,
  );
}
try {
  await control(200);
  for (const image of images) {
    const meta = await sharp(image.data).metadata();
    assert.ok(meta.width > 0 && meta.height > 0);
    const r = await upload(image.type, image.data);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).receivedBytes, image.data.length);
    checks.push({
      test: "Real encoder-valid " + image.type,
      bytes: image.data.length,
      width: meta.width,
      height: meta.height,
      status: 200,
    });
  }
  for (const type of [
    "image/heic",
    "image/svg+xml",
    "application/octet-stream",
  ]) {
    assert.equal((await upload(type, png)).status, 415);
    checks.push({ test: "Unsupported " + type, status: 415 });
  }
  assert.equal((await upload("image/jpeg", png)).status, 415);
  checks.push({ test: "JPEG declaration with PNG signature", status: 415 });
  const max = Buffer.alloc(10 * 1024 * 1024);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(max);
  const responses = await Promise.all(
    Array.from({ length: 3 }, () => upload("image/png", max)),
  );
  assert.ok(responses.every((r) => r.status === 200));
  for (const r of responses)
    assert.equal((await r.json()).receivedBytes, max.length);
  checks.push({
    test: "Three concurrent maximum-size transports",
    bytesPerRequest: max.length,
    statuses: responses.map((r) => r.status),
    qualification:
      "Synthetic signature-valid payload, not a valid 10MiB decoded image; local memory behavior is not a remote memory-limit certification.",
  });
  const chunked = new ReadableStream({
    start(c) {
      for (let n = 0; n < 161; n++) c.enqueue(new Uint8Array(65536));
      c.close();
    },
  });
  const oversized = await fetch(target + "/api/uploads", {
    method: "POST",
    headers: { ...headers, "Content-Type": "image/png" },
    body: chunked,
    duplex: "half",
  });
  assert.equal(oversized.status, 413);
  await oversized.text();
  checks.push({
    test: "Unknown-length chunked upload exceeds 10MiB",
    status: 413,
  });
  for (const status of [401, 429, 500]) {
    await control(status);
    const r = await upload("image/png", png);
    assert.equal(r.status, 502);
    const text = await r.text();
    assert.ok(!text.includes("fixture-private-upstream-error"));
    assert.ok(text.includes("העלאת התמונה נכשלה"));
    checks.push({
      test:
        "Upstream " +
        status +
        " yields generic Hebrew error without private upstream detail",
      status: 502,
    });
  }
  const result = {
    path:
      process.env.DIRECT_WORKER_VERIFY === "1"
        ? "Direct local workerd"
        : "Wrangler dev proxy",
    checks,
    qualification:
      "Loopback upstream only. No Sanity asset was created. JPEG/PNG/WebP are locally decoder-valid; real Sanity acceptance/authentication/CDN behavior remains untested.",
  };
  await writeFile(
    new URL(
      "../../../docs/admin-screenshots/final-upload-compatibility.json",
      import.meta.url,
    ),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await control(200);
}
