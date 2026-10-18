# Upload CPU diagnosis and local optimization

15 October 2026, Asia/Jerusalem. Local implementation only. No Cloudflare deployment, production upload, Sanity mutation, billing change or additional service provisioning was performed. The release configuration retains `SANITY_ALLOW_PRODUCTION_WRITES=disabled` and the QA-only product guard. Approved UI, storefront and authentication code are unchanged.

The known-length path now has substantial **local mean CPU** headroom. Remote compliance is unverified; the unknown-length path remains a material Free-plan risk. This report does not approve Stage 2 activation.

## Diagnosis of the complete request path

| Operation | Work performed / finding |
| --- | --- |
| Worker host/access middleware | Fixed origin/credential gates, response security headers, cookie parsing and Hono route dispatch. No image processing or request-body logging. |
| Session verification | One internal Durable Object call. The DO hashes a 64-character opaque token with native SHA-256, loads its record, and checks expiration/credential version. **Bcrypt runs only on login**, never on uploads. No auth caching or security reduction was introduced. |
| CSRF and activation checks | Origin and session CSRF comparison precede upload handling; production write gate still fails closed. |
| Request validation | MIME allowlist; numeric Content-Length, if present, capped at 10 MiB. Prefix read copies only 12 signature bytes, retaining original stream chunks. |
| Signature detection | PNG/JPEG magic bytes; WebP RIFF/WEBP bytes. No decoding/re-encoding/compression/base64 of image contents. Full image decoding remains Sanity's responsibility. |
| Original body transport | A JavaScript ReadableStream pull function called `reader.read()`, counted each chunk and enqueued unchanged bytes. This crosses native/JS boundaries throughout the file and creates promises/stream bookkeeping. Original outbound body had no known native length, so used chunked transport. |
| Sanity request | Raw binary body to the existing fixed project/dataset with the server credential only. HTTPS/network/upload/storage waiting contributes to wall time, not billed Worker CPU. |
| Sanity response | At most 64 KiB collected/decoded/parsed; asset type, content-hash ID, expected CDN URL, MIME, exact byte size and positive dimensions/40 MP cap checked. No entire image response buffer. |
| Cleanup / logging | Abort controller and 60-second timeout. No image/body/token/session logging or persistent runtime request logs added. No product/catalog query occurs in the upload handler. |

The strongest supported explanation is **per-chunk JavaScript pumping plus native stream/HTTP bookkeeping**, rather than password hashing or network delay. Switching the transport to native piping reduced measured process CPU by 79% for the same PNG while the unchanged session baseline stayed at 1.00 ms. Local V8 samples and the reduction support this explanation, but there is no remote stack profile proving that all 24.077 ms came from one function. Upstream transport also changes from chunked to fixed-length, so the measured benefit cannot be assigned exclusively to JavaScript callbacks.

### Attribution of the original remote measurement

Existing Cloudflare analytics show one request in the 22:20:46 Israel time bucket (19:20:46 UTC), with CPU P50=P99=24,077 µs, two subrequests and success status. The authorized upload started at 22:20:46.246 and completed at 22:20:48.433; its elapsed time was 2,185 ms. One auth DO subrequest plus one Sanity subrequest fits the upload path. Other returned buckets had lower CPU.

This is strong timing/count correlation, **not definitive request tracing**: the stored analytics lack a request path, method, Ray ID and stack; adaptive metrics may be sampled/delayed. Cold-start/runtime work, garbage collection and scheduling could contribute. The 2.185-second duration is not CPU time, and the single 24.077 ms result is not a stable distribution or a worst-case bound. No additional production request was made to recreate it.

## Exact changes

Production code changed only in `apps/admin/worker/uploads.ts`:

