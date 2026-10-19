import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { client } from "./helpers.mjs";
import {
  digest,
  validateManifest,
  validateNewClient,
  targetConfirmation,
} from "../../tools/client/manifest.ts";
import {
  configuration,
  provisionPlan,
  recoverOperation,
  verifyIsolationEvidence,
  credentialFingerprints,
  bindObservedNamespace,
  hookObservation,
  publishedFilter,
} from "../../tools/client/provision.ts";

test("dry-run has no provider/network path, generates consistent targets and disables writes/previews", () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("Dry-run must not contact a provider");
  };
  try {
    const m = client(),
      plan = provisionPlan(m, []);
    assert.equal(plan.mode, "dry-run");
    assert.equal(plan.mutationsExecuted, 0);
    assert.equal(plan.operations.length, 9);
    const c = configuration(m);
    assert.equal(
      c.storefront.NEXT_PUBLIC_SANITY_PROJECT_ID,
      m.sanity.projectId,
    );
    assert.equal(c.worker.vars.SANITY_PROJECT_ID, m.sanity.projectId);
    assert.equal(c.studio.SANITY_STUDIO_DATASET, m.sanity.dataset);
    assert.equal(c.worker.vars.SANITY_ALLOW_PRODUCTION_WRITES, "disabled");
    assert.equal(c.worker.vars.ADMIN_REMOTE_ENABLED, "disabled");
    assert.equal(c.worker.workers_dev, false);
    assert.equal(c.pages.source.config.preview_deployment_setting, "none");
    assert.equal(c.pages.source.config.production_deployments_enabled, false);
    assert.ok(!JSON.stringify(c).includes("3ahm0828"));
    assert.equal(
      Object.keys(c.pages.deployment_configs.preview.env_vars).length,
      0,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("negative manifest values, demo identities, credentials, inconsistent hooks and registry collisions fail closed", () => {
  const mutations = [
    (m) => delete m.kind,
    (m) => (m.kind = "demo"),
    (m) => (m.sanity.projectId = "3ahm0828"),
    (m) => (m.sanity.projectId = "../evil"),
    (m) => (m.sanity.dataset = "production/other"),
    (m) => (m.sanity.apiVersion = "2025-02-30"),
    (m) => (m.pages.name = "fashion-catalog-demo"),
    (m) => (m.worker.name = "atelier-admin"),
    (m) => (m.worker.namespaceId = "c0793f56356f4f1c8935e181e5d4d4ea"),
    (m) =>
      (m.worker.adminOrigin = "https://atelier-admin.hadarmat.workers.dev"),
    (m) => (m.pages.domain = "https://fashion-catalog-demo.pages.dev"),
    (m) => (m.pages.domain = "https://user:pass@alpha.invalid"),
    (m) => (m.worker.adminOrigin = "http://localhost"),
    (m) => (m.worker.adminOrigin += "/?x=1"),
    (m) => (m.pages.previewPolicy = "all"),
    (m) => (m.git.owner = "z-present-simple"),
    (m) => (m.git.branch = "main"),
    (m) => (m.brand.displayName = ""),
    (m) => (m.brand.displayName = "ATELIER"),
    (m) => (m.brand.accentColor = "red;display:none"),
    (m) =>
      (m.brand.logoUrl =
        "https://cdn.sanity.io/images/beta001/catalog/logo.png"),
    (m) => (m.publishing.pagesProject = "beta-store"),
    (m) => (m.publishing.sanityProjectId = "beta001"),
    (m) => (m.publishing.hookId = "demo-hook"),
    (m) => (m.publishing.enabled = true),
    (m) => (m.backup.directory = process.cwd()),
    (m) => (m.backup.keepLast = 1),
    (m) => (m.SANITY_API_TOKEN = "never-store-secrets"),
    (m) => (m.worker.secret = "bad"),
    (m) => (m.revision = "main"),
  ];
  for (const mutate of mutations) {
    const m = client();
    mutate(m);
    assert.throws(() => validateManifest(m));
  }
  const a = client(),
    b = client("beta");
  for (const path of [
    ["slug"],
    ["sanity", "projectId"],
    ["pages", "name"],
    ["worker", "namespaceId"],
    ["pages", "domain"],
    ["worker", "adminOrigin"],
    ["studio", "appId"],
    ["backup", "keyId"],
    ["backup", "directory"],
  ]) {
    const bad = structuredClone(b);
    if (path.length === 1) bad[path[0]] = a[path[0]];
    else bad[path[0]][path[1]] = a[path[0]][path[1]];
    assert.throws(() => validateNewClient(bad, [a]));
  }
  assert.equal(validateNewClient(b, [a]).slug, "beta");
  assert.throws(() => validateNewClient(a, undefined));
});
test("partial provider mutation persists intent, reconciles uncertain success once, rejects drift and tampered targets", async () => {
  const m = client(),
    op = provisionPlan(m, []).operations[0],
    journal = { manifestHash: digest(m), entries: [] };
  let creates = 0,
    resource = null;
  const persisted = [];
  const provider = {
    lookup: async () => resource,
    create: async () => {
      creates++;
      resource = "provider-observed-id";
      throw new Error("Connection lost after creation");
    },
    verify: async (_op, id) => id === resource,
  };
  const save = async (value) => persisted.push(value),
    confirmation = targetConfirmation(m, op.id);
  await assert.rejects(
    recoverOperation(m, op, journal, provider, save, "wrong"),
  );
  assert.equal(creates, 0);
  await assert.rejects(
    recoverOperation(
      m,
      { ...op, target: "atelier-admin" },
      journal,
      provider,
      save,
      confirmation,
    ),
  );
  assert.equal(creates, 0);
  await assert.rejects(
    recoverOperation(m, op, journal, provider, save, confirmation),
  );
  assert.equal(journal.entries[0].status, "uncertain");
  assert.equal(persisted[0].entries[0].status, "intent");
  await recoverOperation(m, op, journal, provider, save, confirmation);
  assert.equal(creates, 1);
  assert.equal(journal.entries[0].status, "verified");
  await recoverOperation(m, op, journal, provider, save, confirmation);
  assert.equal(creates, 1);
  resource = null;
  await assert.rejects(
    recoverOperation(m, op, journal, provider, save, confirmation),
  );
  const uncertain = {
    manifestHash: digest(m),
    entries: [{ id: op.id, status: "uncertain" }],
  };
  await assert.rejects(
    recoverOperation(m, op, uncertain, provider, save, confirmation),
  );
  assert.equal(creates, 1);
  await assert.rejects(
    recoverOperation(
      { ...m, revision: "a".repeat(40) },
      op,
      journal,
      provider,
      save,
      confirmation,
    ),
  );
});
test("CLI apply fails before reading files or credentials", () => {
  const r = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "tools/client/cli.ts", "apply"],
    { cwd: new URL("../..", import.meta.url).pathname, encoding: "utf8" },
  );
  assert.notEqual(r.status, 0);
  assert.ok(r.stderr.includes("Live mutations are not implemented"));
});
test("isolation attestation rejects reused credentials and cross-client hook/namespace; never enables writes", () => {
  const m = client(),
    other = client("beta");
  const fp = (c) => "1".repeat(63) + c;
  const evidence = {
    manifestHash: digest(m),
    namespaceId: m.worker.namespaceId,
    cmsProject: m.sanity.projectId,
    dataset: m.sanity.dataset,
    pages: m.pages.name,
    origin: m.worker.adminOrigin,
    previewPolicy: "disabled",
    hook: {
      projectId: m.sanity.projectId,
      dataset: m.sanity.dataset,
      pagesProject: m.pages.name,
      cloudflareAccount: m.accounts.cloudflare,
      branch: m.git.branch,
      destinationOrigin: "https://api.cloudflare.com",
      sanityDestinationFingerprint: "4".repeat(64),
      pagesDestinationFingerprint: "4".repeat(64),
    },
    credentials: {
      sanityWriteToken: fp("a"),
      ownerPassword: fp("b"),
      credentialVersion: fp("c"),
      backupKey: fp("d"),
    },
    otherCredentials: [
      {
        sanityWriteToken: fp("e"),
        ownerPassword: fp("f"),
        credentialVersion: "2".repeat(64),
        backupKey: "3".repeat(64),
      },
    ],
    checks: Object.fromEntries(
      [
        "providerOwnership",
        "namespaceBinding",
        "noBrowserSecrets",
        "sessionIsolation",
        "originCsrf",
        "readTarget",
        "writeTarget",
        "uploadTarget",
        "backupRestore",
        "revision",
        "hookIsolation",
      ].map((k) => [k, true]),
    ),
  };
  assert.equal(
    verifyIsolationEvidence(m, [other], evidence).writesEnabled,
    false,
  );
  for (const change of [
    (e) => (e.namespaceId = other.worker.namespaceId),
    (e) => (e.hook.pagesProject = "fashion-catalog-demo"),
    (e) => (e.hook.destinationOrigin = "https://beta-store.pages.dev"),
    (e) => (e.otherCredentials[0].ownerPassword = e.credentials.ownerPassword),
    (e) => (e.checks.sessionIsolation = false),
  ]) {
    const e = structuredClone(evidence);
    change(e);
    assert.throws(() => verifyIsolationEvidence(m, [other], e));
  }
});

