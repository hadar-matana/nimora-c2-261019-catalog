# ATELIER — final non-billable entitlement and runtime verification

2026-10-14. Scope: verification only. **The architecture is not yet ready for production deployment approval.** SQLite Durable Objects on Free are supported by the available evidence; account-specific migration acceptance and remote CPU qualification are not proven. The approved admin UI, application Worker handlers, storefront, Sanity data and webhook were not changed. No remote resources, paid plan, billing changes or deployment were made.

## Account eligibility: evidence, not a provisioning claim

The owner reports Workers & Pages Free allowance of 100,000 requests/day, zero current usage, accessible Durable Objects dashboard and no upgrade prompt. This is accepted as user-provided account evidence; it is not represented as an independently inspected billing subscription.

GET-only checks using the existing Wrangler OAuth credential returned:

| Check | Result | What it proves |
|---|---|---|
| `/user` | 200; expected personal email matches | Existing credential is the personal identity. No new credential/access scope was created. |
| Account Workers settings | 200; `default_usage_model: standard` | Settings are readable; this field does not identify Free versus Paid. |
| Durable Object namespace list | 200; zero namespaces before and after local verification | Durable Object metadata access works for the account; our tests provisioned no namespace. An empty list does not demonstrate SQLite migration/creation acceptance. |
| Account subscriptions | 403; error code 10000 | Existing OAuth permission still cannot inspect billing subscription state. No scope expansion or billing change was attempted. |

Cloudflare's current [DO pricing documentation](https://developers.cloudflare.com/durable-objects/platform/pricing/) explicitly supports SQLite-backed Durable Objects on Workers Free. Free limits include 100,000 requests/day, 13,000 GB-s/day, 5 million rows read/day, 100,000 rows written/day and 5 GB storage total. On Free, exceeding a limit causes operations to fail; it is not permission to enable Paid. [The namespace-list API](https://developers.cloudflare.com/api/resources/durable_objects/subresources/namespaces/methods/list/) reports existing resources, not a future migration entitlement guarantee.

**Conclusion:** The user dashboard, documented Free support and successful metadata access provide consistent evidence for the proposed Free SQLite architecture. They do not conclusively verify that this particular account will accept `new_sqlite_classes` migration, create the namespace, persist data remotely, or apply the expected quota/billing classification. No documented read-only preflight in the examined API provides that guarantee. Those creation/runtime behaviors remain untested because provisioning is forbidden for this verification. The blocked subscription endpoint is an OAuth authorization limitation, not evidence that a paid upgrade is required.

## Local runtime tests

The original application code was run with Wrangler 4.150.0 / `workerd`, compatibility date 2026-10-13. Test-only configs bind the exact same `OwnerAuth` class in a separate local isolate to keep its bcrypt execution outside the primary outer-Worker profiler. This is instrumentation, **not a second production Worker proposal**. All bindings are local; both configs disable workers.dev and preview URLs. The existing static admin export is served unchanged.

