import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const WebSocket = createRequire(require.resolve("wrangler"))("ws");
const { cookie, csrf } = JSON.parse(
  await readFile("/private/tmp/atelier-local-proof-session.json", "utf8"),
);
const ws = new WebSocket("ws://127.0.0.1:9229/ws", {
  headers: { Origin: "http://localhost" },
});
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
let serial = 1000;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id) {
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    if (m.error) p.reject(new Error(JSON.stringify(m.error)));
    else p.resolve(m.result);
  }
};
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
await command("Profiler.enable");
await command("Profiler.setSamplingInterval", { interval: 100 });
const output = [];
for (const route of ["session", "10MB-upload"]) {
  await command("Profiler.start");
  let wall = 0;
  for (let n = 0; n < 3; n++) {
    const start = performance.now();
    const data = Buffer.alloc(10 * 1024 * 1024);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(data);
    const response = await fetch(
      "http://127.0.0.1:3002/api/" +
        (route === "session" ? "session" : "uploads"),
      route === "session"
        ? { headers: { Cookie: cookie } }
        : {
            method: "POST",
            headers: {
              Cookie: cookie,
              Origin: "http://127.0.0.1:3002",
              "X-CSRF-Token": csrf,
              "Content-Type": "image/png",
            },
            body: data,
          },
    );
    if (response.status !== 200)
      throw new Error("Request failed " + response.status);
    await response.json();
    wall += performance.now() - start;
  }
  const { profile } = await command("Profiler.stop");
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  let active = 0,
    javascript = 0,
    program = 0;
  for (let n = 0; n < (profile.samples ?? []).length; n++) {
    const frame = nodes.get(profile.samples[n])?.callFrame;
    const us = profile.timeDeltas[n];
    if (frame?.functionName !== "(idle)") active += us;
    if (frame?.url) javascript += us;
    if (frame?.functionName === "(program)") program += us;
  }
  output.push({
    route,
    requests: 3,
    averageRequestWallMs: wall / 3,
    sampledActiveMs: active / 1000,
    sampledActivePerRequestMs: active / 3000,
    sampledJavaScriptPerRequestMs: javascript / 3000,
    sampledProgramPerRequestMs: program / 3000,
  });
}
ws.terminate();
const result = {
  measurements: output,
  qualification:
    "Shared local isolate sampling estimate, including Durable Object session validation; NOT billed CPU or a remote 10ms limit certification. The 10MB fixture validates transport only, not Sanity image decoding.",
};
await writeFile(
  new URL(
    "../../../docs/admin-screenshots/local-proof-request-profile.json",
    import.meta.url,
  ),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
