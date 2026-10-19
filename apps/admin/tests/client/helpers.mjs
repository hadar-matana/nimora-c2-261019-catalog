import { createHash } from "node:crypto";
import { join } from "node:path";
export function client(
  slug = "alpha",
  root = "/private/tmp/atelier-unit-backups",
) {
  const suffix = slug === "alpha" ? "a" : "b";
  return {
    version: 1,
    slug,
    kind: "client",
    revision: "9539ed6f4c85a5e93ce1455ebae4b0b4ab46045b",
    accounts: {
      cloudflare: "f".repeat(32),
      sanityOrganization: "unit-organization",
    },
    sanity: {
      projectId: slug + "001",
      dataset: "catalog",
      apiVersion: "2025-02-19",
    },
    pages: {
      name: slug + "-store",
      domain: `https://shop.${slug}.invalid`,
      previewPolicy: "disabled",
    },
    worker: {
      name: slug + "-admin",
      adminOrigin: `https://admin.${slug}.invalid`,
      namespaceName: slug + "-admin_OwnerAuth",
      namespaceId: suffix.repeat(32),
    },
    studio: { name: slug + "-studio", appId: slug + "studio001" },
    git: {
      owner: "hadar-matana",
      repository: "unit-catalog",
      branch: "client/" + slug,
    },
    brand: {
      displayName: slug + " fashion",
      description: "Independent unit-test brand",
      tagline: "Unit fixture only",
      accentColor: "#335544",
      accentContrastColor: "#ffffff",
      logoUrl: null,
    },
    publishing: {
      enabled: false,
      sanityProjectId: slug + "001",
      dataset: "catalog",
      pagesProject: slug + "-store",
      hookId: null,
    },
    backup: {
      directory: join(root, slug),
      keyId: slug + "-unit-backup-key",
      retentionDays: 30,
      keepLast: 2,
    },
  };
}
export const metadata = (m) => ({
  cloudflareAccount: m.accounts.cloudflare,
  sanityOrganization: m.accounts.sanityOrganization,
  projectId: m.sanity.projectId,
  dataset: m.sanity.dataset,
  pagesProject: m.pages.name,
  workerName: m.worker.name,
  namespaceId: m.worker.namespaceId,
  revision: m.revision,
});
export const sha1 = (b) => createHash("sha1").update(b).digest("hex");

// Synthetic normalized provider inventory + Worker binding, never a live ID.
export const namespaceObservation = (m) => ({
  accountId: m.accounts.cloudflare,
  workerName: m.worker.name,
  namespaceName: m.worker.namespaceName,
  namespaceId: m.worker.namespaceId,
  scriptName: m.worker.name,
  className: "OwnerAuth",
  binding: {
    name: "AUTH",
    namespaceId: m.worker.namespaceId,
    scriptName: m.worker.name,
    className: "OwnerAuth",
  },
});