- Auth/session guards, alternative HTML/payload routes, origin checks, CSRF, exact password behavior, bcrypt 72-byte input limit, cookie flags and login throttling pass again.
- Cost-12 bcrypt latest DO elapsed measurement: 209 ms. Prior bcrypt-stack sampling was about 219 ms/verification; these are local measurements, not remote quota enforcement. The [documented DO CPU default](https://developers.cloudflare.com/durable-objects/platform/limits/) is 30 seconds. No weak hash was substituted.
- A read-only SQLite inspection confirms the local auth database is SQLite and contains the runtime's key/value table. This verifies local SQLite storage behavior; it does not create or validate a Cloudflare-hosted namespace.
- Existing published Sanity catalog reads succeed: 12 products, 5 categories. No write token or mutation/asset-upload request is sent to Sanity.

### Outer Worker CPU qualification

Tests sampled the primary outer isolate at a requested 100 µs V8 profiler interval: three login controls, ten sessions, ten published catalog reads, ten real PNG transfers and ten maximum-size transports. Bcrypt stacks were absent from the primary profile, as expected.

| Scenario | Request elapsed average / maximum | Wall-weighted JavaScript-stack sample average / maximum |
|---|---|---|
| Session | 3.00 / 3.89 ms | 0.75 / 2.14 ms |
| Real PNG upload (2,225,686 bytes) | 9.52 / 10.66 ms | 2.43 / 4.47 ms |
| Maximum-size upload (10 MiB) | 29.14 / 37.64 ms | 7.45 / 12.46 ms |

**These sample totals are not trustworthy measurements of billed per-invocation CPU.** The negative control contains about 224 ms of non-idle/unattributed sample duration during a remote-isolate bcrypt wait, with no bcrypt stack and little outer JavaScript. Some Sanity reads similarly attribute roughly 100–157 ms network-wait gaps to program/JavaScript samples. This demonstrates that the local time deltas can include waiting/descheduling. Neither the previous shared-isolate 27–31 ms figure nor the new above-10 ms samples establish a Cloudflare CPU-limit violation. Conversely, small average samples do not establish reliable compliance.

The [Workers Free CPU allowance](https://developers.cloudflare.com/workers/platform/limits/) is 10 ms; waiting on network/database calls is excluded from billed CPU. Local Wrangler does not reproduce the account's remote per-invocation billing meter or certify that allowance. The maximum-size path currently buffers/copies the body and shows GC activity (sampled maximum 12.32 ms, also subject to the same limitation). There is insufficient demonstrated margin to claim reliable $0 operation. Bounded streaming as described in the approved plan remains to be implemented/qualified. No application architecture or upload limit was silently changed during this verification.

### Upload compatibility and cancellation

Tests against the loopback-only HTTP fixture pass directly in `workerd`:

- Real, locally decoder-valid PNG / JPEG / WebP images transfer with correct byte counts and dimensions (1086 × 1448). Generated JPEG/WebP fixtures use the already installed Sharp dependency.
- HEIC, SVG and arbitrary binary MIME types return 415. A PNG declared as JPEG returns 415.
- Exactly 10 MiB transport succeeds; over-limit fixed-length and unknown-length chunked bodies return 413. The maximum-size fixture has a PNG signature and synthetic payload: it is **not a decoder-valid 10 MiB image**.
- Three simultaneous maximum-size transport requests succeed. This is not a certification of remote peak memory or production concurrency limits.
- Fixture 401 / 429 / 500 responses become generic Hebrew 502 errors without exposing upstream-private error detail. No false upload success is returned.

**Known development-proxy failure:** After rejecting a chunked oversized body, the next request returns 500 / `Network connection lost` through Wrangler's public development proxy, reproduced 3/3 times, including when the 413 response body is consumed. The same cancellation/follow-up sequence passes directly through the exact same local workerd handler 3/3 times, preserving application session and CSRF checks. This localizes the observed failure to the development proxy/transport path rather than demonstrating a failure of the application handler. It remains an acknowledged development-test limitation, not a hidden retry or a claim of remote success. No Worker code was changed to mask it.

Actual Sanity authentication, decoding/acceptance of large valid images, CDN visibility and production quotas remain untested. A Sanity-shaped fixture cannot prove those. No live upload was attempted because the owner prohibits Sanity-data changes during verification.

## Readiness and next gates

**No production deployment approval should be requested yet.** No paid-service blocker has been demonstrated, but the hard zero-additional-cost requirement is not fully qualified by the permitted checks.

1. Implement and locally qualify the approved bounded streaming upload path, retaining the 10 MiB limit and unchanged editor UI. Address/document the Wrangler cancellation limitation and repeat transport/error checks.
2. Complete the real draft/save/publish/unpublish/category adapter, input/revision/reference checks and local lifecycle tests. Current proof remains authenticated published reads with live writes blocked.
3. Separately authorize a tightly scoped Sanity smoke test with disposable assets/content and a server-only credential. Test real uploads, private drafts and unchanged webhook behavior without editing existing production products.
4. Present a concrete release candidate after local checks pass. Only separately approved Free-only provisioning can verify actual SQLite migration/creation and remote persistence. It must stop on any upgrade prompt or entitlement rejection.
5. Before owner/production use, verify the platform's actual per-invocation CPU/outcomes, Free classification and remaining quota on that approved protected candidate. No automatic upgrade or billing change is permitted. If provision-free certainty is mandatory, these account/runtime behaviors must remain explicitly unverified and launch must remain stopped.

## Verification artifacts and changes

Captured evidence: `admin-screenshots/final-entitlement-check.json`, `final-runtime-http.json`, `final-isolated-cpu.json`, `final-upload-compatibility.json`, `final-cancellation-check.json`. Artifacts contain no owner password/hash/session token or internal proxy credential.

Only verification assets/documentation changed this turn: test-only `worker/verify.auth.jsonc`, `verify.outer.jsonc`, `verify-auth.ts`; new `tests/verify-entitlement.mjs`, `verify-cpu.mjs`, `verify-uploads.mjs`, `verify-cancellation.mjs`; existing `proof-fixture.mjs` gains controlled local upstream failures, and `proof-http.mjs` gains an optional final-report filename. Lint, admin typecheck and Worker typecheck pass. No frontend, Worker application handler, dependency, storefront, Studio schema or webhook changes were made. Local servers and temporary plaintext account/session artifacts are stopped/removed after verification; the ignored test state is local only.

Reproduction: start `node apps/admin/tests/proof-fixture.mjs`; from `apps/admin` run `WRANGLER_LOG_PATH=/private/tmp/atelier-final-verification.log WRANGLER_SEND_METRICS=false pnpm exec wrangler dev --config worker/verify.outer.jsonc --config worker/verify.auth.jsonc --local --ip 127.0.0.1 --port 3002 --inspector-port 9229 --persist-to .wrangler/final-verification-state`. Then run `FINAL_VERIFY=1 node apps/admin/tests/proof-http.mjs`, `node apps/admin/tests/verify-cpu.mjs`, `node apps/admin/tests/verify-cancellation.mjs`, and `DIRECT_WORKER_VERIFY=1 node apps/admin/tests/verify-uploads.mjs` from the root. Start from disposable local test state / a fresh fixture and allow the persisted rate window to expire before repeating login-heavy checks. Entitlement script is GET-only and reuses the existing personal OAuth credential; it does not request additional scopes. Direct-runtime tests read internal proxy configuration privately from the local log; they do not print its credential or bypass application authentication.
