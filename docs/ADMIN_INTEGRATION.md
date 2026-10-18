# ATELIER local integration handoff — 2026-10-15

Subsequent authorized live test: [bounded real Sanity QA results](ADMIN_LIVE_SANITY_QA.md). Real uploads, native drafts, publishing, edit propagation, the existing Pages webhook and final public removal have now passed for one retained QA draft. Remote admin Worker/SQLite deployment remains unapproved and untested. The sections below preserve the earlier local-integration handoff.

The local implementation is complete. No deployment, remote Cloudflare provisioning, production Sanity mutation, billing change or storefront change was performed. This supersedes the earlier compatibility-proof instructions; it does not certify remote Free-plan CPU usage.

## Implemented

- Static Next.js admin uses authenticated Worker endpoints by default. Existing Hebrew RTL editor, image ordering, primary-image indicator and previews remain intact. Mock mode requires an explicit `dev:mock` command.
- Server-side password verification, Durable Object sessions, rate limits, origin/CSRF checks and authenticated catalog/private previews. Sanity write credentials never enter browser assets.
- Sanity HTTP adapter: product/category listing, creation, native draft saves, publishing, published edits, unpublishing with saved draft preservation, category create/rename/reorder and image references. Owner product deletion is unavailable.
- Existing IDs, slugs, unknown content fields, references and image crop/hotspot metadata are preserved. Revision guards reject stale edits. Strong incoming references prevent unsafe unpublishing. Appending a category leaves existing ordering metadata and revisions unchanged.
- Published content changes only after an accepted save/publish operation. Native draft saves leave published revisions untouched. A draft-only `atelierAdminBaseRevision` field detects intervening published edits; it is removed before publication. Existing Studio drafts without this marker remain supported. Conflicts require refresh/manual reconciliation, not silent overwrite.
- Image upload forwards native chunks with backpressure after checking a 12-byte signature. The outer application never concatenates the image body. MIME/signature, declared/running byte counts and bounded upstream metadata are validated. Abort, timeout, early upstream success and malformed responses fail safely. Success notifications follow accepted operations.
- Release configuration is an inactive template. Public access and production writes fail closed until separately approved configuration is explicitly enabled.

## Local preview

From the repository root, start the isolated Sanity fixture in one terminal:

```sh
pnpm --filter admin dev:fixture
```

In another terminal, create a local account **after starting the fixture**, then build/start:

```sh
pnpm --filter admin provision:local
pnpm --filter admin build
pnpm --filter admin start
```

Open http://127.0.0.1:3002/login using the username you selected and the generated password printed by the provisioning script. These are local credentials, not a production account. The fixture resets on restart and its images/data exist only in memory. Starting it regenerates test credentials; restart the Worker after provisioning. Do not put real credentials in fixture files.

For automated tests, skip interactive provisioning: the fixture supplies a temporary private test account. With fixture and Worker running:

```sh
pnpm --filter admin test:integration
pnpm --filter admin test:streaming
node apps/admin/tests/integration-guards.mjs
pnpm --filter admin lint
pnpm --filter admin typecheck
pnpm --filter admin typecheck:worker
pnpm --filter admin build
```

Repeated authentication suites can correctly reach the rate limit. Use a fresh disposable local `--persist-to` directory for an independent run; do not disable the limiter. Test scripts refuse non-fixture write targets. The older Phase B UI suite targets explicit legacy mock mode.

## Verification

- 16 lifecycle checks passed in local workerd against an isolated HTTP fixture using GROQ evaluation and atomic revision-aware mutations. Coverage includes authentication, authorization, validation, native draft visibility, publishing, stale conflicts, field preservation, categories, ordering, failed writes and prohibited deletion.
- Six streaming checks passed: upstream receives bytes before client EOF; valid PNG/JPEG/WebP; signature/type rejection; exact 10 MiB and oversized bodies; upstream/metadata errors; cancellation; three concurrent maximum-size uploads.
- Guard checks passed: production writes rejected before any network request; fixture origin restricted to loopback; disabled release configuration fails closed.
- Lint, application typecheck, Worker typecheck and static production build passed.
- Browser QA: actual Chrome login/error/dashboard/session reload and desktop product workflow; in-app browser desktop/mobile editor, multi-image selection, reordering, primary removal, catalog/full preview, draft/publish/update/unpublish, category changes, failed-save recovery and logout. Chrome automation could not select upload files because its extension lacks file-URL access; upload interactions were exercised in the in-app browser. No browser security setting was changed.
- A short-desktop error toast overlapped Save Draft; its desktop anchor now uses the top corner. Browser geometry and retry confirmed the action remains clear. Mobile placement remains unchanged.

