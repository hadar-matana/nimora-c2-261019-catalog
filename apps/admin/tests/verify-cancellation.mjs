import { readFile, writeFile } from "node:fs/promises";
const { cookie, csrf } = JSON.parse(
  await readFile("/private/tmp/atelier-local-proof-session.json", "utf8"),
);
const image = await readFile(
  new URL("../public/demo/dress.png", import.meta.url),
);
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
const direct =
  config.userWorkerUrl.protocol +
  "//" +
  config.userWorkerUrl.hostname +
  ":" +
  config.userWorkerUrl.port;
const base = "http://127.0.0.1:3002";
const results = [];
async function control(status) {
  await fetch("http://127.0.0.1:3003/fixture/control", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}
for (const [label, url, extra] of [
  ["Wrangler public dev proxy", base, {}],
  ["Direct local workerd", direct, config.headers],
]) {
  for (let n = 0; n < 3; n++) {
    await control(200);
    const headers = {
      ...extra,
      Origin: base,
      Cookie: cookie,
      "X-CSRF-Token": csrf,
      "Content-Type": "image/png",
    };
    const body = new ReadableStream({
      start(c) {
        for (let i = 0; i < 161; i++) c.enqueue(new Uint8Array(65536));
        c.close();
      },
    });
    const over = await fetch(url + "/api/uploads", {
      method: "POST",
      headers,
      body,
      duplex: "half",
    });
    await over.text();
    await control(401);
    const next = await fetch(url + "/api/uploads", {
      method: "POST",
      headers,
      body: image,
    });
    const text = await next.text();
    results.push({
      path: label,
      iteration: n + 1,
      oversizeStatus: over.status,
      followingUpstream401Status: next.status,
      expectedGenericHebrewError: text.includes("העלאת התמונה נכשלה"),
      privateUpstreamDetailLeaked: text.includes(
        "fixture-private-upstream-error",
      ),
    });
  }
}
await control(200);
const result = {
  results,
  qualification:
    "Direct loopback workerd requests preserve application session and CSRF authorization. Internal proxy credentials are read privately for instrumentation and never included in this artifact.",
};
await writeFile(
  new URL(
    "../../../docs/admin-screenshots/final-cancellation-check.json",
    import.meta.url,
  ),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
