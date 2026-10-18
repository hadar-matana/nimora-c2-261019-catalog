# Remote Stage 1 verification — 15 October 2026

**Stage 1 passed for controlled, authenticated read-only use on Workers Free. Stage 2 is disabled and requires separate explicit approval. This is not a full production admin release.**

Admin URL: https://atelier-admin.hadarmat.workers.dev/login/

Only the existing manually provisioned owner account can authenticate. No mock/demo account was created. The owner entered credentials privately in the terminal helper and Chrome; passwords were neither displayed nor persisted by the verification helper.

## Remote test results

| Requested test | Result and evidence |
| --- | --- |
| Invalid login | PASS — wrong credentials return 401; foreign login origin returns 403. |
| Valid owner login | PASS — existing owner credentials work through the remote Worker/SQLite DO, and actual Chrome reached the dashboard. |
| Persistent sessions | PASS — repeated authenticated requests and browser reload succeed. A stored session also survived a Worker deployment with the same namespace and credential version. Physical crash/forced eviction was not separately tested. |
| Logout/revocation | PASS — logout returns 200, clears the cookie and replay of the revoked token returns 401. Both an initial session and the final temporary verification session were revoked. |
| Expired/invalid sessions | PASS — malformed/unknown tokens return 401. A real stored session expired after a controlled 120-second lifetime and returned 401 even when its cookie was replayed. The eight-hour default was restored before that session expired; a new normal session had the expected eight-hour cookie/lifetime. Eight hours were not waited out. |
| Unauthenticated APIs | PASS — session, catalog and native-draft preview APIs return 401. Protected HTML pages redirect to `/login/`. |
| CSRF/rate limiting | PASS — logout with a foreign origin, missing CSRF or wrong CSRF returns 403 without revoking the valid session. A bounded invalid-login probe returned 429. The configured limit counts all login attempts: five/IP and twenty/owner per fifteen minutes. The IP limit was exercised; the twenty-attempt global bucket was not separately exhausted. Existing sessions remain usable while new login attempts are limited. |
| Real Sanity reads | PASS — 16 logical products (12 published, 4 drafts), five categories. Every existing published product/category ID from the public Sanity perspective was present in the authenticated catalog. The retained QA draft preview loaded with both images. |
| Writes/uploads disabled | PASS — authenticated draft, publish, unpublish, category and upload probes all return 403. The Stage 1 middleware rejects them before parsing a body or contacting Sanity. Probes contain no valid product/image, and no upstream Sanity mutation/upload test was performed. The underlying adapter also retains its independent production-write gate. |
| Desktop/mobile UI | PASS — actual Chrome at 1440×900 and 390×844; no horizontal overflow. Product listing/search, five categories, mobile navigation, editor read view, primary image and private preview rendered. Viewport override was reset. |
| Remote runtime/Free usage | PASS for the measured read-only window — actual Cloudflare analytics and current Free plan observed; limitations below. |

Session cookies use the `__Host-` name, Secure, HttpOnly, SameSite=Lax and Path=/; their Max-Age follows the server lifetime. Session identifiers are random, hashed before durable storage, and authorization/expiry is checked on every protected request. No request/credential logging was enabled for these tests. Four credential bindings remain `secret_text`; their values were not retrieved or displayed.

[Machine-readable functional tests](admin-screenshots/stage1-remote-tests.json).

## Real Cloudflare measurements

The final daily query spans midnight UTC through the collection time. The account has one Worker and one SQLite namespace. These are returned, potentially delayed/sampled counters, not a load test or billing forecast:

| Metric | Returned observation | Free allowance/reference |
| --- | --- | --- |
| Worker requests | 187 | 100,000/day |
| Worker runtime errors | 0 | No CPU/memory/runtime exception observed |
| Maximum returned per-bucket CPU P99 | 6.596 ms | 10 ms outer Worker CPU/request |
| Maximum returned Worker memory P99 | 3.441 MiB | 128 MiB isolate limit; sampled V8 memory is not a peak/native-memory certificate |
| Durable Object requests | 131 | 100,000/day |
| DO aggregate CPU | 2.047 seconds across the returned window | Aggregate, not per-login or per-invocation CPU |
| DO memory P99 | 4.277 MiB | Sampled isolate memory; objects may share an isolate |
| DO CPU exceeded / memory exceeded / fatal errors | 0 / 0 / 0 | No limit error observed |
| DO SQL rows read / written | 145 / 19 | 5,000,000 reads / 100,000 writes per day |
| DO duration | 0.325 GB-s | 13,000 GB-s/day |
| Stored bytes | No rows returned | Not measured; an empty metrics result is not proof of zero storage |

CPU and memory units were verified through GraphQL field descriptions: CPU values are microseconds, memory bytes and duration GB-s. The reported CPU figure is the largest returned bucket P99, **not the absolute maximum request CPU**. Authentication hashing runs in the Durable Object; its aggregate CPU must not be compared to the outer Worker's 10 ms per-request allowance. Per-login DO CPU was not isolated. Current successful requests and zero platform limit errors support this bounded read-only acceptance, not unlimited capacity or future upload compliance.

