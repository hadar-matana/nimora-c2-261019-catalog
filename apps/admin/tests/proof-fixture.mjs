import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { writeFile, readFile } from "node:fs/promises";
import bcrypt from "bcryptjs";
const file = "/private/tmp/atelier-local-proof-account.json";
let account;
try {
  account = JSON.parse(await readFile(file, "utf8"));
} catch {
  account = {
    username: "proof-owner",
    password: randomBytes(24).toString("base64url"),
    version: randomBytes(16).toString("hex"),
  };
  await writeFile(file, JSON.stringify(account), { mode: 0o600 });
}
await writeFile(
  new URL("../worker/.dev.vars", import.meta.url),
  `OWNER_USERNAME=${account.username}\nOWNER_PASSWORD_HASH=${await bcrypt.hash(account.password, 12)}\nCREDENTIAL_VERSION=${account.version}\nTEST_UPLOAD_ORIGIN=http://127.0.0.1:3003\n`,
  { mode: 0o600 },
);
let calls = 0;
let responseStatus = 200;
createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/fixture/control") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const control = JSON.parse(Buffer.concat(chunks).toString());
    responseStatus = [200, 401, 429, 500].includes(control.status)
      ? control.status
      : 200;
    res.end(JSON.stringify({ status: responseStatus }));
    return;
  }
  if (req.url === "/stats") {
    res.end(JSON.stringify({ calls }));
    return;
  }
  if (
    req.method !== "POST" ||
    req.url !== "/v2025-02-19/assets/images/production" ||
    req.headers.authorization !== "Bearer local-fixture-only"
  ) {
    res.writeHead(403).end();
    return;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  calls++;
  if (responseStatus !== 200) {
    res
      .writeHead(responseStatus)
      .end(JSON.stringify({ error: "fixture-private-upstream-error" }));
    return;
  }
  res.setHeader("content-type", "application/json");
  res.end(
    JSON.stringify({
      document: {
        _id: "image-local-fixture",
        url: "http://127.0.0.1:3003/local-fixture.png",
      },
      receivedBytes: Buffer.concat(chunks).length,
    }),
  );
}).listen(3003, "127.0.0.1", () =>
  console.log(
    "Local upload fixture ready; isolated test credentials generated (not printed).",
  ),
);
