# ATELIER storefront upgrade and editable About

> Subsequent deployment succeeded on 18 October 2026. See [live deployment and publishing verification](PREMIUM_DEPLOYMENT.md). The deployment-blocker statements below describe the earlier local handoff.

18 October 2026. Implemented and locally validated; deployment blocked by personal Cloudflare API authentication (HTTP 403 on `/user`). No live CMS mutations or deployments were performed.

## Audit and implementation choices

- Existing architecture retained: Next.js 16 static storefront export, Sanity Content Lake/Studio, separate Next.js static admin served by the authenticated Hono Cloudflare Worker, SQLite Durable Object for authentication only. No added dependencies, databases, migrations or services.
- Before this task the homepage and `/catalog` both opened directly into `CatalogClient`. It filters products by category; despite old metadata promising search/collection filters, neither exists in the current client. Existing category filtering is preserved. Product details use a swipe/thumbnail gallery, size/color selection and WhatsApp inquiry with selected values.
- Existing palette retained: background `#fbfaf8`, white surface, ink `#151515`, muted `#6f6b66`, border `#e8e4df`, stone `#c8c0b6`. Existing system body and Georgia display stack retained. No external font downloads. The signature is an asymmetric product-image/brand hero, reusing the first featured product with a valid image, then the first available product. No image is fabricated or uploaded. Without images the hero becomes a centered text composition.
- Homepage now has CMS brand identity, existing brand description, a collection anchor and About link. Header/footer and root metadata now respect CMS `displayName`, with the existing config as fallback. Cards retain 3:4 proportions and secondary-image hover while gaining quieter prices, aligned information and more spacing. Product detail typography is calmer, descriptions preserve line breaks, mobile gallery dots have 44px targets. The existing fixed mobile WhatsApp action remains.
- Mobile navigation deliberately keeps both primary links visible rather than adding a hidden drawer. Header remains sticky. Added a semantic primary nav, skip link, collection H1, About metadata/canonical and sitemap entry. Existing reduced-motion CSS applies to all new transitions. Empty product and About states remain usable.
- Existing routes and technical contracts remain unchanged. Customer-facing “קטלוג” replaced contextually: navigation/title → “הקולקציה”; back link → “חזרה לקולקציה”; related link → “לכל הפריטים”; product metadata → “בקולקציה”; general WhatsApp text → brand-neutral collection inquiry. Admin terminology remains functional. The legacy CMS demo description is mapped to neutral configuration copy at read time; the stored CMS value is untouched.

## About content and publishing

- Storefront `/about/`; main nav and footer link. Editorial two-column desktop layout and single-column mobile layout, readable line lengths, heading, optional intro and main paragraphs. No invented biography. Missing/blank body shows “עוד מעט נשתף כאן את הסיפור שלנו. בינתיים, מוזמנות לגלות את הפריטים.” with a collection link.
- Studio `siteSettings` extends with `aboutHeading` (120 characters), `aboutIntro` (600), `aboutBody` (12,000). Blank lines separate paragraphs and single line breaks are retained. Text is escaped by React. Optional imagery/rich-text toolbar intentionally omitted; paragraph formatting meets the basic text requirement without extra dependencies.
- Existing ATELIER Admin has an “אודות” navigation entry at `/about/`. Fields, local preview, loading/errors, disabled save state and “שמירה ופרסום” action use the current auth/UI patterns. Preview is local and does not publish.
- Authenticated `/api/about` GET/POST uses the same owner-session, exact Origin, CSRF and production-write gates as products. Bounded QA mode rejects About writes. POST allows only heading/intro/body/revision and validates types, lengths and control characters. It patches only the three About fields on the existing published settings document with `ifRevisionID`; it neither replaces settings nor publishes unrelated Studio drafts. Readback verifies content before returning a new revision. Missing or multiple published settings documents fail safely without creating an alternative singleton. Existing Studio drafts are left untouched; owners should avoid later publishing an older settings draft that predates their About edits.
- Storefront query reads all three fields with published perspective during static build. A save patches a published `siteSettings` document, so it follows the existing Sanity → Cloudflare Pages rebuild path. The last verified effective webhook rule in `ADMIN_CATALOG_OPTIONS_ROLLOUT.md` includes both current/before `siteSettings` type. No filter changes are needed or were made. Current remote webhook configuration/delivery and end-to-end deployed rebuild could not be verified because account preflight failed. The save UI explains the build delay; a successful content save does not certify deployment completion.

