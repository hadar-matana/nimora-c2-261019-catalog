# Stage 2 controlled activation — stopped at CPU gate

15 October 2026. **Not ready for normal admin use.** Workers remains Free ($0); no new Cloudflare infrastructure, billing change, storefront code change or webhook configuration change was made.

Authenticated admin: https://atelier-admin.hadarmat.workers.dev/login/

## Activation and safety rollback

Personal Cloudflare and Sanity identities were verified. Workers dashboard showed Free as the current $0 plan, 100,000 requests/day and 10 ms CPU/request. All four required bindings existed as `secret_text` before activation. A dedicated project token was created and its metadata verified to have exactly `editor`; it replaced the server-only Sanity binding. No personal CLI token was deployed. The personal CLI credential was used only to provision/inspect the dedicated service token and perform read-only audits.

Editor is the minimum feasible content-write role on Sanity Free. Its underlying grant covers project content; it is not restricted to the QA document. This limitation was already documented in the approved MVP plan. Worker authentication, CSRF, fixed project/dataset, field allowlists and the added QA-ID guard restrict owner requests. Custom document-filtered Sanity roles were not purchased. See the [Sanity project token API](https://www.sanity.io/docs/http-reference/projects-api).

Controlled activation version: `b6f38cc9-629f-4c03-91eb-f3768265d451`.

When remote analytics reported CPU above 10 ms, testing stopped before publication. The same Worker was updated to disable production writes/uploads. Final version: `3837b218-797d-4285-9666-ff5973e0bba6`. The QA-ID guard remains as an additional restriction. The dedicated Editor credential remains server-side; disabled routes cannot use it for owner mutations. Authenticated reads remain available. No extra Worker, namespace or migration was created.

## Remote results

| Check | Result |
| --- | --- |
| Private owner login | Passed using existing owner credentials through hidden terminal prompts; no password persisted. |
| Session persistence | Passed across authenticated requests and Worker deployment. |
| Unauthenticated writes/uploads/settings | 401. |
| Missing/incorrect CSRF or foreign origin | 403. |
| Writes to other products / category mutations | 403 before parsing/upstream access. |
| Site settings endpoint | 405 for authenticated requests; unsupported. |
| Invalid product name, price and category | 400; no mutation. |
| Remote streaming image upload | HTTP 200, 2,225,686-byte PNG, 2,185 ms wall time. One upload attempt only. |
| Native QA draft save | Passed, existing ID/slug/category/images retained. |
| Authenticated draft preview | API and real Chrome passed; anonymous preview 401. |
| Desktop/mobile preview | Approved UI preserved; mobile document width 390 at 390 px viewport, no horizontal overflow. |
| Draft public absence | Catalog HTTP 200, QA slug absent; no webhook attempts or Pages builds during this test. |
| Publish and webhook rebuild | **Not attempted** after CPU stop condition. |
| Published edit and catalog update | **Not attempted**. |
| Unpublish lifecycle | **Not attempted**; QA never left its unpublished state. |
| Final draft recovery | Passed: exactly one native draft, original two image references intact. |
| Safety rollback | All three product actions and upload route verified 403 after writes disabled. |
| Test-session cleanup | Passed: logout revoked the test session, replay returned 401, temporary API session file removed. |

Invalid-login, expiration, rate-limiting and full logout behavior had passed Stage 1. This stopped Stage 2 run did not repeat the expiration/rate-limit cycle.

## Runtime / usage

Cloudflare remote sampled analytics reported a **single-request bucket at 19:20:46 UTC with 24,077 µs (24.077 ms) CPU**, above Workers Free's 10 ms allowance. The upload attempt started at 19:20:46.246 UTC and completed at 19:20:48.433 UTC. That bucket has one invocation and two subrequests, strongly correlating it with the upload (authentication DO + Sanity upload). Analytics do not include a request path, so attribution is by timing/count, not a trace. The upload succeeded, but success alone does not establish reliable Free CPU compliance.

The measured bucket's memory was 7,382,991 bytes (~7.04 MiB); highest returned Worker memory P99 in the test window was ~7.52 MiB. No memory limit error was reported. This is sampled analytics, not absolute peak memory or a load guarantee.

Daily snapshot at 19:27 UTC:

- Worker: 317 requests of 100,000/day; zero reported runtime errors.
- Durable Object: 221 requests of 100,000/day; 0.489006208 GB-s of 13,000/day.
- SQLite rows: 247 read of 5,000,000/day; 25 written of 100,000/day.
- DO CPU/memory-limit errors and fatal errors: zero. DO aggregate CPU 2.984303 seconds is a different runtime budget from the outer Worker's per-request 10 ms limit.
- Storage analytics returned no rows: storage consumption remains unmeasured, not zero.

Snapshots are delayed, sampled and captured before final cleanup requests; they are not final billing totals. No paid upgrade was enabled. CPU compliance is **failed**, despite low request quotas and successful HTTP responses.

## Content and assets

Retained draft: `drafts.atelier-qa-20261015-0375d18c`.

Name: `ATELIER QA — בדיקת אינטגרציה זמנית 15.10.2026 — עודכן`.

One QA-only description addition was saved: `בדיקת Stage 2 מבוקרת.` No name/price edit was published. Stable slug and existing category reference were preserved.

New asset documents: **zero**. Sanity deduplicated the authorized image upload to the existing QA asset:

`image-af8d2a2cbbb9278c67b882d717a82fa5493e005f-1086x1448-png`

The second original asset remains referenced:

`image-3ea45fd5ee9fdedc2fd4c8f04ecbfd4256fa590b-1087x1447-png`

The baseline contained 67 documents outside the QA product IDs. The full baseline hash comparison did not pass wholesale: Sanity's internal `_.groups.*` records differed after dedicated token provisioning, and the reuploaded/deduplicated QA image asset document differed. No non-QA boutique content document changed and no additional document ID was created. The baseline stored hashes, so it cannot identify individual changed metadata fields; no stronger claim is made. These service-side effects are explicitly retained in the JSON audit. No product, image asset or credential was permanently deleted.

## Local checks and remaining work

Lint, admin TypeScript, Worker TypeScript, static Next build and integration guard tests passed. No approved UI component, style or public storefront file was changed.

Before any further live test: diagnose/optimize the streaming upload CPU path locally, preserving validation and the $0 architecture; then obtain approval for another bounded remote upload check. Do not rely on local profiling to claim remote compliance. Only after a successful remote CPU gate should the unperformed publish → edit → unpublish lifecycle resume on this same QA item. Normal product/category writes remain disabled pending successful verification. No paid alternative was activated.

Evidence: `docs/admin-screenshots/stage2-live-tests.json`, `stage2-remote-metrics.json`, `stage2-daily-usage.json`, `stage2-free-plan.jpg`, `stage2-private-preview-desktop.jpg`, `stage2-private-preview-mobile.jpg`.
