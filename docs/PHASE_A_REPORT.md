# Phase A implementation report

Source recovery, CMS configuration, independent branding and required local verification are complete. The artifact-preservation exception below is disclosed; the separate readiness-audit document was not available for independent review.

## Development branch and commits

Branch: `codex/phase-a-client-configuration`, based directly on approved storefront `e33d95253f249ba401c9affb70716dab0a812f2a`. No push or merge.

- `c98c3e9`: recover production admin, source/tests/assets/scripts/config, dependency lockfile, existing Studio schema work and operational documentation.
- `ce51fd0`: explicit validated CMS targets, Worker query/mutation/upload/CDN validation, Studio target/API versions/deployment identity and configuration tests.
- `808e545`: storefront/admin branding, CMS tagline/contrast fields, brand render tests and initial UI regression maintenance.
- Final report/evidence commit: obtain its hash with `git log -1` (this report is included in it). Adds demo-operations guards, final test fixture correction, instructions and verification evidence.

## Recovery and clean-checkout results

All **39/39** SHA-256 manifest entries matched before implementation, including Worker release config and admin source/assets. The manifest records Worker version `252a65f1-29b4-4801-9af9-0fadb5286505`; this was local manifest verification, not a new remote deployment inspection. Existing source was committed before modifying it. Builds, dependency trees, local state, real environment files and credentials are excluded from Git. No recognizable token/private-key patterns were found in the recovered/staged text scan.

Tracked commit `808e545` was archived into `/private/tmp/atelier-phase-a-clean`. A fresh `pnpm install --frozen-lockfile --ignore-scripts --store-dir /private/tmp/atelier-phase-a-pnpm-store` installed 1104 packages with pnpm 10.18.3 in 3m33s. No dependency symlinks, local env files or production credentials were supplied. Admin build, Worker type check, configuration/branding tests, contracts/security and four auth tests passed there. Final admin source, Worker and shared config build inputs match that tested checkout byte-for-byte. A fake server-only token sentinel was absent from browser exports.

## Replaced targets and required variables

Worker API origin `3ahm0828.api.sanity.io`, query/mutation/upload dataset `production`, fixed API version and fixed CDN prefix now derive from one validated target. Targeted missing-asset reads use the same target. Upload-response URLs must exactly match configured CDN/asset identity. Missing/invalid config or mode fails before network access. Studio config/CLI project, dataset, name/title/app ID and query API versions are explicit. Storefront fallback CMS targets and demo site/Studio URLs were removed.

