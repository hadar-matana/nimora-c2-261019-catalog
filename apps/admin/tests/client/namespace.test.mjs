import { test } from "node:test";
import assert from "node:assert/strict";
import { client, namespaceObservation } from "./helpers.mjs";
import {
  canonical,
  digest,
  targetConfirmation,
  validateManifest,
  validateRegistry,
  validateNewClient,
  validateNamespaceObservation,
} from "../../tools/client/manifest.ts";
import {
  bindObservedNamespace,
  configuration,
  provisionPlan,
} from "../../tools/client/provision.ts";

function assignment(m = client()) {
  const previous = structuredClone(m);
  previous.worker.namespaceId = null;
  const journal = {
    manifestHash: digest(previous),
    entries: [
      {
        id: "identity",
        status: "verified",
        observed: "fixture-personal-account",
      },
      { id: "cms", status: "verified", observed: "fixture-cms" },
      { id: "admin", status: "verified", observed: "fixture-worker-version" },
    ],
  };
  let creates = 0,
    lookups = 0;
  const provider = {
    lookup: async (op) => {
      lookups++;
      assert.equal(op.id, "binding");
      assert.equal(op.target, m.worker.namespaceName);
      return m.worker.namespaceId;
    },
    verify: async (op, id) =>
      op.id === "binding"
        ? id === m.worker.namespaceId
        : journal.entries.some((e) => e.id === op.id && e.observed === id),
    create: async () => {
      creates++;
      throw new Error(
        "Namespace assignment must never create a resource or invent an ID",
      );
    },
  };
  const run = () =>
    bindObservedNamespace(
      previous,
      m,
      [],
      journal,
      namespaceObservation(m),
      provider,
      targetConfirmation(m, "bind-namespace"),
    );
  return {
    m,
    previous,
    journal,
    provider,
    run,
    counts: () => ({ creates, lookups }),
  };
}

test("native namespace labels are exactly Worker_OwnerAuth; logical aliases, malformed/demo labels and IDs fail closed", () => {
  const m = client();
  assert.equal(
    validateManifest(m).worker.namespaceName,
    "alpha-admin_OwnerAuth",
  );
  assert.equal(
    configuration(m).worker.durable_objects.bindings[0].class_name,
    "OwnerAuth",
  );
  assert.deepEqual(configuration(m).worker.migrations[0].new_sqlite_classes, [
    "OwnerAuth",
  ]);
  for (const label of [
    "alpha-auth",
    "alpha-admin",
    "alpha-admin-ownerauth",
    "alpha-admin_ownerauth",
    "alpha-admin_OtherAuth",
    "alpha-admin_OwnerAuth_extra",
    "beta-admin_OwnerAuth",
    "atelier-admin_OwnerAuth",
    "alpha-admin__OwnerAuth",
    "alpha-admin/OwnerAuth",
    "alpha-admin_OwnerAuth ",
    " alpha-admin_OwnerAuth",
    "alpha-admin_OwnerAuth\n",
    "alpha-admin_ОwnerAuth",
  ]) {
    const bad = structuredClone(m);
    bad.worker.namespaceName = label;
    assert.throws(() => validateManifest(bad));
  }
  for (const id of [
    "c0793f56356f4f1c8935e181e5d4d4ea",
    "a".repeat(31),
    "a".repeat(33),
    "A".repeat(32),
    "../namespace",
    "",
  ]) {
    const bad = structuredClone(m);
    bad.worker.namespaceId = id;
    assert.throws(() => validateManifest(bad));
  }
  for (const [key, value] of [
    ["worker", "alpha-admin_OwnerAuth"],
    ["pages", "alpha-store_UPPER"],
  ]) {
    const bad = structuredClone(m);
    bad[key].name = value;
    assert.throws(() => validateManifest(bad));
  }
});

test("registry JSON round trip preserves native case and authoritative IDs; duplicate ID/name/Worker reuse is rejected", () => {
  const a = client(),
    b = client("beta");
  const roundTrip = JSON.parse(JSON.stringify([a, b]));
  assert.deepEqual(validateRegistry(roundTrip), [a, b]);
  assert.equal(canonical(roundTrip), canonical([a, b]));
  assert.equal(digest(roundTrip[0]), digest(a));
  assert.equal(roundTrip[0].worker.namespaceId, a.worker.namespaceId);
  const duplicate = structuredClone(b);
  duplicate.worker.namespaceId = a.worker.namespaceId;
  assert.throws(() => validateNewClient(duplicate, [a]), /Duplicate/);
  const sharedA = structuredClone(a),
    sharedB = structuredClone(b);
  for (const m of [sharedA, sharedB]) {
    m.worker.name = "alpha-beta-admin";
    m.worker.namespaceName = "alpha-beta-admin_OwnerAuth";
  }
  assert.throws(() => validateRegistry([sharedA, sharedB]), /Duplicate/);
  const planned = structuredClone(a);
  planned.worker.namespaceId = null;
  assert.equal(provisionPlan(planned, []).mode, "dry-run");
  assert.throws(
    () => validateNamespaceObservation(planned, namespaceObservation(a)),
    /Assigned observed/,
  );
});

