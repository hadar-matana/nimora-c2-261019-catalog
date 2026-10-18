# ATELIER demo deployment and live About publishing

18 October 2026. Successful deployment from the existing working tree. No redesign, onboarding simulation, infrastructure cloning or product import.

## Authentication and deployment targets

The earlier 403 came from a custom script reading an expired cached Wrangler OAuth token directly. Its expiry preceded this session. `pnpm --filter admin exec wrangler whoami` refreshed the existing OAuth session successfully; the same read-only API preflight then passed. Interactive login, new tokens and credential rotation were unnecessary. No credentials were printed.

Verified Cloudflare identity: personal `hadarmat@gmail.com`, account `07eb45a2b5a037d1138beea811cf549b`. Existing scopes include account/user reads, Pages writes and Workers writes. Dashboard still shows Free / $0 / Current plan. No unexpected account, paid service, plan change, migration, new Durable Object or billing change.

Live URLs:

- Storefront: https://fashion-catalog-demo.pages.dev/
- About: https://fashion-catalog-demo.pages.dev/about/
- Admin About editor: https://atelier-admin.hadarmat.workers.dev/about/
- Admin login: https://atelier-admin.hadarmat.workers.dev/login/

## Source review and deployment

Reviewed the storefront diff, About schema/API/editor, Worker guards, current Pages source/build configuration and existing Worker bindings. Corrected an implementation error before deployment: About fields had also been duplicated under the logo image schema. They now appear only at settings document level; the focused test checks this. No visual changes were made during deployment work.

Personal GitHub identity `hadar-matana`, repository and SSH remote verified before writes. Scoped commit **`4f4683aec7c1f080b12e159d8fe911fac3122a1c`** (`Refine storefront and add CMS-backed About page`) includes only 16 storefront/About schema files and was pushed to the existing `main` branch. It excludes pre-existing root, product schema, admin and documentation edits.

Pages is GitHub-connected and builds `main` with `pnpm build:storefront`, output `apps/storefront/out`. Pushing the scoped commit was necessary so later CMS webhook builds retain the new UI/About implementation. No source/build configuration was changed. Initial Git deployment: **`3f90ba49-7883-4187-86c5-f6d22b025204`**, successful, https://3f90ba49.fashion-catalog-demo.pages.dev.

Admin was built and deployed with the existing `worker/wrangler.release.jsonc` to the existing `atelier-admin` Worker, version **`252a65f1-29b4-4801-9af9-0fadb5286505`**. The authentication namespace, secrets and plain-text configuration match the predeployment baseline. No migration was added or applied. The full pre-existing admin implementation remains uncommitted, as requested; its deployed source is recorded in `premium-admin-release-manifest.json` (39 source/config/asset hashes). No unrelated changes were reset, discarded or swept into the storefront commit. Studio was built for validation but not separately deployed; its source schema additions are optional and require no Content Lake migration.

## Production content compatibility and live test strategy

Predeployment baseline: **73 Sanity documents**, one published `siteSettings`, no settings draft, and none of the three About fields present. All new fields are optional strings/text, so existing production documents remain valid and render the fallback without a migration. Deployment itself left all 73 documents unchanged.

The existing enabled Sanity webhook's effective rule includes current or previous type `siteSettings`. No webhook filter, URL, secret or project setting was modified.

Used the existing authenticated owner browser session; no credentials or session cookies were extracted. In the deployed About UI, previewed and saved clearly labelled temporary demo QA text into the originally absent fields. Confirmed:

1. Preview displayed the heading, intro and two paragraphs.
2. Save persisted and survived a full admin reload.
3. Only `aboutHeading`, `aboutIntro` and `aboutBody` changed on the existing settings document; all its other content and all 72 other documents remained unchanged.
4. Sanity webhook delivery returned **200**, not in progress, no failure.
5. It triggered successful Pages deployment **`65fc603d-6699-4496-8d2e-3ff8ee70c3e2`** (`deploy_hook`), using the same new commit.
6. The public `/about/` rendered the exact temporary heading/intro, two separate body paragraphs and updated SEO description/title. Evidence: `premium-live-about-published.png`.
7. Cleaned up with one revision-checked patch unsetting only the three test fields. No document or asset was deleted. Settings content returned exactly to its original state; only normal `_rev`/`_updatedAt` metadata advanced. The editor reload showed all three fields empty again.
8. Cleanup triggered a second webhook/rebuild; final deployment result and public fallback verification are recorded in `premium-live-builds.json` and the completion note below.

The temporary text was not a brand biography and is not retained in live CMS content. No existing About text was overwritten. The retained QA product, all products/categories/options, assets and published/draft status remained unchanged. Final data audit: **72 documents byte-for-byte unchanged; settings content restored; 73 documents retained; webhook configuration hash unchanged** (`premium-live-publishing.json`).

## Final validation and smoke tests

Passed during this deployment turn:

- Storefront/Studio/admin lint and type checks; Worker type check.
- Studio, storefront and admin production builds; Worker dry run.
- About API contracts, actual empty/populated server rendering, escaped markup and metadata; added schema-placement regression assertion.
- Existing product mutation/security guards, catalog-options tests and four auth tests. The earlier 19-scenario isolated lifecycle/browser suite remains valid; product logic was not changed in this deployment turn.
- Six live public endpoints (home, collection, About, product detail, sitemap including About, robots): HTTP 200.
- Seven anonymous admin checks: About/catalog/options APIs and unauthenticated About POST return 401; protected pages redirect to login.
- Existing owner session survived the Worker deployment. Live editor preview/save/reload, category filtering (4 dresses), product size/color pressed state, public About navigation, temporary publication and cleanup.
- Live Chrome mobile storefront: viewport/document width both 390px. Existing local coverage includes 390/768/1440 storefront and 390/1440 admin. Screenshots and JSON evidence are in this directory.
- `git diff --check`.

No live product mutation, upload, owner-password change, permanent deletion, paid service, credential creation or infrastructure change was performed. Live browser smoke tests did not send a WhatsApp message or repeat the full product write lifecycle. Real-device Safari, load testing and Core Web Vitals were not added to this deployment scope.

## Remaining operational considerations

- Admin source remains substantially untracked and needs a separate deliberate source-control handoff; the deployed artifact is identified by Worker version and source hashes above.
- Pages publishing is asynchronous: an admin content save is followed by a build delay, not instantaneous public availability.
- Avoid publishing an old Studio settings draft after newer admin edits. No such draft exists in the current dataset.
- Existing admin copy still labels the interface as a local preview; this was pre-existing and deliberately left unchanged during deployment-only work.

## Completion

Cleanup Pages deployment **`e5cbfc4e-75a8-44d2-baf3-c68193da390b`** succeeded at 10:54:03 UTC (13:54:03 Asia/Jerusalem): https://e5cbfc4e.fashion-catalog-demo.pages.dev. Both CMS-triggered builds use commit `4f4683aec7c1f080b12e159d8fe911fac3122a1c`; both webhook attempts returned 200 with no failure. A fresh browser reload of the canonical `/about/` confirmed the original fallback heading/body and metadata after cleanup. The admin also reloaded with all three fields empty. Evidence: `premium-live-about-restored.png`, `premium-live-admin-clean.png`, `premium-live-builds.json` and `premium-live-publishing.json`.

Final state: both requested components are deployed, the existing CMS publishing path works end to end, original content is restored, and the demo is ready for review. Only the scoped storefront/schema commit was pushed. Pre-existing uncommitted work and this deployment's audit/report artifacts remain in the working tree. No onboarding work was started.
