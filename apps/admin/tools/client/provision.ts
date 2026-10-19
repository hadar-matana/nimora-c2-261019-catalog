import { createHmac } from "node:crypto";
import {
  AUTH_CLASS_NAME,
  AUTH_BINDING_NAME,
  canonical,
  confirmTarget,
  digest,
  validateNewClient,
  validateNamespaceObservation,
  type ClientManifest,
  type NamespaceObservation,
} from "./manifest.ts";

export type Operation = {
  id: string;
  target: string;
  action: string;
  requires: string[];
};
export function provisionPlan(input: unknown, registry: unknown) {
  const m = validateNewClient(input, registry);
  const operations: Operation[] = [
    {
      id: "identity",
      target: `${m.accounts.cloudflare}/${m.accounts.sanityOrganization}`,
      action:
        "Verify personal provider identities, ownership and empty target inventory (GET only)",
      requires: [],
    },
    {
      id: "cms",
      target: `${m.sanity.projectId}/${m.sanity.dataset}`,
      action:
        "Verify separately authorized Sanity project; create empty public dataset only if absent",
      requires: ["identity"],
    },
    {
      id: "pages",
      target: m.pages.name,
      action:
        "Create dedicated Git-backed Pages project with exact client branch; automatic previews disabled",
      requires: ["identity"],
    },
    {
      id: "branding",
      target: m.sanity.projectId,
      action:
        "Set client site settings after independent backup/export checks; never copy demo content",
      requires: ["cms"],
    },
    {
      id: "admin",
      target: m.worker.name,
      action:
        "Build branded static admin and deploy read-only Worker; initial deployment allocates its own SQLite DO namespace",
      requires: ["cms"],
    },
    {
      id: "binding",
      target: m.worker.namespaceName,
      action:
        "Record provider-assigned DO ID, verify unique namespace/binding and committed revision; do not share sessions",
      requires: ["admin"],
    },
    {
      id: "secrets",
      target: m.worker.adminOrigin,
      action:
        "Install new least-privilege server secrets interactively into this Worker only; no browser secrets",
      requires: ["binding"],
    },
    {
      id: "verify",
      target: m.pages.domain,
      action:
        "Verify DNS/TLS, deployment target, credentials/session/CSRF isolation, backup and isolated restore",
      requires: ["pages", "branding", "secrets"],
    },
    {
      id: "publishing",
      target: m.pages.name,
      action:
        "Separately authorize dedicated hook and admin-write activation after all verification evidence passes",
      requires: ["verify"],
    },
  ];
  return {
    mode: "dry-run",
    mutationsExecuted: 0,
    manifestHash: digest(m),
    manifest: m,
    operations,
    configuration: configuration(m),
  };
}
export function configuration(m: ClientManifest) {
  const common = {
    NEXT_PUBLIC_DEPLOYMENT_KIND: "client",
    NEXT_PUBLIC_SANITY_PROJECT_ID: m.sanity.projectId,
    NEXT_PUBLIC_SANITY_DATASET: m.sanity.dataset,
    NEXT_PUBLIC_SANITY_API_VERSION: m.sanity.apiVersion,
    NEXT_PUBLIC_SITE_URL: m.pages.domain,
  };
  const admin = {
    NEXT_PUBLIC_ADMIN_DEPLOYMENT_KIND: "client",
    NEXT_PUBLIC_ADMIN_BRAND_NAME: m.brand.displayName,
    NEXT_PUBLIC_ADMIN_BRAND_DESCRIPTION: m.brand.description,
    NEXT_PUBLIC_ADMIN_ACCENT_COLOR: m.brand.accentColor,
    NEXT_PUBLIC_ADMIN_ACCENT_CONTRAST_COLOR: m.brand.accentContrastColor,
    ...(m.brand.logoUrl ? { NEXT_PUBLIC_ADMIN_LOGO_URL: m.brand.logoUrl } : {}),
  };
  const worker = {
    name: m.worker.name,
    account_id: m.accounts.cloudflare,
    main: "index.ts",
    compatibility_date: "2026-10-13",
    compatibility_flags: ["nodejs_compat"],
    workers_dev: false,
    preview_urls: false,
    assets: { directory: "../out", binding: "ASSETS", run_worker_first: true },
    durable_objects: {
      bindings: [{ name: AUTH_BINDING_NAME, class_name: AUTH_CLASS_NAME }],
    },
    migrations: [{ tag: "v1", new_sqlite_classes: [AUTH_CLASS_NAME] }],
    vars: {
      LOCAL_COMPAT_PROOF: "0",
      ADMIN_REMOTE_ENABLED: "disabled",
      ADMIN_ORIGIN: m.worker.adminOrigin,
      SANITY_MODE: "production",
      SANITY_PROJECT_ID: m.sanity.projectId,
      SANITY_DATASET: m.sanity.dataset,
      SANITY_API_VERSION: m.sanity.apiVersion,
      SANITY_ALLOW_PRODUCTION_WRITES: "disabled",
      SANITY_UPLOAD_RETEST_UNTIL: "0",
      ADMIN_QA_PRODUCT_ID: "",
      SESSION_TTL_SECONDS: "28800",
    },
  };
  return {
    storefront: common,
    admin,
    worker,
    studio: {
      SANITY_STUDIO_DEPLOYMENT_KIND: "client",
      SANITY_STUDIO_PROJECT_ID: m.sanity.projectId,
      SANITY_STUDIO_DATASET: m.sanity.dataset,
      SANITY_STUDIO_API_VERSION: m.sanity.apiVersion,
      SANITY_STUDIO_NAME: m.studio.name,
      SANITY_STUDIO_TITLE: m.brand.displayName,
      SANITY_STUDIO_APP_ID: m.studio.appId,
    },
    pages: {
      name: m.pages.name,
      production_branch: m.git.branch,
      build_config: {
        root_dir: "",
        build_command: "pnpm build:storefront",
        destination_dir: "apps/storefront/out",
      },
      source: {
        type: "github",
        config: {
          owner: m.git.owner,
          repo_name: m.git.repository,
          production_branch: m.git.branch,
          production_deployments_enabled: false,
          preview_deployment_setting: "none",
          preview_branch_includes: [],
          preview_branch_excludes: ["*"],
        },
      },
      deployment_configs: {
        production: {
          env_vars: Object.fromEntries(
            Object.entries(common).map(([k, value]) => [
              k,
              { type: "plain_text", value },
            ]),
          ),
        },
        preview: { env_vars: {} },
      },
    },
  };
}
export type Journal = {
  manifestHash: string;
  entries: {
    id: string;
    status: "intent" | "verified" | "uncertain";
    observed?: string;
  }[];
};
export type Provider = {
  lookup: (op: Operation) => Promise<string | null>;
  create: (op: Operation) => Promise<string>;
  verify: (op: Operation, id: string) => Promise<boolean>;
};
// Dependency-injected state machine for tests. There is intentionally no live provider adapter or apply CLI.
export async function recoverOperation(
  m: ClientManifest,
  op: Operation,
  journal: Journal,
  provider: Provider,
  save: (j: Journal) => Promise<void>,
  confirmation: string,
) {
  const allowed = provisionPlan(m, []).operations.find(
    (candidate) => candidate.id === op.id,
  );
  if (!allowed || canonical(allowed) !== canonical(op))
    throw new Error("Operation target does not match manifest");
  confirmTarget(m, op.id, confirmation);
  if (journal.manifestHash !== digest(m))
    throw new Error("Journal belongs to another manifest/revision");
  for (const dependency of op.requires)
    if (
      !journal.entries.some(
        (e) => e.id === dependency && e.status === "verified",
      )
    )
      throw new Error("Prerequisite not verified");
  const prior = journal.entries.find((e) => e.id === op.id);
  if (prior?.status === "verified") {
    if (!prior.observed || !(await provider.verify(op, prior.observed)))
      throw new Error("Resource drift; stop");
    return;
  }
  if (prior) {
    const observed = await provider.lookup(op);
    if (!observed || !(await provider.verify(op, observed)))
      throw new Error(
        "Uncertain operation requires reconciliation; never blindly retry",
      );
    prior.status = "verified";
    prior.observed = observed;
    await save(structuredClone(journal));
    return;
  }
  if (await provider.lookup(op))
    throw new Error("Unclaimed existing resource; do not adopt/overwrite");
  const entry: Journal["entries"][number] = { id: op.id, status: "intent" };
  journal.entries.push(entry);
  await save(structuredClone(journal));
  try {
    const id = await provider.create(op);
    if (!(await provider.verify(op, id)))
      throw new Error("Created resource verification failed");
    entry.status = "verified";
    entry.observed = id;
    await save(structuredClone(journal));
  } catch {
    entry.status = "uncertain";
    await save(structuredClone(journal));
    throw new Error(
      "Operation uncertain: reconcile provider inventory; no automatic retry or deletion",
    );
  }
}
export function verifyIsolationEvidence(
  m: ClientManifest,
  registry: unknown,
  evidence: unknown,
) {
  validateNewClient(m, registry);
  const e = evidence as {
    manifestHash?: string;
    namespaceId?: string;
    namespaceObservation?: unknown;
    cmsProject?: string;
    dataset?: string;
    pages?: string;
    origin?: string;
    previewPolicy?: string;
    hook?: {
      projectId: string;
      dataset: string;
      pagesProject: string;
      cloudflareAccount: string;
      branch: string;
      destinationOrigin: string;
      sanityDestinationFingerprint: string;
      pagesDestinationFingerprint: string;
    };
    credentials?: Record<string, string>;
    otherCredentials?: Record<string, string>[];
    checks?: Record<string, boolean>;
  };
  if (
    !e ||
    e.manifestHash !== digest(m) ||
    !m.worker.namespaceId ||
    e.namespaceId !== m.worker.namespaceId ||
    e.cmsProject !== m.sanity.projectId ||
    e.dataset !== m.sanity.dataset ||
    e.pages !== m.pages.name ||
    e.origin !== m.worker.adminOrigin ||
    e.previewPolicy !== "disabled"
  )
    throw new Error("Observed targets do not match client manifest");
  validateNamespaceObservation(m, e.namespaceObservation);
  if (
    e.hook &&
    (e.hook.projectId !== m.sanity.projectId ||
      e.hook.dataset !== m.sanity.dataset ||
      e.hook.pagesProject !== m.pages.name ||
      e.hook.cloudflareAccount !== m.accounts.cloudflare ||
      e.hook.branch !== m.git.branch ||
      e.hook.destinationOrigin !== "https://api.cloudflare.com" ||
      !/^[a-f0-9]{64}$/.test(e.hook.sanityDestinationFingerprint) ||
      e.hook.sanityDestinationFingerprint !==
        e.hook.pagesDestinationFingerprint)
  )
    throw new Error("Cross-client/demo publishing hook");
  const required = [
    "sanityWriteToken",
    "ownerPassword",
    "credentialVersion",
    "backupKey",
  ];
  if (
    !e.credentials ||
    !e.otherCredentials ||
    !Array.isArray(e.otherCredentials) ||
    e.otherCredentials.length < (registry as unknown[]).length
  )
    throw new Error(
      "Credential uniqueness attestation required (fingerprints only)",
    );
  for (const k of required) {
    const fp = e.credentials[k];
    if (!/^[a-f0-9]{64}$/.test(fp ?? ""))
      throw new Error("Credential HMAC fingerprint required");
    if (e.otherCredentials.some((other) => Object.values(other).includes(fp)))
      throw new Error("Credential reuse detected");
  }
  if (new Set(Object.values(e.credentials)).size !== required.length)
    throw new Error("Credential identities must be distinct");
  for (const check of [
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
  ])
    if (e.checks?.[check] !== true)
      throw new Error(`Live verification required: ${check}`);
  // An attestation validator, not proof that remote checks happened. Never auto-enables writes.
  return {
    manifestHash: digest(m),
    attestationValidated: true,
    writesEnabled: false,
    canonicalEvidence: canonical(e),
  };
}