[Final daily usage/metrics](admin-screenshots/stage1-daily-usage.json) · [Earlier bounded sample](admin-screenshots/stage1-remote-metrics.json) · [DO metric units](admin-screenshots/stage1-metric-units.json).

The Cloudflare dashboard still shows **Free — $0 — Current plan** after remote testing. [Screenshot](admin-screenshots/stage1-remote-free-plan.jpg). No billing/subscription call, paid upgrade, new Worker, new namespace or other infrastructure was created in this verification.

References: [Workers GraphQL metrics](https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/), [Worker metrics limitations](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/), [Durable Object metrics](https://developers.cloudflare.com/durable-objects/observability/metrics-and-analytics/), [Durable Object limits](https://developers.cloudflare.com/durable-objects/platform/limits/).

## Changes and final configuration

- Added a server-side Stage 1 mutation gate before body parsing/upstream access.
- Added bounded operator-controlled session lifetime (60 seconds to eight hours), retaining the eight-hour default and existing short local-fixture override. Cookie lifetime now follows the server expiry; authenticated session responses expose their expiry timestamp.
- Deployed a temporary 120-second acceptance policy, then restored `SESSION_TTL_SECONDS=28800`. The normal-policy deployment is `8ee77f9e-202a-48f4-a13e-d8acc8df0a57`.
- Shared hidden terminal input between provisioning and remote verification; added private acceptance/metrics scripts and local guard/session-policy regression tests. Passwords, hashes and tokens are not printed in prompts/errors/reports.
- Remote gate is approved only for authenticated reads; `LOCAL_COMPAT_PROOF=0`, `SANITY_MODE=production`, `SANITY_ALLOW_PRODUCTION_WRITES=disabled`. workers.dev is enabled; preview URLs remain disabled. The four existing secret bindings and SQLite namespace are unchanged.

Changed implementation areas: `worker/index.ts`, new `worker/session-policy.ts`, `worker/wrangler.release.jsonc`; shared `scripts/private-input.mjs`, provisioning-helper import, new private verification/metrics helpers, inventory safe-field whitelist, and `tests/integration-guards.mjs`. No approved UI components/CSS, storefront code, webhook configuration or Sanity content changed.

Lint, application typecheck, Worker typecheck, meaningful guard/session-policy tests and static production build all passed. The guard test proves denied production routes cannot make an upstream request. Source/operator test configuration cannot enable mock authentication remotely.

## Limitations and cleanup

- No remote application failure remained. An expired Cloudflare control-plane OAuth token caused one metrics schema request to return 401; the existing personal session was refreshed without scope/permission/billing changes, and metrics retrieval succeeded.
- No high-load, long-duration or write/upload performance test was performed. Stored-byte metrics had not populated. Returned counters can lag; they do not certify future quota headroom.
- Full eight-hour elapsed expiration and forced infrastructure crash recovery were not waited out. Actual expiry used the same remote code/storage checks with the shorter operator policy; persistence across requests, browser reload and deployment was verified.
- Existing local-demo labels and editing/upload controls remain visible because the approved UI was preserved. Authentication is real; save/upload actions are rejected by the server in Stage 1. These labels should not be interpreted as mock authentication or write activation.
- The temporary API verification session was revoked, its replay rejected and its private local token file deleted. The owner's separate Chrome session remains valid. A scan of 70 exported files and reports found no temporary session credential exposure. No password/Sanity secret was written into the repository by the helpers.
- Browser viewport overrides were reset. No existing products, drafts, categories, galleries, collections, settings, images, public storefront or publishing webhook were modified.

## Before Stage 2

Stage 1 is ready for approval as an authenticated, read-only demonstration. **Do not enable real product/category mutations or uploads under this approval.**

Stage 2 requires explicit approval, a privately provisioned least-privilege Sanity write credential (the current Viewer token remains read-only), deliberate activation of the independent write gate, and an explicitly bounded remote write/upload acceptance test. Remote upload CPU/memory and lifecycle/webhook checks must be verified at that point. No paid alternative is authorized. This verification stops here.

Concrete scope proposed for that separate approval: privately provision the write credential, activate the write gate, and test only the retained QA product `atelier-qa-20261015-0375d18c` with up to two test-image uploads. Exercise draft → publish → one published edit → unpublish, using the unchanged webhook and measuring the remote upload path. This can briefly expose the QA product and trigger the existing Pages rebuilds. Leave the QA product unpublished as a recoverable draft and retain its images; do not mutate any other product/category/collection/gallery/settings document. Category write testing would need its own bounded fixture approval. None of these actions is authorized or performed by Stage 1.

## Browser evidence

[Desktop catalog](admin-screenshots/stage1-remote-desktop.jpg) · [Mobile catalog](admin-screenshots/stage1-remote-mobile.jpg) · [Private mobile preview](admin-screenshots/stage1-remote-preview-mobile.jpg)