test("credential equality uses private-key HMAC of actual secret values, not differently salted password hashes", () => {
  const audit = Buffer.alloc(32, 7),
    values = {
      sanityWriteToken: "fixture-write-token",
      ownerPassword: "fixture-password",
      credentialVersion: "version-one",
      backupKey: "fixture-encryption-key",
    };
  const a = credentialFingerprints(audit, values),
    b = credentialFingerprints(audit, {
      ...values,
      ownerPassword: "fixture-password",
    });
  assert.equal(a.ownerPassword, b.ownerPassword);
  assert.notEqual(
    a.ownerPassword,
    credentialFingerprints(audit, {
      ...values,
      ownerPassword: "different-password",
    }).ownerPassword,
  );
  assert.ok(Object.values(a).every((v) => /^[a-f0-9]{64}$/.test(v)));
  assert.ok(!JSON.stringify(a).includes("fixture-password"));
});

test("native publishing hook observations bind the private Cloudflare hook URL to the correct account, project and branch without logging it", () => {
  const m = client(),
    key = Buffer.alloc(32, 9),
    id = "11111111-2222-4333-8444-555555555555",
    url =
      "https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/" + id;
  const sanity = {
    projectId: m.sanity.projectId,
    dataset: m.sanity.dataset,
    url,
    filter: publishedFilter,
    isDisabled: true,
  };
  const pages = {
    accountId: m.accounts.cloudflare,
    project: m.pages.name,
    branch: m.git.branch,
    url,
    id,
  };
  const result = hookObservation(m, sanity, pages, key);
  assert.equal(
    result.pagesDestinationFingerprint,
    result.sanityDestinationFingerprint,
  );
  assert.ok(!JSON.stringify(result).includes(id));
  for (const changes of [
    { accountId: "e".repeat(32) },
    { project: "fashion-catalog-demo" },
    { branch: "main" },
    { id: "22222222-2222-4333-8444-555555555555" },
  ])
    assert.throws(() =>
      hookObservation(m, sanity, { ...pages, ...changes }, key),
    );
  for (const changes of [
    { projectId: "3ahm0828" },
    { dataset: "other" },
    { url: url + "0" },
    { isDisabled: false },
    { filter: "true" },
  ])
    assert.throws(() =>
      hookObservation(m, { ...sanity, ...changes }, pages, key),
    );
  assert.throws(() => hookObservation(m, sanity, pages, Buffer.alloc(31)));

  // Use only synthetic capability IDs. Never print a rejected private URL.
  for (const rejected of [
    url.replace("https:", "http:"),
    url.replace("api.cloudflare.com", "api.cloudflare.com.evil.invalid"),
    url.replace("api.cloudflare.com", "evil.invalid"),
    url.replace("api.cloudflare.com", "user:pass@api.cloudflare.com"),
    url.replace("api.cloudflare.com", "api.cloudflare.com:444"),
    url.replace("api.cloudflare.com", "api.cloudflare.com:443"),
    url.replace("/deploy_hooks/", "/"),
    url.replace("/deploy_hooks/", "/unrelated/"),
    url.replace("/deploy_hooks/", "/%64eploy_hooks/"),
    url.replace("/deploy_hooks/", "/other/../deploy_hooks/"),
    url.replace("/deploy_hooks/", "/deploy_hooks//"),
    url.replace("/deploy_hooks/", "/deploy_hooks/../"),
    url + "/",
    url + "/extra",
    url + "?token=synthetic",
    url + "#fragment",
    url + "?",
    url + "#",
    " " + url,
    url + "\n",
    "not-a-url",
    "//api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/" + id,
  ]) {
    assert.throws(
      () =>
        hookObservation(
          m,
          { ...sanity, url: rejected },
          { ...pages, url: rejected },
          key,
        ),
      (error) =>
        error.message === "Invalid private Pages deploy-hook URL" &&
        !error.message.includes(id),
    );
  }
  for (const invalidId of [
    "-".repeat(32),
    "1".repeat(31),
    "1".repeat(33),
    id.toUpperCase().replace("1", "A"),
    "1111-" + "2".repeat(27),
  ]) {
    const invalidUrl =
      "https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/" +
      invalidId;
    assert.throws(() =>
      hookObservation(
        m,
        { ...sanity, url: invalidUrl },
        { ...pages, id: invalidId, url: invalidUrl },
        key,
      ),
    );
  }
  const compactId = "1".repeat(32);
  const compactUrl =
    "https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/" +
    compactId;
  assert.ok(
    hookObservation(
      m,
      { ...sanity, url: compactUrl },
      { ...pages, id: compactId, url: compactUrl },
      key,
    ),
  );
});