export function credentialFingerprints(
  auditKey: Buffer,
  credentials: Record<string, string>,
) {
  const keys = [
    "sanityWriteToken",
    "ownerPassword",
    "credentialVersion",
    "backupKey",
  ];
  if (
    auditKey.length !== 32 ||
    Object.keys(credentials).sort().join("|") !== [...keys].sort().join("|") ||
    keys.some((k) => !credentials[k])
  )
    throw new Error("Private audit key and exact credential inputs required");
  // The same audit key must be used across the registry. Never publish this key or raw secrets.
  return Object.fromEntries(
    keys.map((k) => [
      k,
      createHmac("sha256", auditKey).update(credentials[k]).digest("hex"),
    ]),
  );
}

export const publishedFilter =
  '!(_id in path("drafts.**")) && !(_id in path("versions.**")) && _type in ["product","category","collection","galleryImage","siteSettings","catalogOptions"]';
export function hookObservation(
  m: ClientManifest,
  sanity: {
    projectId: string;
    dataset: string;
    url: string;
    filter: string;
    isDisabled: boolean;
  },
  pages: {
    accountId: string;
    project: string;
    branch: string;
    url: string;
    id: string;
  },
  auditKey: Buffer,
) {
  if (
    sanity.projectId !== m.sanity.projectId ||
    sanity.dataset !== m.sanity.dataset ||
    pages.accountId !== m.accounts.cloudflare ||
    pages.project !== m.pages.name ||
    pages.branch !== m.git.branch ||
    sanity.url !== pages.url ||
    sanity.filter !== publishedFilter ||
    sanity.isDisabled !== true ||
    auditKey.length !== 32
  )
    throw new Error(
      "Hook observations must match this client and start disabled",
    );
  let url: URL;
  try {
    url = new URL(pages.url);
  } catch {
    // Never attach the input/capability URL to errors or logs.
    throw new Error("Invalid private Pages deploy-hook URL");
  }
  // id is normalized from the provider record's hook_id; ownership/branch
  // come from independently observed metadata, never from the capability URL.
  const expectedUrl = `https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/${pages.id}`;
  if (
    url.origin !== "https://api.cloudflare.com" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== `/client/v4/pages/webhooks/deploy_hooks/${pages.id}` ||
    pages.url !== expectedUrl ||
    !/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/.test(
      pages.id,
    )
  )
    throw new Error("Invalid private Pages deploy-hook URL");
  const fingerprint = createHmac("sha256", auditKey)
    .update(sanity.url)
    .digest("hex");
  return {
    projectId: m.sanity.projectId,
    dataset: m.sanity.dataset,
    pagesProject: m.pages.name,
    cloudflareAccount: m.accounts.cloudflare,
    branch: m.git.branch,
    destinationOrigin: url.origin,
    sanityDestinationFingerprint: fingerprint,
    pagesDestinationFingerprint: fingerprint,
  };
}

