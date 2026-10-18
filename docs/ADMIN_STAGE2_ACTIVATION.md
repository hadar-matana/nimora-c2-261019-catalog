# Controlled Stage 2 activation — 16 October 2026

Live admin: https://atelier-admin.hadarmat.workers.dev/login/

Existing Worker `atelier-admin`, version `144fbe65-a827-47b6-a9f4-b62e91558f1f`, and existing SQLite `OwnerAuth` Durable Object only. Cloudflare dashboard confirmed **Free, $0, Current plan** before activation. No infrastructure or billing changes. Four secret_text bindings and the previously provisioned dedicated Sanity Editor token metadata verified; no credentials printed or stored in this report.

## Activated capabilities

Authenticated owner product creation/editing, native drafts, publishing/unpublishing, product image upload and ordering, category creation/renaming/ordering, and private previews. `SANITY_ALLOW_PRODUCTION_WRITES=approved`; QA-only document restriction removed; temporary upload-retest deadline remains `0`. Authentication, eight-hour persistent sessions, CSRF checks, product/category type and field allowlists, revision conflict checks, stable IDs/slugs/references and no permanent product deletion remain intact. Settings/collections/gallery mutations have no owner API.

## Verification

- Local workerd: all 16 isolated lifecycle/security regression scenarios passed, including image upload/order, draft/publish/edit/unpublish recovery, categories, revision conflicts, upstream failures and preservation of technical fields.
- Guard suite: nine groups passed, including new production unknown-length/oversized upload rejections and authentication/CSRF protection after normal activation.
- Lint, UI typecheck, Worker typecheck and static build passed.
- Remote: owner session from private login survived deployment and repeated authenticated requests; catalog returned 16 products and five categories. Retained QA preview returned 200. No owner credentials were requested in chat.
- Anonymous product/category/upload/settings mutations returned 401; invalid CSRF returned 403; valid owner + CSRF site-settings mutation returned 405 (route deliberately unavailable). Anonymous catalog/preview returned 401.
- Temporary verifier logout returned 200 and subsequent session request 401. Its private session file was removed. The separate owner Chrome session remains available.
- Chrome: desktop 1440×900 and mobile 390×844 catalog fit without horizontal overflow; private QA preview, editor with accurate 2MB label, and categories rendered. No save, publish, upload or category-edit action was performed remotely.
- Canonical before/after hashes matched **all 70 Sanity documents**, including QA draft and assets. QA remained unpublished with its original two image references. No new assets. Webhook configuration unchanged and no storefront deployment triggered.

Evidence: `docs/admin-screenshots/stage2-activation-{smoke,audit,tail,metrics,daily-usage}.json`, plus desktop/mobile/Free-plan JPGs.

## Remote runtime and Free usage

Temporary trace-v1 connection captured **14 API requests**, CPU **0–3 ms**, all outcomes `ok`, zero exceptions. The connection was removed. Request-level memory was not exposed. This capture is incomplete relative to all browser/static traffic and is not a peak/load guarantee.

Sampled analytics retrieved during the activation window: **45 Worker requests**, zero errors, maximum reported bucket CPU p99 **3.852 ms**, maximum memory p99 **4.693 MiB**. Daily snapshot: 211 Worker requests, 178 Durable Object requests, 0.593 GB-s DO duration, 292 SQL rows read and 13 written; no CPU/memory exceeded or fatal DO errors. Free limits displayed: 100,000 daily requests each for Workers and DO, 13,000 GB-s/day DO duration, 5 million rows read/day and 100,000 rows written/day. Storage analytics returned no rows; storage size is therefore unmeasured. Analytics are delayed/sampled, and daily p99 includes the prior approved upload retest (7.438 ms). These are observations, not future billing/runtime guarantees.

## Upload restrictions

- Production images limited to **2 MiB (2,097,152 bytes)**, JPEG/PNG/WebP, existing 40-megapixel limit, at most ten images per product.
- Known Content-Length is mandatory. Unknown-length/chunked production uploads reject with 411; larger uploads reject with 413 before Sanity access. Browser File requests use the previously remotely verified native FixedLengthStream path. No upload was repeated during this activation.
- The editor uploads selected files sequentially. There is **no global cross-tab concurrency lock**; use one owner tab and one upload at a time. Concurrent sessions/load and larger catalogs are not certified within Free CPU limits.
- No client-side resize/re-encode was added. Reduce image file size locally before uploading if needed. Asset URLs remain public, including those used only by drafts (accepted architecture limitation).
- Existing demo/local-preview wording remains in the approved UI; deployed authentication/data are real. Layout was not redesigned; only existing upload size validation/label changed.

## Immediately disable writes and uploads

Run from the project root in the personal account's terminal:

```sh
WRANGLER_LOG_PATH=/private/tmp/atelier-disable-writes.log WRANGLER_SEND_METRICS=false pnpm --filter admin exec wrangler deploy --config worker/wrangler.release.jsonc --var SANITY_ALLOW_PRODUCTION_WRITES:disabled --var SANITY_UPLOAD_RETEST_UNTIL:0
```

This updates the same Worker, retains authentication/read access, and blocks authenticated product/category/upload mutations with 403. It requires existing personal Cloudflare deployment access, no owner password or Sanity token entry. An already accepted in-flight operation may finish. After emergency disable, also change `SANITY_ALLOW_PRODUCTION_WRITES` in `apps/admin/worker/wrangler.release.jsonc` to `disabled` so a later default deployment cannot re-enable it inadvertently. Verify the gate using the private verifier and harmless mutation request; do not retry failed writes automatically. This rollback command is documented, not executed: writes are currently approved.

Controlled demo-store operation is enabled with these limits. No fresh live publish/unpublish/category cycle was authorized or performed in this activation; those semantics retain prior QA evidence and the local regression coverage. No unrestricted concurrency or future quota guarantee is claimed.