Evidence: [lifecycle](admin-screenshots/integration-lifecycle.json), [streaming benchmarks](admin-screenshots/integration-streaming.json), [local profiling](admin-screenshots/integration-profile.json), [desktop editor](admin-screenshots/integration-editor-desktop.jpg), [Chrome desktop](admin-screenshots/integration-chrome-desktop.jpg), [private preview](admin-screenshots/integration-preview-desktop.jpg), [mobile save](admin-screenshots/integration-mobile-saved.jpg), [error recovery](admin-screenshots/integration-save-error-fixed.jpg).

## Limits and unverified behavior

The upload cap is 10 MiB/image, ten images/product, 40 megapixels and a 60-second upstream timeout. Application buffering is a signature plus a native chunk; runtime/network buffers remain additional. Local heap snapshots do not establish peak native memory or remote 128 MiB compliance. An upload accepted upstream followed by cancellation/save failure may leave an unused asset; automatic asset deletion is intentionally absent to protect references.

Recorded local runs included ten requests per image size and three concurrent 10 MiB requests. Request wall time includes fixture decoding, hashing and I/O. V8 sampling is diagnostic only and includes scheduling/wait gaps; neither wall time nor sampled time proves remote billed CPU compliance. The 10 MiB fixture uses a valid PNG with trailing padding accepted by local Sharp; actual Sanity acceptance remains untested. See JSON artifacts for measured values.

Catalog bounds are 1,000 logical products, 200 categories and 10,000 assets; exceeding query bounds fails explicitly. Mutation JSON is capped at 64 KiB and catalog responses at 4 MiB. These application limits are not service quota guarantees.

The local fixture models the Sanity protocol but cannot certify real Sanity transaction/query semantics, token permissions, streaming acceptance or publishing webhook delivery. No real Sanity upload or mutation was performed. Private preview requires authentication; uploaded draft asset URLs will remain public as previously accepted. Remote Cloudflare SQLite migration acceptance, persistence, CPU/memory limits and account entitlements remain unverified. Wrangler's development proxy exhibited an abort/recovery issue. Direct local workerd also closed a rejected-body HTTP/1 socket while Node's pool still considered it reusable, causing a subsequent upload EPIPE. The streaming harness now uses independent connections (no automatic write retries); all six checks passed. Browser upload/recovery interactions passed, but remote pooled-connection and cancellation/recovery behavior still needs checking.

## Minimal remaining launch gate

1. **Explicit permission for a bounded real Sanity smoke test.** Supply a least-privilege token through private server environment configuration and check existing Free quota. Use only a newly tagged QA product and two new images, referencing an existing category. Exercise draft/publish/update/unpublish; keep the result as a draft and retain assets. Publishing can briefly expose the QA product and trigger the unchanged Pages webhook/rebuilds. Do not edit/delete existing products. Real category mutation testing needs separately scoped approval for a new QA category. Read-only checks alone cannot validate this gate.
2. **Separate Cloudflare deployment approval.** Confirm the personal account's current Free entitlement, choose the approved hostname, install server-only secrets and activate the disabled release template. Provision only the approved Worker/SQLite Durable Object; no paid upgrade or alternative. If entitlement/billing verification blocks, stop for confirmation.
3. **Protected remote acceptance before owner launch.** Verify actual SQLite migration/session persistence, measured remote CPU/memory and Free quota behavior, chunked upload/cancellation, authorization and webhook publication. Stop on a $0 reliability blocker. No further architecture review is required to begin these scoped checks.

Primary changed areas: `worker/{index,sanity,uploads,access,slug}.ts`, inactive release configuration, API provider/context/model, product editor/categories/shell and the small toast-position fix, local provisioning/package scripts and isolated test fixtures. No public storefront source was changed.