test("provider-assigned namespace updates require exact observation, confirmation and re-verification of prior journal entries", async () => {
  const previous = client();
  previous.worker.namespaceId = null;
  const next = client();
  const journal = {
    manifestHash: digest(previous),
    entries: [
      { id: "identity", status: "verified", observed: "identity-evidence" },
    ],
  };
  let mutations = 0;
  const provider = {
    lookup: async () => null,
    create: async () => {
      mutations++;
      return "unexpected";
    },
    verify: async () => true,
  };
  const observation = {
    accountId: next.accounts.cloudflare,
    workerName: next.worker.name,
    namespaceName: next.worker.namespaceName,
    namespaceId: next.worker.namespaceId,
  };
  const rebound = await bindObservedNamespace(
    previous,
    next,
    [],
    journal,
    observation,
    provider,
    targetConfirmation(next, "bind-namespace"),
  );
  assert.equal(rebound.manifestHash, digest(next));
  assert.equal(journal.manifestHash, digest(previous));
  assert.equal(mutations, 0);
  await assert.rejects(
    bindObservedNamespace(
      previous,
      next,
      [],
      journal,
      { ...observation, namespaceId: "c".repeat(32) },
      provider,
      targetConfirmation(next, "bind-namespace"),
    ),
  );
  await assert.rejects(
    bindObservedNamespace(
      previous,
      { ...next, revision: "b".repeat(40) },
      [],
      journal,
      observation,
      provider,
      targetConfirmation(next, "bind-namespace"),
    ),
  );
});
