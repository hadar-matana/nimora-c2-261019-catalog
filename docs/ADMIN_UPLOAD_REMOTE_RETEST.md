# Bounded remote upload CPU retest

16 October 2026, Asia/Jerusalem. **The two approved browser uploads passed the observed Workers Free CPU gate. Normal Stage 2 writes remain disabled.** No broader production-readiness claim is made.

## Deployment and scope

Existing authenticated admin: https://atelier-admin.hadarmat.workers.dev/login/

- Activated optimized upload code and supporting upload-only gate on existing `atelier-admin` Worker, version `6ab37063-b28d-4972-b38d-12bdbe4f1ca3`.
- `SANITY_ALLOW_PRODUCTION_WRITES` remained `disabled` for the entire retest. Product draft/save/publish/unpublish and category routes were never enabled, including for the QA item.
- Uploads alone were temporarily enabled through `SANITY_UPLOAD_RETEST_UNTIL`, with a 20-minute deadline. The supporting code also rejects expired/invalid deadlines and still requires the owner session and CSRF.
- After two uploads, explicitly disabled the gate (`0`) on version `a9760d7c-f82c-48ec-8b2a-3ea89b9602a4`. The native upload optimization remains deployed behind the disabled gate.
- Workers dashboard confirmed **Free, $0, Current plan** before and after deployment. No billing, paid plan or entitlement change was made.
- Final inventory: one Worker `atelier-admin`; original SQLite namespace `atelier-admin_OwnerAuth`, ID `c0793f56356f4f1c8935e181e5d4d4ea`. No new Worker, Durable Object or migration.
- A temporary trace-v1 debugger WebSocket was used, not a deployed Tail Worker. Its connection was removed afterward. Raw events/headers/cookies were processed only in memory and never printed or persisted. Only allowlisted timing, transport and asset fields were retained.

The existing dedicated Sanity service credential remained server-side and unchanged. No mock account, new owner account or broad personal CLI token was deployed. The owner signed in privately; the temporary API verification session was revoked and its file removed after the 403 checks. The owner's browser session remains available.

## Actual Chrome upload results

Exactly **two image POST requests**, sequentially, with no upload retries. Total image bytes: **3,512,638**. The approved editor and normal browser File-body fetch path were used. The first chooser automation timed out before selection; Chrome's native macOS picker was then used. No extension/security setting was changed and no image request was sent by that unsuccessful chooser interaction.

The handler's gated diagnostic callback executes immediately after constructing FixedLengthStream, making stream-path selection an observed runtime fact rather than an inference from a header.

| File | Start, Israel time | Bytes / observed Content-Length | Stream path | HTTP / Sanity | Individual trace CPU | Trace wall time |
| --- | --- | ---: | --- | --- | ---: | ---: |
| PNG | 10:21:09.075 | 2,036,746 | FixedLengthStream | 200 / new asset accepted | 7 ms | 2,029 ms |
| WebP | 10:22:15.612 | 1,475,892 | FixedLengthStream | 200 / new asset accepted | 2 ms | 1,474 ms |

Both uploads had trace outcome `ok`, zero exceptions, matching accepted bytes and valid image metadata. Both decoded at 1086×1448 and rendered as unsaved thumbnails in the existing editor. Neither was attached to the product with a save operation. Those unsaved additions were discarded by reloading; the editor returned to the original two images.

## CPU and memory correlation

**Sample counts:** two accepted image upload traces, one per file. Their diagnostic markers identify actual path selection, declared bytes, accepted asset ID and bytes in the same trace event. Unlike the previous test's timing-only inference, these trace events are explicitly tied to the upload route and runtime marker.

Trace CPU is surfaced in whole milliseconds. The independently retrieved Cloudflare GraphQL analytics returned one-request, two-subrequest, success buckets at each exact event timestamp second, with equal P50/P99 values:

| File | Matching UTC bucket | Returned requests | CPU P50=P99 | Reported memory P50=P99 |
| --- | --- | ---: | ---: | ---: |
| PNG | 2026-10-16 07:21:09 | 1 | **7,438 µs = 7.438 ms** | 2,963,407 bytes (~2.826 MiB) |
| WebP | 2026-10-16 07:22:15 | 1 | **2,852 µs = 2.852 ms** | 2,433,537 bytes (~2.321 MiB) |

