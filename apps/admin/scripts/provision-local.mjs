import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import bcrypt from "bcryptjs";
// Generates a temporary local test account, never a reusable production account.
// Random password is printed once to the local operator, never embedded in assets.
const rl = createInterface({ input: stdin, output: stdout });
const username =
  (await rl.question("Local proof username (default proof-owner): ")).trim() ||
  "proof-owner";
rl.close();
if (!/^[a-zA-Z0-9_-]{3,80}$/.test(username))
  throw new Error("Use 3–80 ASCII letters, digits, hyphen or underscore.");
const password = randomBytes(24).toString("base64url");
const hash = await bcrypt.hash(password, 12);
await writeFile(
  new URL("../worker/.dev.vars", import.meta.url),
  `OWNER_USERNAME=${username}\nOWNER_PASSWORD_HASH=${hash}\nCREDENTIAL_VERSION=${randomBytes(16).toString("hex")}\nSANITY_MODE=fixture\nSANITY_FIXTURE_ORIGIN=http://127.0.0.1:3003\n`,
  { mode: 0o600 },
);
console.log("Temporary local password:", password);
console.log(
  "Local-only secrets saved in ignored worker/.dev.vars. No Cloudflare secrets were changed.",
);
