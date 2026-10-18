# Bounded real Sanity QA — 15 October 2026

Scope: one explicitly authorized temporary product in Sanity project `3ahm0828`, dataset `production`; two image uploads; native draft, initial publish, one published edit, then unpublish. The admin ran only in local workerd on loopback. No admin deployment or new Cloudflare resources were created.

QA product ID: `atelier-qa-20261015-0375d18c`.

Initial name: **ATELIER QA — בדיקת אינטגרציה זמנית 15.10.2026**.

Final edited name: **ATELIER QA — בדיקת אינטגרציה זמנית 15.10.2026 — עודכן**.

Recoverable draft ID: `drafts.atelier-qa-20261015-0375d18c`.

Existing category reused: `category-dresses` (שמלות). No category, collection, gallery, settings or pre-existing product was intentionally mutated.

## Evidence and results

The machine-readable [QA record](admin-screenshots/live-sanity-qa.json) contains upload references, accepted operations, sanitized webhook attempts, Pages deployment IDs and public catalog observations. It contains no token, session, owner password or secret deploy-hook URL.

- Two PNG uploads streamed through the local Worker into real Sanity successfully: 2,225,686 and 2,110,642 bytes. Upstream metadata and CDN URLs passed validation.
- The native draft saved successfully with both images. The unauthenticated public catalog excluded it. Authenticated admin preview worked through the API and actual Chrome UI; anonymous preview returned 401.
- Initial publication succeeded. The existing webhook returned HTTP 200 and triggered Pages deployment `60df8edb-fa1c-40c4-ab82-4b357c4179da` (`deploy_hook`), which completed successfully. Actual Chrome and a public HTTP read confirmed the QA catalog entry at ₪123.
- One edit was published under the same ID and slug, adding `— עודכן` and changing the price to ₪124. Webhook delivery returned HTTP 200 and triggered Pages deployment `2d2c57d8-ce07-4703-ad6d-e8a7ef65f5c9`, which succeeded. Public HTTP reads and Chrome both confirmed the edited name; Chrome also confirmed ₪124.
- Unpublishing succeeded and retained the edited content in the native draft. The removal webhook returned HTTP 200 and triggered Pages deployment `ad61410b-e76e-4139-94bf-46170ed5006c`, which succeeded. Public HTTP reads and Chrome confirmed the catalog no longer contained the QA slug or product; Chrome found zero QA links.
- The final draft retained both images in their original order, updated name, ₪124 price, description, sizes and colors. It loaded successfully in the authenticated Chrome editor. The published QA document is absent. The draft and its images were not permanently deleted.
- A SHA-256 comparison confirmed all 47 pre-existing non-asset documents remained unchanged, including existing products/drafts, categories, collections, gallery and settings documents.
- Exactly three successful `deploy_hook` production builds occurred for the authorized initial publish, edit and unpublish. Draft-only writes did not trigger a build. No manual rebuild or additional publication cycle was triggered.

All requested lifecycle checks completed. The failures described below were resolved during this test; no lifecycle check remains incomplete. The local Worker was stopped, its original fixture configuration restored, production write access removed from local configuration, and temporary owner password/session files removed. A scan of 70 exported admin files and the QA record found no real Sanity token or temporary owner/session credential.

## Issues found and fixed locally

1. An existing Studio draft contained an unfinished image entry without an asset reference. Catalog DTO mapping threw an exception. The read adapter now skips incomplete image entries, and crop/hotspot lookup tolerates them. The original draft was not edited. A focused regression test covers null, unfinished and valid entries.
2. Immediately after successful uploads, the broad catalog read did not include the new asset references and the first QA draft save was rejected before mutation. The adapter now resolves missing references through a targeted authenticated asset query. The same two uploaded assets were reused; no extra upload occurred. A regression test proves exactly one targeted lookup and one draft mutation. The later real draft save succeeded. No automatic write retry was introduced.
3. The cached Cloudflare OAuth session initially returned 401. Existing Wrangler credential refresh restored access under the verified personal identity. No login scopes, account permissions or billing were changed.
4. A completed Pages deployment was briefly observable before the primary catalog served its new content. Verification waited for actual public content rather than treating build completion as proof of visibility.

Changed implementation: `apps/admin/worker/sanity.ts`. Added regression coverage in `apps/admin/tests/integration-guards.mjs` and the bounded manual lifecycle harness `apps/admin/tests/live-qa.mjs`. No storefront code, UI design or webhook configuration changed. Lint, application typecheck, Worker typecheck, regression guards and static admin build passed.

## Retained images

- `image-af8d2a2cbbb9278c67b882d717a82fa5493e005f-1086x1448-png`
- `image-3ea45fd5ee9fdedc2fd4c8f04ecbfd4256fa590b-1087x1447-png`

These assets are intentionally retained and remain public on Sanity's asset CDN. No permanent product or image deletion is authorized.

## Screenshots

[Private native draft preview](admin-screenshots/live-sanity-draft-preview.jpg) · [Initial live catalog](admin-screenshots/live-sanity-published-catalog.jpg) · [Edited live catalog](admin-screenshots/live-sanity-edited-catalog.jpg) · [Final public removal](admin-screenshots/live-sanity-unpublished-catalog.jpg) · [Recoverable edited draft](admin-screenshots/live-sanity-recoverable-draft.jpg)

This QA does not verify a deployed Worker, remote SQLite Durable Object behavior, remote billed CPU/memory or production admin launch readiness. It authorizes no further production changes.