Maximum observed direct trace upload CPU: **7 ms**. Maximum correlated one-request analytics CPU: **7.438 ms**, below the documented/account-displayed **10 ms** Free allowance. Both measurements are remote Cloudflare results, not local averages. See [Cloudflare invocation timing](https://developers.cloudflare.com/changelog/post/2025-04-09-workers-timing/) and [analytics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/).

The trace API did not provide memory. Memory figures above are analytics-reported values for the matching buckets, not individually traced peaks or absolute native/isolate peak memory. Highest returned memory P99 across the complete retest window was ~3.300 MiB, which includes other reads/assets, not just uploads.

Analytics are adaptive, delayed and not a complete trace/profile. Exact second/count/asset-marker correlation is strong, but these two samples are not a load test or a guarantee for all files, colos, cold starts or concurrent traffic. The previous 24.077 ms upload used different bytes/encoding and runtime conditions, so this is not a controlled remote percentage-speedup comparison. The diagnostic logging overhead is included in the measured requests.

**Unverified:** remote JPEG and maximum 10 MiB behavior, arbitrary concurrency, worst-case CPU, and unknown-length upload CPU. The counted unknown-length path remains the previously documented local CPU risk. This retest demonstrates the actual Chrome path supplies Content-Length for these two selected files; it does not prove every browser/transport will do so.

## Errors, quotas and $0 requirement

At the captured final analytics snapshots:

- Retest window: 111 Worker requests, zero reported runtime errors; highest returned CPU P99 7.438 ms. This includes browsing and security probes, not 111 uploads.
- Daily snapshot: 163 Worker requests of 100,000/day, zero reported runtime errors; maximum returned memory P99 ~3.635 MiB.
- Durable Object daily snapshot: 140 requests of 100,000/day; 0.5168704 GB-s of 13,000/day; 251 SQLite rows read of 5,000,000/day; 8 written of 100,000/day.
- DO exceeded-CPU, exceeded-memory and fatal errors: zero.
- Storage analytics returned no rows; storage consumption is unmeasured, not zero.

Daily and DO datasets may lag differently and exclude later verification/cleanup traffic. These are captured observations, not final billing totals. HTTP 403 security probes are expected denials with `ok` runtime outcomes, not Worker exceptions. The sanitized trace contains two image successes and two non-image 403 upload probes (before activation and after disabling).

**Free-plan conclusion:** account remained Workers Free with no added recurring service, and both approved requests stayed below the observed 10 ms gate. This bounded retest passed. It does not authorize normal Stage 2 or establish universal Free-plan upload reliability.

## Sanity audit and retained assets

A canonical SHA-256 document baseline was captured read-only before activation. All **68 pre-existing documents**, including internal service records, existing assets, boutique content and the retained QA draft, were unchanged afterward. Exactly two new asset IDs appeared:

- PNG: `image-24f148fac95118b5ab232610ce8ac59557c5f1be-1086x1448-png` — 2,036,746 bytes.
- WebP: `image-7cc522961409db7ab92ec88c4e565ce1ae47eac6-1086x1448-webp` — 1,475,892 bytes.

Both files were prepared with content hashes absent from the dataset, avoiding side effects on existing deduplicated asset documents. They remain in Sanity, intentionally unattached QA assets. Neither assets nor products were permanently deleted.

The retained product remains exactly as before, unpublished:

`drafts.atelier-qa-20261015-0375d18c`

No draft save, product edit, publish or unpublish occurred. Webhook configuration was unchanged; no storefront Pages deployment occurred during the test. No storefront code/design, category, collection, gallery item or site setting was changed.

## Final disabled-gate verification

Using a valid owner session and valid CSRF after the closing deployment:

| Request | Result |
| --- | --- |
| QA product action `draft` | 403 |
| QA product action `publish` | 403 |
| QA product action `unpublish` | 403 |
| Category mutation | 403 |
| Upload mutation (non-image probe) | 403 |

Final verified bindings: `SANITY_ALLOW_PRODUCTION_WRITES=disabled`, `SANITY_UPLOAD_RETEST_UNTIL=0`. Authentication remains required for the admin; normal Stage 2 is not active. The API test session was then logged out, replay rejected with 401, and its local file removed. The temporary trace connection was removed. Existing real owner credentials and Sanity secret were not changed.

## Code/checks/evidence

Strictly supporting changes, with no UI redesign:

- `worker/uploads.ts`: previously tested native stream optimization plus an optional transport diagnostic callback.
- `worker/sanity.ts`: expiring, upload-specific permission separate from content writes.
- `worker/index.ts`: upload-only middleware exception and gated allowlisted diagnostic markers; all owner/CSRF checks remain before it.
- `worker/wrangler.release.jsonc`: disabled-by-default retest deadline (`0`), content writes still disabled.
- `tests/integration-guards.mjs`: upload-only expiry/auth/CSRF/content-write regressions.
- Private test/audit/deployment/trace/metrics helpers in `apps/admin/scripts/upload-retest-*.mjs` and `deploy-upload-retest.mjs`; no credentials are embedded.

Lint, admin TypeScript, Worker TypeScript, static build, and all eight integration guard checks passed. Previous local upload/security regression results remain in `ADMIN_UPLOAD_CPU_OPTIMIZATION.md`.

Evidence under `docs/admin-screenshots/`:

- `upload-remote-retest.json`: bounds, deployment versions, unchanged-content audit, asset IDs and final bindings.
- `upload-retest-tail.json`: sanitized individual request traces and debugger cleanup confirmation.
- `upload-retest-correlated.json`: exact matching analytics buckets and counts.
- `upload-retest-metrics.json`, `upload-retest-daily-usage.json`: delayed remote analytics snapshots.
- `upload-retest-free-plan.jpg`: account still Free after deployment.
- `upload-retest-two-successes.jpg`: both uploads visible only as unsaved editor additions.
- `upload-retest-draft-unchanged.jpg`: original two images after discarding unsaved additions.

Stop point: retest complete, content writes/uploads disabled again. Further Stage 2 work requires separate approval.
