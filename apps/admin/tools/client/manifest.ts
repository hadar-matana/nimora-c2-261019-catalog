import { createHash } from "node:crypto";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const repositoryRoot = fileURLToPath(
  new URL("../../../../", import.meta.url),
).replace(/\/$/, "");
import {
  brandConfig,
  cmsTarget,
} from "../../../../packages/config/deployment.mjs";

export type ClientManifest = {
  version: 1;
  slug: string;
  kind: "client";
  revision: string;
  accounts: { cloudflare: string; sanityOrganization: string };
  sanity: { projectId: string; dataset: string; apiVersion: string };
  pages: { name: string; domain: string; previewPolicy: "disabled" };
  worker: {
    name: string;
    adminOrigin: string;
    namespaceName: string;
    namespaceId: string | null;
  };
  studio: { name: string; appId: string };
  git: { owner: "hadar-matana"; repository: string; branch: string };
  brand: {
    displayName: string;
    description: string;
    tagline: string;
    accentColor: string;
    accentContrastColor: string;
    logoUrl: string | null;
  };
  publishing: {
    enabled: false;
    sanityProjectId: string;
    dataset: string;
    pagesProject: string;
    hookId: null;
  };
  backup: {
    directory: string;
    keyId: string;
    retentionDays: number;
    keepLast: number;
  };
};
const forbidden = [
  "3ahm0828",
  "fashion-catalog-demo",
  "atelier-admin",
  "atelier-admin.hadarmat.workers.dev",
  "fashion-catalog-demo.pages.dev",
  "fashion-catalog-demo.sanity.studio",
  "c0793f56356f4f1c8935e181e5d4d4ea",
  "ynlcza16xj3s49ywsxhw4953",
];
function object(
  value: unknown,
  keys: string[],
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label}: object required`);
  const obj = value as Record<string, unknown>;
  if (Object.keys(obj).sort().join("|") !== [...keys].sort().join("|"))
    throw new Error(
      `${label}: exact required fields only; secrets/unknown fields prohibited`,
    );
  return obj;
}
function text(value: unknown, label: string, regex?: RegExp) {
  if (
    typeof value !== "string" ||
    !value ||
    value !== value.trim() ||
    /[\x00-\x1f\x7f]/.test(value) ||
    (regex && !regex.test(value))
  )
    throw new Error(`${label}: invalid or missing value`);
  return value;
}
export function origin(value: unknown, label: string) {
  const raw = text(value, label);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label}: invalid URL`);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.origin !== raw ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
      url.hostname,
    )
  )
    throw new Error(`${label}: exact HTTPS origin required`);
  return url.origin;
}
function noDemo(value: string) {
  const normalized = value.toLowerCase();
  if (
    forbidden.some((v) => normalized.includes(v)) ||
    /(?:^|[-./])(?:demo|main|production-admin)(?:$|[-./])/.test(normalized)
  )
    throw new Error("Demo/reserved resource target prohibited");
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export const digest = (value: unknown) =>
  createHash("sha256").update(canonical(value)).digest("hex");
export function validateManifest(input: unknown): ClientManifest {
  const o = object(
    input,
    [
      "version",
      "slug",
      "kind",
      "revision",
      "accounts",
      "sanity",
      "pages",
      "worker",
      "studio",
      "git",
      "brand",
      "publishing",
      "backup",
    ],
    "manifest",
  );
  if (o.version !== 1 || o.kind !== "client")
    throw new Error("Client deployment kind/version required");
  const accounts = object(
    o.accounts,
    ["cloudflare", "sanityOrganization"],
    "accounts",
  );
  text(accounts.cloudflare, "Cloudflare account", /^[a-f0-9]{32}$/);
  text(
    accounts.sanityOrganization,
    "Sanity organization",
    /^[a-zA-Z0-9_-]{3,80}$/,
  );
  const slug = text(o.slug, "slug", /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
  if (slug.length > 32) throw new Error("Slug too long");
  noDemo(slug);
  if (
    [
      "atelier",
      "admin",
      "www",
      "api",
      "test",
      "null",
      "undefined",
      "restore",
      "backup",
      "client",
    ].includes(slug)
  )
    throw new Error("Reserved slug");
  text(o.revision, "revision", /^[a-f0-9]{40}$/);
  const cms = object(
    o.sanity,
    ["projectId", "dataset", "apiVersion"],
    "sanity",
  );
  cmsTarget(
    text(cms.projectId, "project"),
    text(cms.dataset, "dataset"),
    text(cms.apiVersion, "API version"),
  );
  noDemo(cms.projectId as string);
  noDemo(cms.dataset as string);
  const pages = object(o.pages, ["name", "domain", "previewPolicy"], "pages");
  const worker = object(
    o.worker,
    ["name", "adminOrigin", "namespaceName", "namespaceId"],
    "worker",
  );
  const studio = object(o.studio, ["name", "appId"], "studio");
  for (const [v, label] of [
    [pages.name, "Pages"],
    [worker.name, "Worker"],
    [worker.namespaceName, "DO namespace"],
    [studio.name, "Studio"],
  ] as const) {
    const name = text(v, label, /^[a-z][a-z0-9-]{2,57}$/);
    noDemo(name);
    if (!name.includes(slug))
      throw new Error(`${label}: name must contain client slug`);
  }
  const domain = origin(pages.domain, "Client domain"),
    admin = origin(worker.adminOrigin, "Admin origin");
  noDemo(domain);
  noDemo(admin);
  if (
    domain.endsWith(".pages.dev") &&
    new URL(domain).hostname !== `${pages.name}.pages.dev`
  )
    throw new Error("Pages domain must belong to this client project");
  if (
    admin.endsWith(".workers.dev") &&
    !new URL(admin).hostname.startsWith(`${worker.name}.`)
  )
    throw new Error("Worker domain must belong to this client Worker");
  if (domain === admin)
    throw new Error("Admin and storefront must have different origins");
  if (pages.previewPolicy !== "disabled")
    throw new Error("Automatic client previews must begin disabled");
  if (worker.namespaceId !== null) {
    text(worker.namespaceId, "DO namespace ID", /^[a-f0-9]{32}$/);
    noDemo(worker.namespaceId as string);
  }
  text(studio.appId, "Studio app ID", /^[a-zA-Z0-9_-]{6,80}$/);
  noDemo(studio.appId as string);
  const git = object(o.git, ["owner", "repository", "branch"], "git");
  if (git.owner !== "hadar-matana")
    throw new Error("Personal GitHub owner required");
  text(git.repository, "repository", /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/);
  if (git.branch !== `client/${slug}`)
    throw new Error(
      "Dedicated client/<slug> branch required; main and Phase A branches prohibited",
    );
  const brand = object(
    o.brand,
    [
      "displayName",
      "description",
      "tagline",
      "accentColor",
      "accentContrastColor",
      "logoUrl",
    ],
    "brand",
  );
  for (const k of [
    "displayName",
    "description",
    "tagline",
    "accentColor",
    "accentContrastColor",
  ])
    text(brand[k], `brand ${k}`);
  if ((brand.displayName as string).toUpperCase() === "ATELIER")
    throw new Error("Client-specific brand identity required");
  brandConfig("client", brand as ClientManifest["brand"]);
  if (brand.logoUrl !== null) {
    const logo = new URL(text(brand.logoUrl, "logo"));
    if (
      logo.protocol !== "https:" ||
      logo.username ||
      logo.password ||
      logo.hash
    )
      throw new Error("Public HTTPS logo required");
    noDemo(logo.href);
    if (
      logo.hostname === "cdn.sanity.io" &&
      !logo.pathname.startsWith(`/images/${cms.projectId}/${cms.dataset}/`)
    )
      throw new Error("Cross-client brand logo");
  }
  const publishing = object(
    o.publishing,
    ["enabled", "sanityProjectId", "dataset", "pagesProject", "hookId"],
    "publishing",
  );
  if (publishing.enabled !== false || publishing.hookId !== null)
    throw new Error(
      "New clients must start with publishing hooks disabled/unassigned",
    );
  if (
    publishing.sanityProjectId !== cms.projectId ||
    publishing.dataset !== cms.dataset ||
    publishing.pagesProject !== pages.name
  )
    throw new Error("Inconsistent CMS/publishing target");
  const backup = object(
    o.backup,
    ["directory", "keyId", "retentionDays", "keepLast"],
    "backup",
  );
  const dir = text(backup.directory, "backup directory");
  if (
    !isAbsolute(dir) ||
    resolve(dir) !== dir ||
    dir === "/" ||
    dir.startsWith(repositoryRoot + "/") ||
    dir === repositoryRoot
  )
    throw new Error("Backup directory must be canonical, outside repository");
  text(backup.keyId, "backup key identifier", /^[a-zA-Z0-9_-]{4,100}$/);
  if (
    !Number.isSafeInteger(backup.retentionDays) ||
    Number(backup.retentionDays) < 1 ||
    Number(backup.retentionDays) > 3650 ||
    !Number.isSafeInteger(backup.keepLast) ||
    Number(backup.keepLast) < 2 ||
    Number(backup.keepLast) > 1000
  )
    throw new Error("Invalid retention policy; keep at least two backups");
  return structuredClone(input) as ClientManifest;
}
export function validateRegistry(input: unknown): ClientManifest[] {
  if (!Array.isArray(input))
    throw new Error(
      "Registry must be an explicit array, including [] for the first client",
    );
  const manifests = input.map(validateManifest);
  for (let i = 0; i < manifests.length; i++)
    for (let j = 0; j < i; j++) {
      const a = manifests[i],
        b = manifests[j];
      const unique = (m: ClientManifest) =>
        [
          m.slug,
          m.sanity.projectId,
          m.pages.name,
          m.worker.name,
          m.worker.namespaceName,
          m.worker.namespaceId,
          m.pages.domain,
          m.worker.adminOrigin,
          m.studio.appId,
          m.backup.directory,
          m.backup.keyId,
          `${m.git.owner}/${m.git.repository}:${m.git.branch}`,
        ].filter((v) => v !== null);
      if (unique(a).some((v) => unique(b).includes(v)))
        throw new Error(
          "Duplicate client/resource/backup identity in registry",
        );
    }
  return manifests;
}
export function validateNewClient(input: unknown, registry: unknown) {
  const m = validateManifest(input);
  validateRegistry([m, ...validateRegistry(registry)]);
  return m;
}
export function targetConfirmation(m: ClientManifest, action: string) {
  return `${action}:${m.accounts.cloudflare}:${m.accounts.sanityOrganization}:${m.slug}:${m.sanity.projectId}/${m.sanity.dataset}:${m.pages.name}:${m.worker.name}:${m.worker.namespaceName}:${m.worker.namespaceId ?? "UNASSIGNED"}:${digest(m)}`;
}
export function confirmTarget(
  m: ClientManifest,
  action: string,
  confirmation: string,
) {
  if (confirmation !== targetConfirmation(m, action))
    throw new Error(
      "Exact action/account/resource/manifest confirmation required",
    );
}
