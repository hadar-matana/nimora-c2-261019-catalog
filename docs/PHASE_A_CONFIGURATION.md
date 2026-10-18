# Phase A configuration and local verification

Branch: `codex/phase-a-client-configuration`, based on approved storefront commit `e33d95253f249ba401c9affb70716dab0a812f2a`.

## Source recovery

Before implementation, every one of the **39 SHA-256 entries** in `premium-admin-release-manifest.json` matched the working tree. This includes worker code, release configuration, admin components, package manifest and demo assets. The recorded release Worker version is `252a65f1-29b4-4801-9af9-0fadb5286505`. This is local manifest verification, not a new remote deployment inspection. The recovery commit preserves the complete existing admin source/tests/operational scripts and required Studio catalog-options schema, workspace scripts and lockfile.

Ignored: dependency directories, `.next`, `out`, `.wrangler`, `.dev.vars*`, `.env*` except examples, logs and incremental compiler state. No credentials, environment files, tokens or generated build output belong in Git. Existing historical screenshots/JSON evidence remain local unless explicitly included in the Phase A evidence directory. A credential-pattern scan of recovered text files found no private keys or recognizable access tokens. Local fixture credentials are generated, stored in ignored files, and never committed.

The separate technical readiness audit mentioned by the request was not found in the repository. The supplied Phase A requirements, manifest and existing architecture/integration/verification documents were used. Historical documents describe earlier deployments and approvals, not authorization to run cloud operations now.

## Public storefront build variables

All builds must explicitly set:

- `NEXT_PUBLIC_DEPLOYMENT_KIND`: `demo` or `client`.
- `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `NEXT_PUBLIC_SANITY_API_VERSION` (calendar date, for example `2025-02-19`).
- `NEXT_PUBLIC_SITE_URL`: canonical HTTPS storefront URL (HTTP is accepted only for loopback development).
- Optional `NEXT_PUBLIC_STUDIO_URL`: explicit Studio URL; no demo fallback.

`apps/storefront/.env.example` is the explicit approved demo configuration. Copy it to an ignored local environment file for demo development. Client builds must replace the CMS target, deployment kind and URL. These values are public and embedded at build time; changing the deployed environment without rebuilding cannot change a static export. The storefront uses published, token-free queries. Do not add a write token to any public environment variable.

## Worker runtime variables and secrets

Required for a real CMS connection:

- `SANITY_MODE=production` (the name describes the remote transport, not the dataset).
- `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_API_VERSION`.
- `SANITY_API_TOKEN`: server-only, least-privilege credential scoped to that client's CMS project.

The shared validator derives the API origin and `https://cdn.sanity.io/images/<project>/<dataset>/` prefix. Queries, mutations, targeted asset reads and streaming uploads all use the same validated target. Returned upload URLs must exactly match the asset ID and configured CDN prefix; other projects, paths and query suffixes are rejected. Missing/invalid configuration or an unknown transport mode fails before network access. No demo fallback exists.

Existing authentication configuration is unchanged: `ADMIN_ORIGIN`, `ADMIN_REMOTE_ENABLED`, `LOCAL_COMPAT_PROOF`, secret `OWNER_USERNAME`, secret `OWNER_PASSWORD_HASH`, secret `CREDENTIAL_VERSION`, optional `SESSION_TTL_SECONDS`. Production writes still require `SANITY_ALLOW_PRODUCTION_WRITES=approved`; the existing bounded upload-retest and QA gates retain their behavior. Client provisioning and credential creation are outside Phase A.

`worker/wrangler.release.jsonc` is explicitly the historical **ATELIER demo** release configuration, now with explicit CMS target variables. Never use it for a client. `worker/wrangler.client.example.jsonc` is a disabled template with empty required targets and no production account or origin. No template has been deployed. The local configuration uses loopback-only `SANITY_MODE=fixture`, `SANITY_FIXTURE_ORIGIN`, and explicit fixture target variables. The in-memory fixture cannot contact Sanity.

Historical operator scripts retain their reviewed demo resource identifiers for recovery/audit purposes. Cloud control/provisioning entry points now reject execution unless the separate `ATELIER_LEGACY_DEMO_OPERATIONS=approved` opt-in is supplied. They are not reusable client tooling and must never be used to provision a client. No historical operational script was executed in Phase A.

## Studio build and deployment identity

Required: `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET`, `SANITY_STUDIO_API_VERSION`, `SANITY_STUDIO_DEPLOYMENT_KIND`, `SANITY_STUDIO_NAME`, `SANITY_STUDIO_TITLE`, `SANITY_STUDIO_APP_ID`.

Configuration and CLI use the same target validator. Auto-slug input, uniqueness queries and existing maintenance scripts use the configured API version. App ID is explicit: the CLI cannot silently choose/create a deployment identity. All `SANITY_STUDIO_*` values are public. Supply credentials only through the normal private server/CLI authentication mechanism. Do not run deployment, seed, repair or stabilization scripts as part of Phase A.

## Brand configuration

