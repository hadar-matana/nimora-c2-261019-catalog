import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const WebSocket = createRequire(require.resolve("wrangler"))("ws");
const account = JSON.parse(
  await readFile("/private/tmp/atelier-local-proof-account.json", "utf8"),
);
const target = (
  await (await fetch("http://127.0.0.1:9229/json/list")).json()
)[0];
const ws = new WebSocket(target.webSocketDebuggerUrl, {
  headers: { Origin: "http://localhost" },
});
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
let serial = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const message = JSON.parse(e.data);
  if (message.id) {
    const p = pending.get(message.id);
    pending.delete(message.id);
    if (!p) return;
    if (message.error) p.reject(new Error(JSON.stringify(message.error)));
    else p.resolve(message.result);
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
await command("Profiler.start");
const elapsed = [];
for (let n = 0; n < 3; n++) {
  const start = performance.now();
  const r = await fetch("http://127.0.0.1:3002/api/login", {
    method: "POST",
    headers: {
      Origin: "http://127.0.0.1:3002",
      "Content-Type": "application/json",
      "CF-Connecting-IP": "cpu-profile",
    },
    body: JSON.stringify({
      username: account.username,
      password: account.password,
    }),
  });
  if (r.status !== 200)
    throw new Error("Verification did not succeed: " + r.status);
  await r.json();
  elapsed.push(performance.now() - start);
}
const { profile } = await command("Profiler.stop");
ws.close();
const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
let activeUs = 0,
  idleUs = 0,
  bcryptUs = 0;
const parents = new Map();
for (const node of nodes.values())
  for (const id of node.children ?? []) parents.set(id, node.id);
for (let n = 0; n < (profile.samples ?? []).length; n++) {
  let node = nodes.get(profile.samples[n]);
  const us = profile.timeDeltas[n];
  if (node?.callFrame.functionName === "(idle)") {
    idleUs += us;
    continue;
  }
  activeUs += us;
  while (node) {
    if (
      /bcrypt|_crypt|_encipher|_streamtoword/.test(
        node.callFrame.url + " " + node.callFrame.functionName,
      )
    ) {
      bcryptUs += us;
      break;
    }
    node = nodes.get(parents.get(node.id));
  }
}
const result = {
  runtime: "local workerd V8 inspector",
  bcryptCost: 12,
  verifications: 3,
  requestWallMs: elapsed,
  sampledActiveMs: activeUs / 1000,
  sampledIdleMs: idleUs / 1000,
  bcryptStackSampleMs: bcryptUs / 1000,
  qualification:
    "Sampling estimates across the shared local isolate, not Cloudflare billed CPU, not remote Free-plan enforcement.",
};
await writeFile(
  new URL(
    "../../../docs/admin-screenshots/local-proof-profile.json",
    import.meta.url,
  ),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
