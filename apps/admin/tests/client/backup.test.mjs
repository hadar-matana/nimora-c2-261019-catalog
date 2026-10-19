import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  stat,
  symlink,
  utimes,
  readdir,
} from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { client, metadata, sha1 } from "./helpers.mjs";
import { digest, targetConfirmation } from "../../tools/client/manifest.ts";
import {
  backupKey,
  decrypt,
  inspectBackup,
  packBackup,
  verifyBackup,
  recoverLocal,
  restorePlan,
  retentionPlan,
  validateExport,
  validateInventory,
  normalizeDocument,
  privateDirectory,
} from "../../tools/client/backup.ts";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7mQAAAAASUVORK5CYII=",
  "base64",
);
async function fixture(root, mode = "valid") {
  const m = client("alpha", root),
    hash = sha1(png),
    assetId = `image-${hash}-1x1-png`,
    filename = `images/${hash}-1x1.png`;
  const raw = {
    _id: "product-one",
    _type: "product",
    _rev: "r1",
    name: "Fixture garment",
    priceAgorot: 10000,
    images: [
      {
        _type: "image",
        asset: { _type: "reference", _ref: assetId },
        alt: "Original",
      },
    ],
  };
  const doc = normalizeDocument(raw),
    draft = {
      ...doc,
      _id: "drafts.product-one",
      _rev: "r2",
      name: "Unpublished fixture",
    };
  const inventory = {
    version: 1,
    projectId: m.sanity.projectId,
    dataset: m.sanity.dataset,
    revision: m.revision,
    documents: [
      { _id: doc._id, _type: doc._type, _rev: doc._rev, document: doc },
      { _id: draft._id, _type: draft._type, _rev: draft._rev, document: draft },
      {
        _id: assetId,
        _type: "sanity.imageAsset",
        _rev: "asset-r1",
        size: png.length,
        sha1hash: hash,
        url: `https://cdn.sanity.io/images/${m.sanity.projectId}/${m.sanity.dataset}/${hash}-1x1.png`,
        assetMetadata: {
          _rev: "asset-r1",
          size: png.length,
          sha1hash: hash,
          originalFilename: "fixture.png",
        },
      },
    ],
  };
  const output = join(root, `export-${mode}.tar.gz`);
  const payload = {
    doc,
    draft,
    filename,
    assetMetadata: { ["image-" + hash]: inventory.documents[2].assetMetadata },
    png: png.toString("base64"),
    mode,
  };
  const program = `import tarfile,io,json,base64,sys\np=json.loads(sys.stdin.read());t=tarfile.open(sys.argv[1],'w:gz');prefix='native-export/'\ndef add(name,data):\n item=tarfile.TarInfo(prefix+name);item.size=len(data);t.addfile(item,io.BytesIO(data))\ndocs=[p['doc'],p['draft']]\nif p['mode']=='content':docs[0]['priceAgorot']=20000\nif p['mode']=='secret':docs[0]['password']='should-never-be-backed-up'\nif p['mode']=='oversized-document':docs[0]['name']='x'*(16*1024**2)\nif p['mode']=='count':docs=docs[:1]\nif p['mode']!='no-data':add('data.ndjson',('\\n'.join(json.dumps(d,ensure_ascii=False) for d in docs)+'\\n').encode())\nadd('assets.json',json.dumps({} if p['mode']=='metadata' else p['assetMetadata']).encode())\nif p['mode']!='missing-asset':add(p['filename'],base64.b64decode(p['png'])+(b'bad' if p['mode']=='corrupt' else b''))\nif p['mode']=='traversal':add('../../escape',b'bad')\nif p['mode']=='duplicate':add('data.ndjson',b'{}')\nif p['mode']=='symlink':\n item=tarfile.TarInfo(prefix+'images/unsafe');item.type=tarfile.SYMTYPE;item.linkname='/etc/passwd';t.addfile(item)\nt.close()`;
  const r = spawnSync("python3", ["-c", program, output], {
    input: JSON.stringify(payload),
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  return { m, inventory, output };
}
test("native backup validates independent full content/counts, all original bytes and rewritten references; negative archives rejected", async () => {
  const root = await mkdtemp("/private/tmp/atelier-backup-unit-");
  try {
    const good = await fixture(root);
    const result = validateExport(good.m, good.output, good.inventory);
    assert.equal(result.documentCount, 2);
    assert.equal(result.assetCount, 1);
    assert.equal(result.sourceDocumentCount, 3);
    for (const mode of [
      "missing-asset",
      "corrupt",
      "traversal",
      "duplicate",
      "symlink",
      "count",
      "content",
      "secret",
      "no-data",
      "metadata",
      "oversized-document",
    ]) {
      const f = await fixture(root, mode);
      assert.throws(() => validateExport(f.m, f.output, f.inventory), mode);
    }
    const wrong = structuredClone(good.inventory);
    wrong.documents[2].url = wrong.documents[2].url.replace(
      "alpha001",
      "3ahm0828",
    );
    assert.throws(() => validateInventory(good.m, wrong));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("encrypted backup round-trip, wrong key/tampering rejection, local recovery and isolated restore guard", async () => {
  const root = await mkdtemp("/private/tmp/atelier-roundtrip-unit-");
  try {
    const f = await fixture(root);
    const key = randomBytes(32);
    assert.deepEqual(backupKey(key.toString("base64")), key);
    assert.throws(() => backupKey("invalid"));
    const packed = await packBackup(
      f.m,
      f.output,
      f.inventory,
      key,
      metadata(f.m),
    );
    assert.equal(packed.validated, true);
    assert.equal((await stat(packed.path)).mode & 0o777, 0o600);
    assert.ok(
      !(await readFile(packed.path)).includes(Buffer.from("Fixture garment")),
    );
    const inspected = await inspectBackup(
      packed.path,
      key,
      join(root, "lost-registry-recovery"),
    );
    assert.deepEqual(inspected.manifest, f.m);
    const checked = await verifyBackup(f.m, packed.path, key);
    assert.equal(checked.documentCount, 2);
    assert.equal(checked.assetCount, 1);
    await assert.rejects(verifyBackup(f.m, packed.path, randomBytes(32)));
    const existing = join(root, "preserve-existing");
    await writeFile(existing, "pre-existing work");
    await assert.rejects(decrypt(packed.path, existing, key));
    assert.equal(await readFile(existing, "utf8"), "pre-existing work");
    const bytes = await readFile(packed.path);
    bytes[bytes.length - 20] ^= 1;
    const damaged = join(root, "damaged.abk");
    await writeFile(damaged, bytes);
    await assert.rejects(verifyBackup(f.m, damaged, key));
    const recovered = await recoverLocal(
      f.m,
      packed.path,
      key,
      join(root, "recovery"),
    );
    assert.equal(
      validateExport(f.m, recovered.path, f.inventory).assetCount,
      1,
    );
    await assert.rejects(
      recoverLocal(f.m, packed.path, key, join(root, "recovery")),
    );
    const target = client("beta", root);
    const evidence = {
      manifestHash: digest(target),
      projectId: target.sanity.projectId,
      dataset: target.sanity.dataset,
      documentCount: 0,
      observedAt: new Date().toISOString(),
      writesDisabled: true,
      hooksDisabled: true,
    };
    const confirmation = targetConfirmation(target, "isolated-restore");
    assert.equal(
      restorePlan(f.m, target, [], confirmation, evidence).mutationsExecuted,
      0,
    );
    assert.ok(
      !restorePlan(f.m, target, [], confirmation, evidence).command.includes(
        "--replace",
      ),
    );
    assert.throws(() =>
      restorePlan(f.m, f.m, [], targetConfirmation(f.m, "isolated-restore"), {
        ...evidence,
        manifestHash: digest(f.m),
      }),
    );
    assert.throws(() => restorePlan(f.m, target, [], "wrong", evidence));
    assert.throws(() =>
      restorePlan(f.m, target, [], confirmation, {
        ...evidence,
        documentCount: 1,
      }),
    );
    assert.throws(() =>
      restorePlan(f.m, target, [], confirmation, {
        ...evidence,
        observedAt: "2000-01-01T00:00:00Z",
      }),
    );
    assert.ok(
      (await readdir(f.m.backup.directory)).every(
        (n) =>
          !n.startsWith(".verify-") &&
          !n.startsWith(".pack-") &&
          !n.startsWith(".recover-"),
      ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("private destinations, symlink rejection, retention is a non-destructive plan and keeps newest two", async () => {
  const root = await mkdtemp("/private/tmp/atelier-retention-unit-");
  try {
    const m = client("alpha", root);
    await privateDirectory(m.backup.directory);
    for (let n = 0; n < 4; n++) {
      const file = join(m.backup.directory, `alpha-${n}.abk`);
      await writeFile(file, "encrypted-fixture-not-a-real-backup", {
        mode: 0o600,
      });
      const time = new Date(Date.now() - (100 - n) * 86400000);
      await utimes(file, time, time);
    }
    const result = await retentionPlan(m);
    assert.equal(result.keep.length, 2);
    assert.equal(result.candidates.length, 2);
    assert.equal(result.deletionsExecuted, 0);
    assert.equal((await readdir(m.backup.directory)).length, 4);
    await symlink(m.backup.directory, join(root, "linked"));
    await assert.rejects(privateDirectory(join(root, "linked")));
    await mkdir(join(root, "unsafe"), { mode: 0o755 });
    await assert.rejects(privateDirectory(join(root, "unsafe")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("isolated restore rehearsal reads the recovered native archive into a mock target only, preserving draft/product and original asset identity", async () => {
  const root = await mkdtemp("/private/tmp/atelier-restore-rehearsal-");
  try {
    const f = await fixture(root),
      key = randomBytes(32),
      packed = await packBackup(f.m, f.output, f.inventory, key, metadata(f.m));
    const restored = await recoverLocal(
      f.m,
      packed.path,
      key,
      join(root, "staging"),
    );
    const target = client("beta", root);
    const sourceBefore = JSON.stringify(f.inventory);
    const proof = {
      manifestHash: digest(target),
      projectId: target.sanity.projectId,
      dataset: target.sanity.dataset,
      documentCount: 0,
      observedAt: new Date().toISOString(),
      writesDisabled: true,
      hooksDisabled: true,
    };
    restorePlan(
      f.m,
      target,
      [],
      targetConfirmation(target, "isolated-restore"),
      proof,
    );
    const result = spawnSync(
      "python3",
      [
        "-c",
        `import tarfile,json,sys;t=tarfile.open(sys.argv[1]);name=next(m for m in t.getmembers() if m.name.endswith('/data.ndjson'));print(json.dumps([json.loads(line) for line in t.extractfile(name) if line.strip()]))`,
        restored.path,
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0);
    const docs = JSON.parse(result.stdout),
      mockTarget = new Map();
    const assets = new Map(
      Object.entries(
        f.inventory.documents
          .filter((d) => d._type === "sanity.imageAsset")
          .reduce((all, asset) => {
            const name = asset._id
              .replace(/^image-/, "")
              .replace(/-png$/, ".png");
            all["images/" + name] = asset._id;
            return all;
          }, {}),
      ),
    );
    function restoreValue(value) {
      if (Array.isArray(value)) return value.map(restoreValue);
      if (value && typeof value === "object") {
        const { _sanityAsset, ...other } = value;
        if (_sanityAsset) {
          const id = assets.get(
            _sanityAsset.replace(/^image@file:\/\/\.\//, ""),
          );
          assert.ok(id);
          return {
            ...Object.fromEntries(
              Object.entries(other).map(([k, v]) => [k, restoreValue(v)]),
            ),
            asset: { _type: "reference", _ref: id },
          };
        }
        return Object.fromEntries(
          Object.entries(other).map(([k, v]) => [k, restoreValue(v)]),
        );
      }
      return value;
    }
    for (const doc of docs) {
      assert.equal(mockTarget.has(doc._id), false);
      mockTarget.set(doc._id, restoreValue(doc));
    }
    assert.equal(mockTarget.size, 2);
    assert.ok(mockTarget.has("drafts.product-one"));
    assert.deepEqual(
      normalizeDocument(mockTarget.get("product-one")),
      f.inventory.documents[0].document,
    );
    assert.deepEqual(
      normalizeDocument(mockTarget.get("drafts.product-one")),
      f.inventory.documents[1].document,
    );
    const targetAssetUrl = `https://cdn.sanity.io/images/${target.sanity.projectId}/${target.sanity.dataset}/${sha1(png)}-1x1.png`;
    assert.ok(!targetAssetUrl.includes(f.m.sanity.projectId));
    assert.equal(JSON.stringify(f.inventory), sourceBefore);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