test("namespace observation rejects wrong account, ID, native name, script, class, AUTH binding, missing fields and cross-client reuse", async () => {
  const a = client(),
    b = client("beta"),
    good = namespaceObservation(a);
  assert.deepEqual(validateNamespaceObservation(a, good), good);
  const mutations = [
    (o) => (o.accountId = "e".repeat(32)),
    (o) => (o.workerName = b.worker.name),
    (o) => (o.namespaceName = "alpha-auth"),
    (o) => (o.namespaceName = "atelier-admin_OwnerAuth"),
    (o) => (o.namespaceId = b.worker.namespaceId),
    (o) => (o.namespaceId = null),
    (o) => (o.scriptName = b.worker.name),
    (o) => (o.className = "OtherAuth"),
    (o) => (o.binding.name = "OTHER"),
    (o) => (o.binding.namespaceId = b.worker.namespaceId),
    (o) => (o.binding.scriptName = b.worker.name),
    (o) => (o.binding.className = "OtherAuth"),
    (o) => delete o.binding,
    (o) => delete o.scriptName,
    (o) => delete o.binding.namespaceId,
    (o) => (o.secret = "never-in-observations"),
  ];
  for (const mutate of mutations) {
    const bad = structuredClone(good);
    mutate(bad);
    assert.throws(() => validateNamespaceObservation(a, bad));
    const f = assignment(a);
    await assert.rejects(
      bindObservedNamespace(
        f.previous,
        a,
        [],
        f.journal,
        bad,
        f.provider,
        targetConfirmation(a, "bind-namespace"),
      ),
    );
    assert.deepEqual(f.counts(), { creates: 0, lookups: 0 });
  }
  assert.throws(() => validateNamespaceObservation(a, namespaceObservation(b)));
});

test("assignment requires an actual provider lookup and verified admin deployment; shaped but unprovisioned records cannot bind", async () => {
  const f = assignment();
  const rebound = await f.run();
  assert.equal(rebound.manifestHash, digest(f.m));
  assert.equal(f.journal.manifestHash, digest(f.previous));
  assert.deepEqual(f.counts(), { creates: 0, lookups: 1 });
  for (const provider of [
    { ...f.provider, lookup: async () => null },
    { ...f.provider, lookup: async () => client("beta").worker.namespaceId },
    { ...f.provider, verify: async () => false },
    { ...f.provider, verify: async (op) => op.id !== "admin" },
  ])
    await assert.rejects(
      bindObservedNamespace(
        f.previous,
        f.m,
        [],
        f.journal,
        namespaceObservation(f.m),
        provider,
        targetConfirmation(f.m, "bind-namespace"),
      ),
    );
  for (const entries of [
    [],
    f.journal.entries.filter((e) => e.id !== "admin"),
    f.journal.entries.map((e) =>
      e.id === "admin" ? { ...e, status: "uncertain" } : e,
    ),
  ]) {
    await assert.rejects(
      bindObservedNamespace(
        f.previous,
        f.m,
        [],
        { ...f.journal, entries },
        namespaceObservation(f.m),
        f.provider,
        targetConfirmation(f.m, "bind-namespace"),
      ),
    );
  }
  const nullId = structuredClone(f.m);
  nullId.worker.namespaceId = null;
  await assert.rejects(
    bindObservedNamespace(
      f.previous,
      nullId,
      [],
      f.journal,
      namespaceObservation(nullId),
      f.provider,
      targetConfirmation(nullId, "bind-namespace"),
    ),
  );
  await assert.rejects(
    bindObservedNamespace(
      f.previous,
      f.m,
      [client("beta")],
      f.journal,
      namespaceObservation(client("beta")),
      f.provider,
      targetConfirmation(f.m, "bind-namespace"),
    ),
  );
  assert.equal(f.counts().creates, 0);
});

test("C1 NIMORA shape passes with synthetic observed IDs and exact native label, but pending project/app IDs and absent resources remain refused", async () => {
  // These are isolated test literals, never an executable/live client manifest.
  const m = client();
  m.slug = "nimora-c2-261019";
  m.revision = "fd21bc581a6dc978ecbd766474c5f9c949f76a52";
  m.accounts.cloudflare = "f".repeat(32);
  m.accounts.sanityOrganization = "unit-organization";
  m.sanity.projectId = "unitnimora01";
  m.publishing.sanityProjectId = m.sanity.projectId;
  m.pages.name = m.slug + "-store";
  m.pages.domain = "https://" + m.pages.name + ".pages.dev";
  m.publishing.pagesProject = m.pages.name;
  m.worker.name = m.slug + "-admin";
  m.worker.adminOrigin = "https://" + m.worker.name + ".unit.workers.dev";
  m.worker.namespaceName = m.worker.name + "_OwnerAuth";
  m.studio.name = m.slug + "-studio";
  m.studio.appId = "unitnimorastudio01";
  m.git.repository = "nimora-c2-261019-catalog";
  m.git.branch = "client/" + m.slug;
  m.brand.displayName = "NIMORA C2 — Fictional Fashion Lab";
  m.backup.directory = "/private/tmp/atelier-namespace-unit/nimora-c2-261019";
  m.backup.keyId = m.slug + "-fixture-key";
  assert.equal(
    validateManifest(m).worker.namespaceName,
    "nimora-c2-261019-admin_OwnerAuth",
  );
  const f = assignment(m);
  assert.equal((await f.run()).manifestHash, digest(m));
  for (const key of ["projectId", "appId"]) {
    const pending = structuredClone(m);
    if (key === "projectId") {
      pending.sanity.projectId = null;
      pending.publishing.sanityProjectId = null;
    } else pending.studio.appId = null;
    assert.throws(() => validateManifest(pending));
  }
  await assert.rejects(
    bindObservedNamespace(
      f.previous,
      m,
      [],
      f.journal,
      namespaceObservation(m),
      { ...f.provider, lookup: async () => null },
      targetConfirmation(m, "bind-namespace"),
    ),
  );
  assert.equal(f.counts().creates, 0);
});