Client storefronts read existing CMS `displayName`, `description`, `logo`, `accentColor`, `contactEmail`, `instagramUrl`, `whatsappNumber`, and inquiry/price flags. Added optional CMS fields: `tagline`, `accentContrastColor`. Name and description are required in client mode. Logo appears in the existing wordmark position, with bounded dimensions. Six-digit HEX colors customize CTA/filter/gallery accents and focus outlines; contact normalization remains unchanged. CMS name/description and logo feed page metadata/Open Graph; the canonical base comes from the deployment URL. Optional client fields are empty or use the shared structural palette, never demo identity.

Explicit `demo` mode preserves the approved ATELIER wordmark, description, footer tagline, absence of logo and original palette even when legacy CMS brand values differ. Contact links and other existing CMS behavior continue unchanged. No content was edited to accomplish this. New Studio settings do not auto-fill ATELIER or enable demo mode.

Admin public build configuration:

- `NEXT_PUBLIC_ADMIN_DEPLOYMENT_KIND`: required `demo` or `client`.
- For `client`: `NEXT_PUBLIC_ADMIN_BRAND_NAME`, `NEXT_PUBLIC_ADMIN_BRAND_DESCRIPTION` required.
- Optional: `NEXT_PUBLIC_ADMIN_LOGO_URL`, `NEXT_PUBLIC_ADMIN_ACCENT_COLOR`, `NEXT_PUBLIC_ADMIN_ACCENT_CONTRAST_COLOR`.

These update admin shell/navigation marks, login, dashboard, product preview, metadata and primary action colors. Rebuild the static admin after changes. Technical cookie names, Durable Object identifiers, document fields and authorization policy are unchanged. `.env.example` contains public demo values only.

## Reproduce builds from tracked files

Use Node 22 and the declared `pnpm@10.18.3`:

```sh
pnpm install --frozen-lockfile --ignore-scripts
NEXT_PUBLIC_ADMIN_DEPLOYMENT_KIND=demo pnpm build:admin
pnpm --filter admin typecheck:worker
pnpm --filter admin test:config
pnpm --filter admin test:contracts
pnpm --filter admin test:auth
```

A clean admin build needs only the public branding variables, not production credentials or CMS access. Install scripts are intentionally disabled; the locked native packages used by this build ship their binaries. For storefront/Studio builds, load the explicit variables above (examples supplied), then run `pnpm build:storefront` and `pnpm build:studio`. Storefront builds need read-only published CMS access and should be compared against the same content snapshot.

Local integration: run the fixture from `apps/admin` with `node tests/sanity-fixture.mjs`, then `pnpm --filter admin dev:integration`; run `node tests/integration.mjs` from `apps/admin`. Streaming checks use the documented `DIRECT_WORKER_VERIFY=1 node tests/streaming.mjs` to bypass a known Wrangler development proxy error. Never point these tests at live services. The UI test uses `ADMIN_TEST_URL` and `docs/phase-a/admin-screenshots`; its recovered stale labels/selectors and oversized upload fixtures were corrected to match the existing UI and 2MB limit.

## Boundaries before Phase B

This is deployment-specific configuration, not a shared multi-tenant admin or tenant membership system. Before onboarding, separately plan/authorize each client's project, runtime, origin, least-privilege secrets, Studio identity, CMS settings and provisioning workflow. Validate those actual resources and deployment bindings in Phase B. Historical demo-only operational scripts must be replaced with reviewed client-specific tooling if needed. No cloud resources, webhooks, billing, credentials or CMS data were changed, and no merge/deploy/import/simulation occurred in Phase A.

## Visual verification method

The approved commit and current storefront were built with fresh generated caches and the same read-only CMS query snapshot. Initial builds had different content because one reused earlier local fetch-cache data; that content difference was not treated as a code regression. The optional `apps/admin/tests/cms-snapshot.cjs` harness documents the snapshot technique; keep captured public data under `/private/tmp`, never in Git. For comparison, serve the approved static export on loopback port 3100 and current export on 3101, then run `node apps/admin/tests/phase-a-visual.mjs`. It permits only GET/HEAD requests. Wait for gallery animations before pixel comparisons. The test uses the same cached CDN image bytes within each comparison context.

Results: home, About and a representative product page at 390px and 1512px have identical content, measured geometry and **zero differing screenshot pixels** across all six pairs. Mobile/desktop screenshots were also visually inspected. `docs/phase-a/pixel-results.json` records dimensions/counts; representative home screenshots are retained in Git. Full local pairs and admin UI captures remain available in `docs/phase-a/`.

Workspace artifact caveat: the first run of the recovered UI suite refreshed its existing untracked `docs/admin-screenshots/` login/dashboard/products/editor/preview/card screenshot filenames before its output was redirected to `docs/phase-a/admin-screenshots/`. Those original image versions were not backed up. No pre-existing source was discarded. Historical evidence outside those refreshed QA images remains in the working tree; none was broadly staged or deleted. Fixture tests also regenerate their documented ignored local test credentials/state.
