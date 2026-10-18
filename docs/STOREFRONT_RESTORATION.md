# ATELIER — original storefront restoration

18 October 2026. Presentation restored selectively; editable About feature retained. No CMS mutations were performed during this task.

## Visual reference and exact wording

Reference Git revision: **`2a00408877c4d49e99cfe2f82de499c530546b75`**, immediately before `4f4683a`. The archived Cloudflare deployment **`549334bb-95f3-446f-9fad-fa1a81ee09cf`** was verified through the Cloudflare API to use that revision and used for rendered comparison: https://549334bb.fashion-catalog-demo.pages.dev/.

Exact restored French wording: **ATELIER**. It is restored to its original centered header wordmark and footer wordmark, using the original Georgia/Times serif family, original size/weight and original placement. Page titles use the original ATELIER configuration again. No alternative French wording was invented. This reference revision opens directly into category filters and the product grid; it has no separate homepage hero. Consequently the recently added split image/text hero was removed rather than replaced with another concept.

## Selective presentation changes

- Restored the original homepage markup, global stylesheet, original header layout/sticky behavior and original footer/tagline.
- Removed all recently appended editorial hero, grid/card alignment/spacing, product typography and mobile-header CSS overrides. Global CSS matches the reference aside from a trailing blank line. Existing `ProductCard` and `CatalogClient` implementations were already unchanged; removing the overrides restores their original visual behavior.
- Restored original product-detail typography, spacing and mobile gallery-dot markup/interactions. Product filtering, image gallery handling, options and WhatsApp purchase logic were not changed.
- Removed the newly added collection heading/count above the grid.
- Retained the invisible skip link and semantic primary-navigation element. These do not change the normal visual layout.
- About uses the original storefront's existing container, heading, body-text, spacing and link utility classes. Its new editorial two-column CSS is gone. No new visual system or assets were introduced.

Catalog cleanup:

- Removed the original redundant header “קטלוג” link; “אודות” occupies that same original navigation slot and style.
- Removed the footer “קטלוג” link, with no replacement decoration.
- The redesign's extra collection navigation/footer link and hero CTA labels disappear with the restored layout.
- Useful product-return and related-product navigation remain as “חזרה לקולקציה” and “לכל הפריטים”. The About collection link remains. `/catalog/`, category filters, product links and the header home/brand link remain functional.
- Kept the earlier neutral collection terminology in metadata, not-found text and general WhatsApp inquiry. No customer-facing “קטלוג” remains in the checked rendered pages. Technical routes, schema fields and admin terminology are unchanged.

## About and data safety

`/about/`, its metadata/canonical and sitemap inclusion remain. `aboutHeading`, `aboutIntro`, `aboutBody`, their Sanity schema/types/query projection, admin fields/preview, save/revision validation, authentication/CSRF/Origin protection and webhook integration are unchanged. The deployed admin Worker was neither modified nor redeployed. Its live owner editor and preview were checked without entering or saving content.

About API contract tests cover read/save/readback, paragraph preservation, conflicts, field validation, write gates and exact patch behavior using isolated mocks. About server-render tests cover empty/populated content, escaping and SEO; their heading assertions were updated to tolerate the restored heading's CSS classes. No live About save or production-content fixture was used in this restoration task. The prior live end-to-end publishing test remains documented in `PREMIUM_DEPLOYMENT.md`; this task preserves that backend and webhook path.

A read-only predeployment baseline captured all **73 Sanity documents**, webhook configuration, Worker settings and Pages source/build configuration. Final preservation results are in `restore-data-audit.json`. Current CMS product content was retained: archived screenshots can contain older product names or publication state, and those historical data differences were deliberately not restored.

## Validation

Passed:

- `pnpm lint`, `pnpm typecheck`, `pnpm lint:admin`, `pnpm typecheck:admin`, Worker type check.
- `pnpm build` (Studio + storefront; About and existing product routes included), `pnpm build:admin` (validation only, no admin deployment).
- About API contracts and actual About render/metadata tests, existing integration/security guard groups, catalog-options contracts and all four mock-auth tests.
- `git diff --check`.
- Actual Chrome visual comparison with the archived original at **1512px desktop** and **390px mobile**. Header heights, ATELIER font/size, grid top, columns, gaps, first-card dimensions/text alignment and background match exactly in the recorded DOM metrics. Both layouts have document width equal to viewport width. Desktop/mobile screenshots were inspected. See `restore-visual-comparison.json`, `restore-original-*.png`, `restore-local-*.png`.
- Mobile category filtering/reset (12 current products, 3 in dresses), gallery image-2 selection, selected size/color state and visible WhatsApp action. No inquiry was sent.
- About navigation/fallback on mobile and existing live admin preview. Public deployment verification is recorded below and in `restore-live-smoke.json`.

No full live product-write lifecycle, live image upload, live About save, real-device Safari or performance load test was run. No product/backend logic changed; avoiding live writes was part of the requested safety scope.

## Source control and deployment

Scoped restoration commit: **`e33d95253f249ba401c9affb70716dab0a812f2a`**, “Restore original ATELIER storefront presentation and keep About”. Nine storefront files only, pushed to the verified personal `hadar-matana/fashion-catalog-demo` repository's existing `main` branch. No reset or whole-commit revert. All pre-existing admin/root/product-schema changes remain uncommitted and preserved.

Deployment uses the established Pages Git integration: `pnpm build:storefront`, output `apps/storefront/out`, existing personal Cloudflare account and existing demo project. No environment variables, credentials, webhook settings, infrastructure, billing or unrelated services were changed.

URLs:

- https://fashion-catalog-demo.pages.dev/
- https://fashion-catalog-demo.pages.dev/about/
- Existing unchanged editor: https://atelier-admin.hadarmat.workers.dev/about/

Deployment receipt and final live checks are appended after completion. No onboarding simulation, infrastructure cloning or product import was started.

## Completed live verification

Cloudflare Pages deployment **`1c7661d6-af46-44fd-ae3d-d82875babe8f`** succeeded at **11:08:27 UTC / 14:08:27 Asia/Jerusalem**, from commit `e33d95253f249ba401c9affb70716dab0a812f2a`.

Deployment-specific URL: https://1c7661d6.fashion-catalog-demo.pages.dev/.

The canonical public storefront and `/about/` were verified in Chrome after deployment. Live desktop and mobile measurements match the original reference exactly for all recorded visual metrics (`restore-live-comparison.json`). The public ATELIER wordmark, removed catalog labels, original product grid and preserved About fallback/navigation were confirmed. Live HTTP smoke tests passed for home, collection, About, product and sitemap, with anonymous admin protection unchanged (`restore-live-smoke.json`).

Final audit: **all 73 production documents exactly unchanged, including revisions; webhook configuration exactly unchanged; admin Worker settings exactly unchanged; Pages source/build configuration exactly unchanged**. All 39 deployed admin source/config/asset hashes also still match the previous release manifest. The admin was not redeployed. Evidence: `restore-data-audit.json`, `restore-deployment.json`, `restore-live-desktop.png`, `restore-live-mobile.png`, `restore-live-about.png`.

No known restoration/deployment blockers remain. The pre-existing uncommitted admin/root work and this task's local test/report artifacts remain uncommitted; only the nine reviewed storefront files were committed and pushed. The existing About save/publish path was preserved and covered by isolated regressions, not exercised with a new live CMS mutation during this task.