export async function bindObservedNamespace(
  previous: ClientManifest,
  next: ClientManifest,
  registry: unknown,
  journal: Journal,
  observed: NamespaceObservation,
  provider: Provider,
  confirmation: string,
) {
  validateNewClient(next, registry);
  confirmTarget(next, "bind-namespace", confirmation);
  validateNamespaceObservation(next, observed);
  const expected = structuredClone(previous);
  expected.worker.namespaceId = next.worker.namespaceId;
  if (
    previous.worker.namespaceId !== null ||
    !next.worker.namespaceId ||
    canonical(expected) !== canonical(next) ||
    journal.manifestHash !== digest(previous) ||
    observed.accountId !== next.accounts.cloudflare ||
    observed.workerName !== next.worker.name ||
    observed.namespaceName !== next.worker.namespaceName ||
    observed.namespaceId !== next.worker.namespaceId
  )
    throw new Error(
      "Only an observed namespace assignment may rebind the manifest journal",
    );
  const operations = provisionPlan(next, registry).operations;
  const bindingOperation = operations.find((op) => op.id === "binding")!;
  for (const dependency of bindingOperation.requires)
    if (
      !journal.entries.some(
        (entry) => entry.id === dependency && entry.status === "verified",
      )
    )
      throw new Error(
        "Verified admin deployment required before namespace assignment",
      );
  // A shaped observation is not proof of existence: independently reconcile the
  // provider ID even when the caller supplies an apparently complete record.
  const actualId = await provider.lookup(bindingOperation);
  if (
    actualId !== next.worker.namespaceId ||
    !(await provider.verify(bindingOperation, actualId))
  )
    throw new Error(
      "Namespace not independently observed and verified; no assignment allowed",
    );
  for (const entry of journal.entries) {
    const op = operations.find((o) => o.id === entry.id);
    if (
      !op ||
      entry.status !== "verified" ||
      !entry.observed ||
      !(await provider.verify(op, entry.observed))
    )
      throw new Error(
        "Re-verify every completed resource before namespace assignment",
      );
  }
  return { ...structuredClone(journal), manifestHash: digest(next) };
}
