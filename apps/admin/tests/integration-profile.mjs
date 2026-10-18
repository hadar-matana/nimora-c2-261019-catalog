import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const WebSocket = createRequire(require.resolve("wrangler"))("ws");
const account = JSON.parse(
  await readFile("/private/tmp/atelier-integration-account.json", "utf8"),
);
const { cookie, csrf } = JSON.parse(
  await readFile("/private/tmp/atelier-integration-session.json", "utf8"),
);
assert.equal(
  (
    await (
      await fetch("http://127.0.0.1:3002/api/catalog", {
        headers: { Cookie: cookie },
      })
    ).json()
  ).environment,
  "fixture",
  "Benchmarks must never upload to real Sanity",
);
const ws = new WebSocket("ws://127.0.0.1:9229/ws", {
  headers: { Origin: "http://localhost" },
});
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
let serial = 5000;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  const p = pending.get(m.id);
  if (!p) return;
  pending.delete(m.id);
  m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
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
const base = "http://127.0.0.1:3002";
const maxImage = Buffer.alloc(10 * 1024 * 1024);

const realImage = await readFile(
  new URL("../public/demo/dress.png", import.meta.url),
);
realImage.copy(maxImage);
const rows = [];
const heapBefore = await command("Runtime.getHeapUsage").catch(() => null);
try {
  for (const scenario of [
    "login-negative-control",
    "session",
    "published-catalog",
    "real-PNG-upload",
    "maximum-upload",
  ]) {
    const repeats = scenario === "login-negative-control" ? 3 : 10;
    const totals = [];
    for (let n = 0; n < repeats; n++) {
      await command("Profiler.start");
      const start = performance.now();
      let response;
      if (scenario === "login-negative-control")
        response = await fetch(base + "/api/login", {
          method: "POST",
          headers: {
            Origin: base,
            "Content-Type": "application/json",
            "CF-Connecting-IP": "isolated-cpu",
          },
          body: JSON.stringify({
            username: account.username,
            password: account.password,
          }),
        });
      else if (scenario.endsWith("upload"))
        response = await fetch(base + "/api/uploads", {
          method: "POST",
          headers: {
            Origin: base,
            Cookie: cookie,
            "X-CSRF-Token": csrf,
            "Content-Type": "image/png",
          },
          body: scenario === "maximum-upload" ? maxImage : realImage,
        });
      else
        response = await fetch(
          base +
            "/api/" +
            (scenario === "published-catalog" ? "catalog" : "session"),
          { headers: { Cookie: cookie } },
        );
      assert.equal(response.status, 200, scenario);
      await response.json();
      const wallMs = performance.now() - start;
      const { profile } = await command("Profiler.stop");
      const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
      let nonIdle = 0,
        js = 0,
        bcrypt = 0,
        program = 0,
        gc = 0;
      const parents = new Map();
      for (const node of nodes.values())
        for (const id of node.children ?? []) parents.set(id, node.id);
      for (let i = 0; i < (profile.samples ?? []).length; i++) {
        let node = nodes.get(profile.samples[i]);
        const frame = node?.callFrame,
          us = profile.timeDeltas[i];
        if (frame?.functionName !== "(idle)") nonIdle += us;
        if (frame?.url) js += us;
        if (frame?.functionName === "(program)") program += us;
        if (frame?.functionName === "(garbage collector)") gc += us;
        while (node) {
          if (
            /bcrypt|_crypt|_encipher|_streamtoword/.test(
              node.callFrame.url + " " + node.callFrame.functionName,
            )
          ) {
            bcrypt += us;
            break;
          }
          node = nodes.get(parents.get(node.id));
        }
      }
      totals.push({
        wallMs,
        nonIdleMs: nonIdle / 1000,
        javascriptMs: js / 1000,
        programMs: program / 1000,
        gcMs: gc / 1000,
        bcryptStackMs: bcrypt / 1000,
      });
    }
    const summarize = (key) => ({
      average: totals.reduce((n, r) => n + r[key], 0) / repeats,
      max: Math.max(...totals.map((r) => r[key])),
    });
    rows.push({
      scenario,
      repeats,
      wallMs: summarize("wallMs"),
      sampledNonIdleMs: summarize("nonIdleMs"),
      sampledJavascriptMs: summarize("javascriptMs"),
      sampledProgramMs: summarize("programMs"),
      sampledGcMs: summarize("gcMs"),
      bcryptStackMs: summarize("bcryptStackMs"),
      individualMeasurements: totals,
    });
    console.log(
      "PROFILE",
      scenario,
      JSON.stringify({
        wallMs: rows.at(-1).wallMs,
        stackSamples: rows.at(-1).sampledJavascriptMs,
      }),
    );
  }
  const result = {
    runtime:
      "Local workerd streaming implementation, application and auth DO in the same local Worker isolate",
    rows,
    heapBefore,
    heapAfter: await command("Runtime.getHeapUsage").catch(() => null),
    qualification:
      "Local V8 stack samples use wall-time deltas and may include scheduling/I/O gaps. Shared-isolate profiles include DO activity. Not remote billed CPU or Free-plan CPU compliance. Heap snapshots are not peak/native/network memory. Large PNG contains trailing padding accepted by the fixture decoder, not tested against real Sanity.",
  };
  await writeFile(
    new URL(
      "../../../docs/admin-screenshots/integration-profile.json",
      import.meta.url,
    ),
    JSON.stringify(result, null, 2) + "\n",
  );
} finally {
  ws.terminate();
}