## Validation

Passed:

- `pnpm lint`, `pnpm typecheck`, `pnpm lint:admin`, `pnpm typecheck:admin`, `pnpm --filter admin typecheck:worker`.
- Studio build, storefront production build (21 generated routes including About), admin production static build (About included). Storefront requires network access to read published Sanity content; the first sandbox build failed DNS and the approved network build succeeded.
- `node apps/admin/tests/about.mjs`: read/save/reload, exact patch preservation, revision conflicts, missing/ambiguous settings, invalid/null/array/unknown input, field limits, upstream failure, clearing, production-write gates and query/route contract.
- `node apps/admin/tests/about-render.mjs`: actual server-rendered empty/populated content, heading, paragraphs, HTML escaping and SEO.
- `pnpm --filter admin test:integration`: all 19 existing isolated product/admin lifecycle checks, including upload, native drafts, publish/edit/unpublish, concurrency, image order, categories, options, CSRF and failure behavior.
- Existing integration guards and catalog-options contract tests; four mock-auth tests.
- `node apps/admin/tests/about-browser.mjs`: actual Chrome 390/1440px editor, preview, save/reload, paragraph persistence, no overflow, unrelated fixture-document preservation, anonymous 401 and invalid CSRF 403. Fixture reset afterward. No live Sanity writes.
- `node apps/admin/tests/storefront-premium.mjs`: actual Chrome homepage, collection, About fallback and product detail at 390, 768 and 1440px, no horizontal overflow or page errors, visible images loaded, no visible catalog wording. Screenshots inspected for desktop/mobile homepage and mobile editor. Results: `premium-storefront-browser.json` and `premium-about-browser.json`.
- Additional Chrome interaction checks: category selection/reset, product option pressed state, WhatsApp launch, reduced-motion duration and keyboard skip link.
- `git diff --check`.

No automated contrast scanner, real-device Safari, network-throttled Core Web Vitals or live deployed About save/rebuild was run. Browser image checks cover visible images, not every lazy-loaded image.

## Deployment, source state and review

- Not deployed. The existing intended demo remains https://fashion-catalog-demo.pages.dev and admin https://atelier-admin.hadarmat.workers.dev; these URLs do **not** contain this update yet.
- Personal Git remote and local identity match project instructions. No GitHub writes or work-account integrations used. Baseline commit: `2a00408`. Changes remain uncommitted: the starting checkout already contained extensive untracked admin implementation and unrelated tracked edits. Those were preserved rather than swept into a new commit. Review this task's storefront, `siteSettings`, About admin/Worker/tests and this report separately from the earlier admin work.
- The existing deploy workflow is still Cloudflare Pages storefront output plus the existing `atelier-admin` Worker/static asset deployment and optional Studio schema UI deployment. Personal account verification must succeed before any remote write. The preflight received HTTP 403 at Cloudflare `/user`; no credential rotation, token creation, migration, billing change, webhook edit or deployment followed.
- Local built review: http://127.0.0.1:3000/ and http://127.0.0.1:3000/about/ while the review server is running. Screenshots: `premium-1440-home.png`, `premium-390-home.png`, `premium-1440-about.png`, `premium-admin-390.png` (plus tablet, collection and detail captures).
- Remaining required acceptance work: restore personal deployment authentication, reverify current webhook target/filter and existing demo account/project, deploy the validated storefront/admin through existing configurations, then verify an authorized isolated content save and Pages rebuild without changing client/demo content. Optional About imagery and rich-text toolbar remain deferred. The future 100-product onboarding simulation was not started.