1. For a validated, known Content-Length, sniff the original signature, then hand the remaining native request body to **FixedLengthStream + pipeTo**. workerd enforces exactly that length, which is already <=10 MiB, without the per-chunk JS counter. Native fixed-length framing supplies upstream Content-Length automatically; the code does not forge that header. Initial original chunks are forwarded unchanged. Fixed-length streams reject both short and long bodies.
2. Unknown-length bodies retain the counted, pull-driven zero-high-water-mark path and running 10 MiB cap. No silent loss of size validation or support for existing chunked transfers. Initial chunks use an index rather than array shifting.
3. WebP validation compares eight fixed bytes directly instead of creating two TextDecoders/string slices.
4. Already-aborted requests are rejected before the upload starts. Native pumping has an attached rejection handler; cancellation/deadline aborts upstream and the source. Cleanup does not wait forever for a canceled source to supply another chunk/EOF. No success is returned without full transfer and valid upstream metadata.

No whole-image concatenation, hash, transformation, extra copy, new dependency or browser credential was introduced. Initial/runtime chunks and bounded metadata still occupy memory; this is not a remote peak-memory certification. Response validation, 60-second deadline, MIME/signature checks, 40 MP cap, error sanitization, auth and CSRF remain in force.

Cloudflare documents native byte-length enforcement and automatic Content-Length in [FixedLengthStream](https://developers.cloudflare.com/workers/runtime-apis/streams/transformstream/).

## Before/after local measurements

Same machine, same workerd 1.20261006.1, source before/after, same isolated authenticated HTTP fixture, same image bytes. The baseline source was restored temporarily only in the local checkout for measurement, then the optimization was restored. No deployment occurred.

**Host OS process CPU**, three warm batches of 40 requests per scenario, 120 requests total per version. This includes native workerd runtime and the auth DO in that process, excludes the separate Node Sanity fixture's CPU, and excludes time merely waiting on network. `ps` resolves aggregate CPU to 10 ms, amortized across each batch. No profiler was attached during these batches. It is not per-invocation billed CPU and does not expose individual tail latency.

| Scenario | Bytes | Before ms/request | After ms/request | Reduction |
| --- | ---: | ---: | ---: | ---: |
| session | 0 | 1.00 | 1.00 | 0.0% |
| PNG | 2,225,686 | 11.42 | 2.42 | 78.8% |
| JPEG | 400,181 | 3.25 | 1.67 | 48.7% |
| WebP | 1,475,134 | 7.92 | 2.08 | 73.7% |
| 10MiB-padded-PNG | 10,485,760 | 46.17 | 5.08 | 89.0% |
| PNG-chunked | 2,225,686 | 13.67 | 13.75 | -0.6% |

The 10 MiB payload is an actual PNG followed by padding. The isolated decoder accepts it; it tests transport/size enforcement, not guaranteed Sanity acceptance or realistic photo encoding. JPEG and lossless WebP were locally encoded from the same test PNG; no production image upload was made.

Separately, 15 warm **V8 inspector samples** per scenario were collected against the explicitly selected `core:user:atelier-outer-verification` target. Auth is in a separate local isolate. Inspector sampling deltas can include native/program frames and scheduling/I/O gaps, and are not an OS CPU clock:

| Scenario | Before non-idle median ms | After non-idle median ms | After sampled non-idle maximum ms |
| --- | ---: | ---: | ---: |
| PNG | 12.156 | 4.945 | 5.684 |
| JPEG | 3.703 | 1.740 | 3.903 |
| WebP | 7.988 | 3.851 | 4.529 |
| 10 MiB padded PNG | 44.477 | 12.013 | 13.596 |
| Chunked PNG | 12.481 | 14.995 | 28.304 |

The difference between the 10 MiB OS mean and inspector times illustrates why inspector non-idle durations must not be labeled billed CPU. Small JS-only samples are especially noisy. Generic Wrangler `/ws` selected the auth target in this multi-isolate session; that preliminary measurement was discarded. The saved before/after artifacts explicitly identify the correct outer target. Host process measurements provide an additional independent comparison including native work.

## Regression/security results

All final checks passed:

- **16 full fixture integration checks:** authentication, native drafts, validation, CSRF, stable IDs/slugs, published edit semantics, revision conflicts, unpublish recovery, reference protection, image ordering/primary image, category preservation, upstream failure behavior and no permanent product deletion.
- **7 streaming checks:** upload-specific unauthenticated/invalid-session rejection (401); missing/wrong CSRF/foreign origin rejection (403), all before upstream body handling; upstream receives bytes before client EOF; valid PNG/JPEG/WebP; unsupported HEIC/SVG and invalid/truncated signatures; 10 MiB maximum and fixed/unknown-length oversize rejection; upstream 401/429/500, premature success and invalid metadata; both known/unknown-length interrupted transfers create no partial fixture asset; three concurrent maximum-size uploads complete.
- **16 native workerd unit probes:** fragmented signatures and editor-compatible DTO; short/long/zero/malformed/oversize declared lengths; already-aborted and mid-transfer aborted requests; 60-second timeout returns 504 (timer accelerated only in test); early success, >64 KiB response, malformed JSON, wrong dimensions/MIME/size rejected. Native length mismatches return a safe 400 or 502 depending on which stream failure wins; never success.
- **7 integration guard checks:** no live writes without gate, no remote fixture origins, private host protection, bounded session policy, Stage 1 mutation rejection before parsing/upstream, QA-only scope and required owner auth/CSRF.
- `pnpm --filter admin lint`, `typecheck`, `typecheck:worker`, and `build` passed.

Fixtures are local-only. Their image decoding/hashing is performed by the separate fixture process, not application Worker code. The test-only workerd probe replaces fetch with an in-memory sink and contains no production credentials. It must never be deployed. Production UI/DTO fields and editor image behavior are unchanged; no browser redesign was made or needed.

## Deduplicated QA asset investigation

Read-only authenticated Sanity History API snapshots immediately before/after the original upload were available. Asset:

`image-af8d2a2cbbb9278c67b882d717a82fa5493e005f-1086x1448-png`

Exactly three fields changed:

| Field | Before | After |
| --- | --- | --- |
| `_rev` | `LUVMgk5iVxxz0joj4scBGt` | `LUVMgk5iVxxz0joj4shy1f` |
| `_updatedAt` | `2026-10-15T17:46:46Z` | `2026-10-15T19:20:48Z` |
| `uploadId` | `929cf21f7269b996d7b6ef0d3200e7b54a6b010e` | `31866701e3224b9f4795464e15a1f8ce2bfd6919` |

These are exact stored UTC service timestamps. No changes to URL, content hash/ID, original filename, size, dimensions, title, description, palette or other metadata were found. The integration sent only a raw binary upload, with no filename/title/source query parameters and no asset patch mutation. This is evidence of Sanity recording a repeat upload of the same content, not an integration field overwrite. [Sanity assets documentation](https://www.sanity.io/docs/content-lake/assets) explains content-hash deduplication; [History API](https://www.sanity.io/docs/http-reference/history) provided the actual snapshots.

**Identical bytes are not a no-op for the asset document:** a repeat upload can at least change revision, update time and uploadId. Other optional metadata may be affected if explicitly supplied by an uploader; this particular test did not change those fields. No corrective action is needed for service-managed bookkeeping, and none was performed. No asset content, references or boutique product was modified during this investigation.

## Remaining Free-plan risks and bounded retest proposal

- Known-length local process means show useful headroom, but remote hardware, isolate cold starts, GC, TLS and per-request tails remain unmeasured for the optimized code. No 10 MiB production compliance claim is made.
- **Unknown-length requests remain costly (~13.75 ms local process mean for this PNG).** They remain securely supported, but cannot be described as Free-safe. The real browser-to-Worker path must be verified to provide a usable Content-Length and actually select the native path. Local process cost is not the exact outer billed CPU, but this is a clear risk signal.
- Fixed-length upstream framing is standard HTTP and passes local fixture tests; the optimized path has not yet been tested with real Sanity.
- Application buffering is bounded, but remote peak/native memory, concurrent invocation tail CPU and large-file behavior still need evidence. No per-upload peak-memory guarantee is inferred from local tests.
- The Sanity service token's underlying Free Editor grant remains broader than the Worker endpoint allowlist; credentials remain server-only and Stage 2 is disabled.

**Proposal requiring separate approval; not performed:** update only the existing Worker with writes restricted to the retained QA product and uploads; keep category/other-product writes blocked. Prepare two new, content-distinct local QA fixtures and check their hashes against existing assets read-only. Perform at most **two QA uploads total**, one PNG (~2.23 MB) and one WebP (~1.48 MB), one at a time, to avoid changing any existing deduplicated asset document. Capture a read-only metadata baseline; establish actual browser Content-Length/native-path selection without recording cookies or credentials. Correlate each request with sanitized per-invocation CPU if available on Free, otherwise isolate analytics windows and explicitly retain attribution limits. Wait for metrics after each upload and stop on >10 ms, upload failure, security failure or paid requirement. Attach only to the retained QA draft if needed, preserve its original images, and do not publish. Disable writes/uploads again at completion. Leave any new QA assets intact and report their IDs. This small-file retest would not certify the entire 10 MiB limit or all formats.

If native uploads still fail the remote CPU gate, genuinely $0 options to evaluate locally before any paid recommendation are:

1. **Reuse the existing SQLite Durable Object for upload processing**, retaining outer auth/CSRF and native forwarding. DO default CPU limits differ from the outer Worker's 10 ms, but this changes the approved request path and needs approval plus benchmarking. It uses no new namespace/service, though DO request/duration/storage quotas and concurrency require checks. No such change was implemented. See [DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/) and [Free allowances](https://developers.cloudflare.com/durable-objects/platform/pricing/).
2. **Use the existing Sanity Studio for uploads** under its existing Free account while the admin remains read-only. This adds no infrastructure, but interrupts the approved owner workflow and is a fallback, not a finished standalone admin.

Another Pages Function would share the Workers CPU constraint and is not a solution. Browser-side Sanity write secrets or anonymously writable routes are not alternatives. There is no evidence yet that a paid service is required.

## Files and reproduction

Production code: `apps/admin/worker/uploads.ts` only.

Test/support additions: `tests/upload-profile.mjs`, `tests/upload-process-cpu.mjs`, `tests/upload-native-probe.mjs`, `tests/wrangler.upload-probe.jsonc`, `scripts/investigate-qa-asset.mjs`; enhanced `tests/streaming.mjs` for explicit upload auth, known-length cancellation and signature checks. All are under `apps/admin/`.

Reports: this document; `docs/admin-screenshots/upload-profile-{before,after}.json`, `upload-process-cpu-{before,after}.json`, `upload-native-probes.json`, `upload-asset-history.json`, `upload-optimization-checks.json`, plus refreshed fixture integration/streaming artifacts. Source SHA256 is captured in the process-CPU reports and matches the final source; raw profiles and credentials are not saved in reports. All local servers started for this work were stopped, the prior ignored local vars were restored, and temporary fixture account/session files were removed.

For local reproduction, start `node apps/admin/tests/sanity-fixture.mjs` in one terminal (it generates ignored local-only credentials; privately back up an existing `.dev.vars` first). In another:

```sh
WRANGLER_LOG_PATH=/private/tmp/atelier-upload-profile.log WRANGLER_SEND_METRICS=false pnpm --filter admin exec wrangler dev --config worker/verify.outer.jsonc --config worker/verify.auth.jsonc --local --ip 127.0.0.1 --port 3002 --inspector-port 9229 --persist-to .wrangler/upload-profile-state
```

Then run from repository root:

```sh
node apps/admin/tests/integration.mjs
UPLOAD_PROFILE_LOG=/private/tmp/atelier-upload-profile.log DIRECT_WORKER_VERIFY=1 node apps/admin/tests/streaming.mjs
node apps/admin/tests/upload-profile.mjs after
node apps/admin/tests/upload-process-cpu.mjs after
```

The process CPU harness currently uses macOS `lsof` and `ps`. To run the native edge-case probe, start `wrangler dev --config tests/wrangler.upload-probe.jsonc --local --ip 127.0.0.1 --port 3004 --inspector-port 9235` from `apps/admin` and GET its loopback root. These configurations are test instrumentation, never deployment configurations.
