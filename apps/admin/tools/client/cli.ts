import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  digest,
  targetConfirmation,
  validateManifest,
  validateNewClient,
} from "./manifest.ts";
import {
  configuration,
  provisionPlan,
  verifyIsolationEvidence,
} from "./provision.ts";
import {
  backupKey,
  captureBackup,
  inspectBackup,
  packBackup,
  privateDirectory,
  recoverLocal,
  restorePlan,
  retentionPlan,
  verifyBackup,
} from "./backup.ts";

async function json(path: string) {
  if (!path) throw new Error("Required file argument missing");
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}
async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "apply" || command === "activate" || command === "deploy")
    throw new Error(
      "Live mutations are not implemented in Phase B. Use reviewed dry-run plan and later explicit authorization.",
    );
  if (command === "inspect-backup") {
    console.log(
      JSON.stringify(
        await inspectBackup(
          args[0],
          backupKey(process.env.CLIENT_BACKUP_KEY_BASE64),
          args[1],
        ),
        null,
        2,
      ),
    );
    return;
  }
  const m = validateManifest(await json(args[0]));
  let result: unknown;
  switch (command) {
    case "validate":
      validateNewClient(m, await json(args[1]));
      result = { valid: true, manifestHash: digest(m) };
      break;
    case "plan":
      result = provisionPlan(m, await json(args[1]));
      break;
    case "confirmation":
      if (
        ![
          "backup-read",
          "isolated-restore",
          "bind-namespace",
          "identity",
          "cms",
          "pages",
          "branding",
          "admin",
          "binding",
          "secrets",
          "verify",
          "publishing",
        ].includes(args[1])
      )
        throw new Error("Unknown confirmation action");
      result = { confirmation: targetConfirmation(m, args[1]) };
      break;
    case "config": {
      validateNewClient(m, await json(args[1]));
      const dir = await privateDirectory(args[2]);
      const generated = configuration(m);
      generated.worker.main = fileURLToPath(
        new URL("../../worker/index.ts", import.meta.url),
      );
      generated.worker.assets.directory = fileURLToPath(
        new URL("../../out", import.meta.url),
      );
      for (const [key, value] of Object.entries(generated))
        await writeFile(
          join(dir, key + ".json"),
          JSON.stringify(value, null, 2) + "\n",
          { flag: "wx", mode: 0o600 },
        );
      result = {
        directory: dir,
        generated: Object.keys(generated),
        cloudMutationsExecuted: 0,
      };
      break;
    }
    case "backup-pack":
      result = await packBackup(
        m,
        args[1],
        await json(args[2]),
        backupKey(process.env.CLIENT_BACKUP_KEY_BASE64),
        await json(args[3]),
      );
      break;
    case "backup-capture":
      result = await captureBackup(
        m,
        backupKey(process.env.CLIENT_BACKUP_KEY_BASE64),
        process.env.CLIENT_SANITY_READ_TOKEN ?? "",
        args[1],
      );
      break;
    case "backup-verify":
      result = await verifyBackup(
        m,
        args[1],
        backupKey(process.env.CLIENT_BACKUP_KEY_BASE64),
      );
      break;
    case "recover-local":
      result = await recoverLocal(
        m,
        args[1],
        backupKey(process.env.CLIENT_BACKUP_KEY_BASE64),
        args[2],
      );
      break;
    case "retention-plan":
      result = await retentionPlan(m);
      break;
    case "restore-plan":
      result = restorePlan(
        m,
        await json(args[1]),
        await json(args[2]),
        args[3],
        await json(args[4]),
      );
      break;
    case "verify-evidence":
      result = verifyIsolationEvidence(
        m,
        await json(args[1]),
        await json(args[2]),
      );
      break;
    default:
      throw new Error(
        "Use validate, plan, confirmation, config, backup-capture, backup-pack, backup-verify, recover-local, retention-plan, restore-plan, or verify-evidence. No cloud apply is available.",
      );
  }
  console.log(JSON.stringify(result, null, 2));
}
main().catch((error) => {
  console.error(
    "Client tooling stopped:",
    error instanceof Error ? error.message : "Validation failed",
  );
  process.exitCode = 1;
});