Required public storefront variables: `NEXT_PUBLIC_DEPLOYMENT_KIND`, `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `NEXT_PUBLIC_SANITY_API_VERSION`, `NEXT_PUBLIC_SITE_URL`; optional `NEXT_PUBLIC_STUDIO_URL`.

Required Worker runtime CMS variables: `SANITY_MODE`, `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_API_VERSION`; server-only `SANITY_API_TOKEN`. Existing auth/runtime settings remain `ADMIN_ORIGIN`, `ADMIN_REMOTE_ENABLED`, `LOCAL_COMPAT_PROOF`, secret `OWNER_USERNAME`, secret `OWNER_PASSWORD_HASH`, secret `CREDENTIAL_VERSION`, optional `SESSION_TTL_SECONDS`, plus existing explicit write/QA gates. No auth behavior was changed.

Studio: `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET`, `SANITY_STUDIO_API_VERSION`, `SANITY_STUDIO_DEPLOYMENT_KIND`, `SANITY_STUDIO_NAME`, `SANITY_STUDIO_TITLE`, `SANITY_STUDIO_APP_ID`.

Admin public build: `NEXT_PUBLIC_ADMIN_DEPLOYMENT_KIND`; clients require `NEXT_PUBLIC_ADMIN_BRAND_NAME` and `NEXT_PUBLIC_ADMIN_BRAND_DESCRIPTION`. Optional `NEXT_PUBLIC_ADMIN_LOGO_URL`, `NEXT_PUBLIC_ADMIN_ACCENT_COLOR`, `NEXT_PUBLIC_ADMIN_ACCENT_CONTRAST_COLOR`.

All public build values require rebuilding static assets. Only the Worker receives privileged secrets at runtime. [Configuration guide](PHASE_A_CONFIGURATION.md) includes examples, reproducibility commands, disabled client runtime template and exact semantics. Historical demo release config retains explicit demo variables; historical operator scripts retain reviewed resource identifiers but now fail without a separate demo-only opt-in. They are not client provisioning tools and were not executed.

## Branding and design preservation

Client storefronts use CMS `displayName`, `description`, `logo`, `accentColor`, contact/social/inquiry fields plus new optional `tagline` and `accentContrastColor`. Client name/description are required. Metadata/Open Graph use CMS brand identity and logo, with deployment canonical URL. Admin public variables update shell/navigation/login/dashboard/product preview/metadata and action colors. Technical identifiers and authorization remain unchanged.

Explicit demo mode retains ATELIER's approved name/tagline, wordmark treatment, no logo and original palette despite legacy CMS brand fields. No CMS edit was needed. Six controlled approved/current screenshot pairs—home, About and product at 390px and 1512px—have identical content/geometry and **zero differing pixels**. Both representative viewports were visually inspected. See `phase-a/pixel-results.json` and `phase-a/visual-results.json`; representative home images are tracked. Full local pairs/admin captures are under `docs/phase-a/`.

## Test results

- Lint passed: storefront, Studio, admin.
- Types passed: storefront, Studio, admin, Worker.
- Builds passed: storefront, Studio, admin, plus fresh tracked-checkout admin.
- New configuration/actual brand render tests passed: distinct targets, missing/invalid inputs, zero-network invalid reads/writes/uploads, cross-target asset rejection, client logo/contact/social/colors/SEO and exact demo branding.
- Existing About/catalog-options/product/auth/CSRF/session/security contracts passed.
- Auth unit tests: 4 passed.
- In-memory local admin integration: 19 groups passed.
- Admin browser UI: 71 assertions passed at 375/390/768/1280/1440px.
- Streaming: 7 groups passed including cancellation/concurrency using documented `DIRECT_WORKER_VERIFY=1`. The normal Wrangler development proxy reproduced its documented 500-versus-502 failure; direct-local-worker checks passed after resetting fixture error state. No production transport test was attempted.
- Visual comparisons: all six pairs zero differing pixels; filtering/reset, product options and keyboard skip navigation passed.
- Demo-operation guard rejected before credential loading/network. Staged secret/generated-file scan passed. Phase A diff whitespace checks passed; recovery preserves an existing extra EOF blank line in `tests/integration.mjs`.

## Safety and remaining Phase B work

No deploy, production resource/CMS mutation, new project/Worker/namespace, webhook/billing/credential change, import, merge or simulation occurred. Storefront used published CMS/CDN reads only; admin writes went to isolated local memory.

The separate readiness audit was not found. Supplied requirements, manifest and available architecture/integration/verification documents guided implementation; reconcile any additional findings from the external audit before Phase B. Actual client resources/origins/secrets/Studio identity/branding must be separately authorized, populated and validated. Replace demo-only operational tooling if client provisioning needs it. Shared multi-tenant membership and onboarding remain out of scope. No production access is required for this completed local implementation.

Artifact preservation exception: the first recovered UI test refreshed existing untracked login/dashboard/products/editor/preview/card QA screenshots under `docs/admin-screenshots/` before output was redirected. Those earlier image versions had no backup and were not recovered. No pre-existing source was discarded; other historical evidence remains local. Fixtures also regenerated documented ignored local credentials/state. Do not interpret the source recovery claim as preservation of those overwritten QA images.

## Engineering time

Measured elapsed wall time from recovery commit 2026-10-18T14:34:52+03:00 to report preparation 2026-10-18T11:53:47.756355+00:00: **18.9 minutes**. Includes download/test waiting; excludes initial inspection and final reporting afterward. Total hands-on engineering time was not independently instrumented. This is measured agent elapsed time, not an estimate of human engineering hours.
