import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
  open,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import {
  canonical,
  confirmTarget,
  digest,
  validateManifest,
  validateNewClient,
  type ClientManifest,
} from "./manifest.ts";
import { configuration } from "./provision.ts";

const archiveHelper = fileURLToPath(
  new URL("./backup_archive.py", import.meta.url),
);
const magic = Buffer.from("ATELIER-BACKUP-1\n");
export function backupKey(raw: string | undefined): Buffer {
  if (!raw || !/^[A-Za-z0-9+/]{43}=$/.test(raw))
    throw new Error("Private CLIENT_BACKUP_KEY_BASE64 (32 bytes) required");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32 || key.toString("base64") !== raw)
    throw new Error("Invalid backup key");
  return key;
}
export async function privateDirectory(path: string) {
  const full = resolve(path);
  let cursor = full;
  while (cursor !== dirname(cursor)) {
    try {
      if ((await lstat(cursor)).isSymbolicLink())
        throw new Error("Symlink backup paths prohibited");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    cursor = dirname(cursor);
  }
  await mkdir(full, { recursive: true, mode: 0o700 });
  const info = await stat(full);
  if ((info.mode & 0o077) !== 0 || info.uid !== process.getuid?.())
    throw new Error(
      "Backup directory must be owned by current user with mode 0700",
    );
  if ((await realpath(full)) !== full)
    throw new Error("Canonical private backup path required");
  return full;
}
function run(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
) {
  const result = spawnSync(command, args, {
    ...options,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout: 30 * 60 * 1000,
  });
  if (result.status !== 0)
    throw new Error(
      `${command} failed; stop and inspect privately (raw logs suppressed)`,
    );
  return result.stdout;
}
export type Inventory = {
  version: 1;
  projectId: string;
  dataset: string;
  revision: string;
  documents: Record<string, unknown>[];
};
export function normalizeDocument(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeDocument);
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>,
      asset = row.asset as { _ref?: unknown } | undefined;
    if (
      typeof asset?._ref === "string" &&
      /^(image|file)-[a-f0-9]{40}(?:-\d+x\d+)?-[a-z0-9]+$/.test(asset._ref)
    ) {
      const { asset: omitted, ...rest } = row;
      void omitted;
      const kind = asset._ref.split("-")[0];
      const filename = asset._ref
        .replace(/^(image|file)-/, "")
        .replace(/-([a-z0-9]+)$/, ".$1");
      return {
        _sanityAsset: `${kind}@file://./${kind}s/${filename}`,
        ...(normalizeDocument(rest) as Record<string, unknown>),
      };
    }
    return Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, normalizeDocument(v)]),
    );
  }
  return value;
}
export function validateInventory(
  m: ClientManifest,
  input: unknown,
): Inventory {
  const v = input as Inventory;
  if (
    !v ||
    v.version !== 1 ||
    v.projectId !== m.sanity.projectId ||
    v.dataset !== m.sanity.dataset ||
    v.revision !== m.revision ||
    !Array.isArray(v.documents) ||
    v.documents.length > 50000
  )
    throw new Error("Inventory target/revision mismatch");
  const ids = new Set();
  for (const doc of v.documents) {
    if (
      !doc ||
      typeof doc !== "object" ||
      !["_id", "_type", "_rev"].every(
        (k) => typeof doc[k] === "string" && doc[k],
      ) ||
      ids.has(doc._id)
    )
      throw new Error("Invalid/duplicate inventory document");
    ids.add(doc._id);
    if (doc._type === "sanity.imageAsset" || doc._type === "sanity.fileAsset") {
      const id = String(doc._id);
      if (
        !/^(image|file)-[a-f0-9]{40}(?:-\d+x\d+)?-[a-z0-9]+$/.test(id) ||
        !Number.isSafeInteger(doc.size) ||
        Number(doc.size) < 1 ||
        !/^([a-f0-9]{40})$/.test(String(doc.sha1hash)) ||
        !id.includes(String(doc.sha1hash))
      )
        throw new Error("Invalid original asset inventory");
      const kind = doc._type === "sanity.imageAsset" ? "images" : "files";
      if (
        !id.startsWith(kind === "images" ? "image-" : "file-") ||
        !doc.assetMetadata ||
        typeof doc.assetMetadata !== "object"
      )
        throw new Error("Independent original asset metadata required");
      const filename = id
        .replace(/^(image|file)-/, "")
        .replace(/-([a-z0-9]+)$/, ".$1");
      if (
        doc.url !==
        `https://cdn.sanity.io/${kind}/${m.sanity.projectId}/${m.sanity.dataset}/${filename}`
      )
        throw new Error("Cross-target asset URL prohibited before export");
    } else if (!doc.document || typeof doc.document !== "object")
      throw new Error("Independent source document content is required");
  }
  return v;
}
export function validateExport(
  m: ClientManifest,
  path: string,
  inventory: unknown,
) {
  validateInventory(m, inventory);
  const result = spawnSync(
    "python3",
    [
      "-c",
      "import json,sys;sys.path.insert(0,sys.argv[1]);from backup_archive import validate_export; print(json.dumps(validate_export(sys.argv[2], json.loads(sys.stdin.read()))))",
      dirname(archiveHelper),
      path,
    ],
    {
      input: JSON.stringify(inventory),
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      timeout: 30 * 60 * 1000,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    },
  );
  if (result.status !== 0)
    throw new Error(
      "Backup export validation rejected: " +
        (result.stderr
          .split("\n")
          .findLast((line) => line.startsWith("ValueError:")) ??
          "invalid archive"),
    );
  return JSON.parse(result.stdout) as {
    sourceDocumentCount: number;
    documentCount: number;
    assetCount: number;
    assets: Record<string, unknown>;
  };
}
async function fileHash(path: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
export async function encrypt(
  source: string,
  destination: string,
  key: Buffer,
) {
  const nonce = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(magic);
  const handle = await open(destination, "wx", 0o600);
  await handle.write(Buffer.concat([magic, nonce]));
  await handle.close();
  try {
    await pipeline(
      createReadStream(source),
      cipher,
      createWriteStream(destination, { flags: "a", mode: 0o600 }),
    );
    const tail = await open(destination, "a");
    await tail.write(cipher.getAuthTag());
    await tail.close();
  } catch (e) {
    await rm(destination, { force: true });
    throw e;
  }
}
export async function decrypt(
  source: string,
  destination: string,
  key: Buffer,
) {
  const info = await stat(source);
  if (info.size < magic.length + 12 + 16) throw new Error("Truncated backup");
  const handle = await open(source, "r");
  const header = Buffer.alloc(magic.length + 12),
    tag = Buffer.alloc(16);
  await handle.read(header, 0, header.length, 0);
  await handle.read(tag, 0, 16, info.size - 16);
  await handle.close();
  if (!header.subarray(0, magic.length).equals(magic))
    throw new Error("Invalid backup envelope");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    key,
    header.subarray(magic.length),
  );
  cipher.setAAD(magic);
  cipher.setAuthTag(tag);
  const output = await open(destination, "wx", 0o600);
  try {
    await pipeline(
      createReadStream(source, { start: header.length, end: info.size - 17 }),
      cipher,
      output.createWriteStream(),
    );
  } catch (e) {
    await rm(destination, { force: true });
    throw new Error("Backup authentication failed; no restore allowed", {
      cause: e,
    });
  }
}
export async function packBackup(
  mInput: unknown,
  exportPath: string,
  inventoryInput: unknown,
  key: Buffer,
  metadata: unknown,
) {
  const m = validateManifest(mInput),
    inventory = validateInventory(m, inventoryInput);
  if (!m.worker.namespaceId)
    throw new Error("Assigned resource metadata required for backup");
  const verified = validateExport(m, exportPath, inventory);
  // Metadata is generated/allowlisted, never a dump of provider secrets or arbitrary Worker settings.
  const expected = {
    cloudflareAccount: m.accounts.cloudflare,
    sanityOrganization: m.accounts.sanityOrganization,
    projectId: m.sanity.projectId,
    dataset: m.sanity.dataset,
    pagesProject: m.pages.name,
    workerName: m.worker.name,
    namespaceId: m.worker.namespaceId,
    revision: m.revision,
  };
  if (canonical(metadata) !== canonical(expected))
    throw new Error("Exact allowlisted resource metadata required");
  const directory = await privateDirectory(m.backup.directory),
    work = await mkdtemp(join(directory, ".pack-"));
  await chmod(work, 0o700);
  try {
    const { copyFile } = await import("node:fs/promises");
    await copyFile(exportPath, join(work, "native-export.tar.gz"));
    await chmod(join(work, "native-export.tar.gz"), 0o600);
    // Validate the copied bytes too, avoiding a changed source between verification and copy.
    validateExport(m, join(work, "native-export.tar.gz"), inventory);
    const files = {
      "client-manifest.json": m,
      "inventory.json": inventory,
      "resource-metadata.json": metadata,
      "worker-config.json": configuration(m).worker,
    };
    for (const [name, data] of Object.entries(files))
      await writeFile(join(work, name), JSON.stringify(data), {
        mode: 0o600,
        flag: "wx",
      });
    const checksums: Record<string, string> = {};
    for (const name of ["native-export.tar.gz", ...Object.keys(files)])
      checksums[name] = await fileHash(join(work, name));
    await writeFile(join(work, "checksums.json"), JSON.stringify(checksums), {
      mode: 0o600,
    });
    const plain = join(work, "bundle.tar");
    run("python3", [
      "-c",
      'import tarfile,sys;from pathlib import Path;p=Path(sys.argv[1]);t=tarfile.open(sys.argv[2],"w");[t.add(p/n,arcname=n,recursive=False) for n in sys.argv[3:]]',
      work,
      plain,
      ...Object.keys(checksums),
      "checksums.json",
    ]);
    const name = `${m.slug}-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}.abk`;
    const pending = join(directory, "." + name + ".pending"),
      destination = join(directory, name);
    await encrypt(plain, pending, key);
    // Decrypt and validate before a backup is marked complete; no output archive is trusted by exit status alone.
    await verifyBackup(m, pending, key);
    await rename(pending, destination);
    return {
      path: destination,
      manifestHash: digest(m),
      keyId: m.backup.keyId,
      ...verified,
      encryption: "AES-256-GCM",
      validated: true,
    };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
export async function verifyBackup(
  mInput: unknown,
  path: string,
  key: Buffer,
  workingDirectoryOverride?: string,
) {
  const m = validateManifest(mInput),
    root = await privateDirectory(
      workingDirectoryOverride ?? m.backup.directory,
    ),
    work = await mkdtemp(join(root, ".verify-"));
  await chmod(work, 0o700);
  try {
    const plain = join(work, "bundle.tar");
    await decrypt(path, plain, key);
    // Read only named regular files, never extract arbitrary member paths or links.
    const program = `import sys,json,tarfile,hashlib\nsys.path.insert(0,sys.argv[1])\nfrom backup_archive import members,validate_bundle,validate_export\nfrom pathlib import Path\np=Path(sys.argv[3]); data={}\nwith tarfile.open(sys.argv[2]) as t:\n for item in members(t):\n  if item.name not in ['native-export.tar.gz','client-manifest.json','inventory.json','resource-metadata.json','worker-config.json','checksums.json']:raise ValueError('Unexpected recovery file')\n  dest=p/item.name\n  with t.extractfile(item) as src,open(dest,'xb') as out:\n   import shutil;shutil.copyfileobj(src,out)\nchecks=json.loads((p/'checksums.json').read_text())\nexpected={'native-export.tar.gz','client-manifest.json','inventory.json','resource-metadata.json','worker-config.json'}\nif set(checks)!=expected:raise ValueError('Incomplete checksum map')\nfor name,expectedHash in checks.items():\n h=hashlib.sha256()\n with open(p/name,'rb') as f:\n  while chunk:=f.read(1048576):h.update(chunk)\n if h.hexdigest()!=expectedHash:raise ValueError('Checksum mismatch')\nm=json.loads(sys.stdin.read());inventory=json.loads((p/'inventory.json').read_text())\nvalidate_bundle(sys.argv[2],inventory,m)\nif inventory['projectId']!=m['sanity']['projectId'] or inventory['dataset']!=m['sanity']['dataset'] or inventory['revision']!=m['revision']:raise ValueError('Source identity mismatch')\nprint(json.dumps(validate_export(p/'native-export.tar.gz',inventory)))`;
    const result = spawnSync(
      "python3",
      ["-c", program, dirname(archiveHelper), plain, work],
      {
        input: JSON.stringify(m),
        encoding: "utf8",
        timeout: 30 * 60 * 1000,
        maxBuffer: 16 * 1024 * 1024,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
      },
    );
    if (result.status !== 0)
      throw new Error("Recovery bundle validation failed");
    const inventory = JSON.parse(
      await readFile(join(work, "inventory.json"), "utf8"),
    );
    const resources = JSON.parse(
      await readFile(join(work, "resource-metadata.json"), "utf8"),
    );
    const expected = {
      cloudflareAccount: m.accounts.cloudflare,
      sanityOrganization: m.accounts.sanityOrganization,
      projectId: m.sanity.projectId,
      dataset: m.sanity.dataset,
      pagesProject: m.pages.name,
      workerName: m.worker.name,
      namespaceId: m.worker.namespaceId,
      revision: m.revision,
    };
    if (
      canonical(resources) !== canonical(expected) ||
      canonical(
        JSON.parse(await readFile(join(work, "worker-config.json"), "utf8")),
      ) !== canonical(configuration(m).worker)
    )
      throw new Error("Recovery configuration mismatch");
    return {
      manifestHash: digest(m),
      inventory,
      ...JSON.parse(result.stdout),
      validated: true,
    };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
export async function retentionPlan(mInput: unknown, now = Date.now()) {
  const m = validateManifest(mInput),
    root = await privateDirectory(m.backup.directory);
  const files = [] as { path: string; modified: number }[];
  for (const name of await readdir(root)) {
    if (!new RegExp("^" + m.slug + "-.*\\.abk$").test(name)) continue;
    const path = join(root, name),
      info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink())
      throw new Error("Unsafe backup destination entry");
    files.push({ path, modified: info.mtimeMs });
  }
  files.sort((a, b) => b.modified - a.modified);
  return {
    mode: "dry-run",
    deletionsExecuted: 0,
    keep: files.slice(0, m.backup.keepLast).map((f) => f.path),
    candidates: files
      .slice(m.backup.keepLast)
      .filter((f) => now - f.modified > m.backup.retentionDays * 86400000)
      .map((f) => f.path),
    note: "No automatic deletion. Verify at least two independent decryptable backups and offsite copies before separately approved pruning.",
  };
}
export function restorePlan(
  sourceInput: unknown,
  targetInput: unknown,
  registry: unknown,
  confirmation: string,
  emptyEvidence: unknown,
) {
  const source = validateManifest(sourceInput),
    target = validateNewClient(targetInput, [
      source,
      ...(registry as unknown[]),
    ]);
  confirmTarget(target, "isolated-restore", confirmation);
  const e = emptyEvidence as {
    manifestHash: string;
    projectId: string;
    dataset: string;
    documentCount: number;
    observedAt: string;
    writesDisabled: boolean;
    hooksDisabled: boolean;
  };
  if (
    !e ||
    e.manifestHash !== digest(target) ||
    e.projectId !== target.sanity.projectId ||
    e.dataset !== target.sanity.dataset ||
    e.documentCount !== 0 ||
    e.writesDisabled !== true ||
    e.hooksDisabled !== true ||
    !Number.isFinite(Date.parse(e.observedAt)) ||
    Date.now() - Date.parse(e.observedAt) < 0 ||
    Date.now() - Date.parse(e.observedAt) > 10 * 60 * 1000
  )
    throw new Error("Fresh empty isolated destination evidence required");
  return {
    mode: "dry-run",
    mutationsExecuted: 0,
    source: source.sanity,
    target: target.sanity,
    manifestHash: digest(target),
    command: [
      "pnpm",
      "--filter",
      "studio",
      "exec",
      "sanity",
      "datasets",
      "import",
      "<validated-private-native-export.tar.gz>",
      target.sanity.dataset,
      "--project-id",
      target.sanity.projectId,
    ],
    warnings: [
      "No --replace, --replace-assets, allow-failing-assets, cross-dataset or overwrite flags",
      "Recreate secrets privately; never restore sessions; keep admin writes/hooks disabled",
      "After import compare document content, remapped asset references/metadata/counts and original asset hashes; verify on a private/read-only build before any publication",
    ],
  };
}
export async function captureInventory(
  m: ClientManifest,
  token: string,
): Promise<Inventory> {
  if (!token) throw new Error("Private read-only Sanity credential required");
  const u = new URL(
    `https://${m.sanity.projectId}.api.sanity.io/v${m.sanity.apiVersion}/data/query/${m.sanity.dataset}`,
  );
  u.searchParams.set(
    "query",
    '*[!(_id in path("_.**")) || _id in path("_.releases.**")] | order(_id asc)',
  );
  u.searchParams.set("perspective", "raw");
  const response = await fetch(u, {
    method: "GET",
    headers: { Authorization: "Bearer " + token },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error("Private inventory read failed");
  const result = (await response.json()) as {
    result: Record<string, unknown>[];
  };
  return validateInventory(m, {
    version: 1,
    projectId: m.sanity.projectId,
    dataset: m.sanity.dataset,
    revision: m.revision,
    documents: result.result.map((doc) =>
      doc._type === "sanity.imageAsset" || doc._type === "sanity.fileAsset"
        ? {
            _id: doc._id,
            _type: doc._type,
            _rev: doc._rev,
            size: doc.size,
            sha1hash: doc.sha1hash,
            url: doc.url,
            assetMetadata: Object.fromEntries(
              Object.entries(doc).filter(
                ([k]) =>
                  ![
                    "_id",
                    "_type",
                    "assetId",
                    "extension",
                    "mimeType",
                    "path",
                    "uploadId",
                    "url",
                  ].includes(k),
              ),
            ),
          }
        : {
            _id: doc._id,
            _type: doc._type,
            _rev: doc._rev,
            document: normalizeDocument(doc),
          },
    ),
  });
}
export async function captureBackup(
  mInput: unknown,
  key: Buffer,
  token: string,
  confirmation: string,
) {
  const m = validateManifest(mInput);
  confirmTarget(m, "backup-read", confirmation);
  if (!m.worker.namespaceId)
    throw new Error(
      "Assigned/reconciled resource metadata required for capture",
    );
  const root = await privateDirectory(m.backup.directory),
    work = await mkdtemp(join(root, ".capture-"));
  await chmod(work, 0o700);
  try {
    const before = await captureInventory(m, token),
      path = join(work, "native-export.tar.gz");
    const env = {
      ...process.env,
      ...configuration(m).studio,
      SANITY_AUTH_TOKEN: token,
    };
    run(
      "pnpm",
      [
        "--filter",
        "studio",
        "exec",
        "sanity",
        "datasets",
        "export",
        m.sanity.dataset,
        path,
        "--project-id",
        m.sanity.projectId,
        "--mode",
        "stream",
      ],
      { env },
    );
    const after = await captureInventory(m, token);
    if (canonical(before) !== canonical(after))
      throw new Error(
        "CMS changed during export; discard incomplete snapshot and retry only after quiescing writes",
      );
    return await packBackup(m, path, before, key, {
      cloudflareAccount: m.accounts.cloudflare,
      sanityOrganization: m.accounts.sanityOrganization,
      projectId: m.sanity.projectId,
      dataset: m.sanity.dataset,
      pagesProject: m.pages.name,
      workerName: m.worker.name,
      namespaceId: m.worker.namespaceId,
      revision: m.revision,
    });
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
export async function recoverLocal(
  mInput: unknown,
  path: string,
  key: Buffer,
  destination: string,
) {
  const m = validateManifest(mInput),
    root = await privateDirectory(m.backup.directory),
    work = await mkdtemp(join(root, ".recover-"));
  await chmod(work, 0o700);
  try {
    const { copyFile } = await import("node:fs/promises");
    const snapshot = join(work, "snapshot.abk");
    await copyFile(path, snapshot);
    await chmod(snapshot, 0o600);
    await verifyBackup(m, snapshot, key);
    const plain = join(work, "bundle.tar");
    await decrypt(snapshot, plain, key);
    const dir = await privateDirectory(destination),
      output = join(dir, "native-export.tar.gz");
    run("python3", [
      "-c",
      'import tarfile,sys,shutil,os;t=tarfile.open(sys.argv[1]);m=t.getmember("native-export.tar.gz");assert m.isfile();out=os.open(sys.argv[2],os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600);f=os.fdopen(out,"wb");shutil.copyfileobj(t.extractfile(m),f);f.close()',
      plain,
      output,
    ]);
    return {
      path: output,
      source: m.sanity,
      cloudMutationsExecuted: 0,
      warning:
        "Private plaintext export: keep outside Git; import only using an independently confirmed isolated-restore plan",
    };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

export async function inspectBackup(
  path: string,
  key: Buffer,
  destination: string,
) {
  const root = await privateDirectory(destination),
    work = await mkdtemp(join(root, ".inspect-"));
  await chmod(work, 0o700);
  try {
    const { copyFile } = await import("node:fs/promises");
    const snapshot = join(work, "snapshot.abk");
    await copyFile(path, snapshot);
    await chmod(snapshot, 0o600);
    const plain = join(work, "bundle.tar");
    await decrypt(snapshot, plain, key);
    const program =
      'import sys,json,tarfile;sys.path.insert(0,sys.argv[1]);from backup_archive import members;t=tarfile.open(sys.argv[2]);files={m.name:m for m in members(t)};m=files["client-manifest.json"];assert m.size<131072;print(json.dumps(json.load(t.extractfile(m))))';
    const loaded = JSON.parse(
      run("python3", ["-c", program, dirname(archiveHelper), plain], {
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
      }),
    );
    const manifest = validateManifest(loaded);
    await verifyBackup(manifest, snapshot, key, root);
    return {
      manifest,
      validated: true,
      cloudMutationsExecuted: 0,
      note: "Recovered public configuration; original secrets and backup decryption key remain outside this archive",
    };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
