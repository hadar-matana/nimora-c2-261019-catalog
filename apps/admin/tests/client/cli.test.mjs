import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtemp,
  writeFile,
  readFile,
  rm,
  readdir,
  stat,
} from "node:fs/promises";
import { join } from "node:path";
import { client } from "./helpers.mjs";
test("actual CLI validates/renders dry-run config outside repository and refuses overwrite, omitted registry, invalid manifests and live apply", async () => {
  const root = await mkdtemp("/private/tmp/atelier-client-cli-unit-");
  try {
    const manifest = join(root, "manifest.json"),
      registry = join(root, "registry.json"),
      m = client("alpha", root);
    m.worker.namespaceId = null;
    await writeFile(manifest, JSON.stringify(m), { mode: 0o600 });
    await writeFile(registry, "[]", { mode: 0o600 });
    const command = (...args) =>
      spawnSync(
        process.execPath,
        ["--experimental-strip-types", "tools/client/cli.ts", ...args],
        {
          cwd: new URL("../..", import.meta.url).pathname,
          encoding: "utf8",
          env: { PATH: process.env.PATH },
        },
      );
    const dry = command("plan", manifest, registry);
    assert.equal(dry.status, 0, dry.stderr);
    const plan = JSON.parse(dry.stdout);
    assert.equal(plan.mutationsExecuted, 0);
    assert.equal(plan.manifest.worker.namespaceId, null);
    const output = join(root, "generated");
    const generate = command("config", manifest, registry, output);
    assert.equal(generate.status, 0, generate.stderr);
    const worker = JSON.parse(
      await readFile(join(output, "worker.json"), "utf8"),
    );
    assert.ok(worker.main.endsWith("/apps/admin/worker/index.ts"));
    assert.equal(worker.vars.SANITY_ALLOW_PRODUCTION_WRITES, "disabled");
    assert.equal(worker.vars.ADMIN_REMOTE_ENABLED, "disabled");
    assert.equal((await stat(join(output, "worker.json"))).mode & 0o777, 0o600);
    assert.notEqual(command("config", manifest, registry, output).status, 0);
    assert.notEqual(command("plan", manifest).status, 0);
    assert.notEqual(command("apply", manifest, registry).status, 0);
    m.sanity.projectId = "3ahm0828";
    m.publishing.sanityProjectId = "3ahm0828";
    await writeFile(manifest, JSON.stringify(m));
    assert.notEqual(command("validate", manifest, registry).status, 0);
    assert.equal((await readdir(output)).length, 5);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
