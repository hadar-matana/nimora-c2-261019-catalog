# Catalog options — controlled live rollout

Completed 16 October 2026, under the user's bounded rollout approval.

Live screen: https://atelier-admin.hadarmat.workers.dev/categories/

## Deployment

Existing Worker `atelier-admin`, version **2593bee7-fdb2-41ca-81d2-26c0e0e3e7f1**. Tested static admin and Worker API deployed together. Existing SQLite authentication DO and four secret_text bindings retained; no migration, additional resources, credentials, billing changes or paid upgrades. Personal Cloudflare and Sanity identity verified. Cloudflare dashboard showed **Free — $0 — Current plan** before and after rollout.

The live navigation now exposes **אפשרויות הקטלוג**, with categories, sizes and colors. The product editor shows reusable choices and can add new size/color values. Product save/publish semantics and the 2 MiB fixed-length upload restriction are unchanged. Studio was not deployed; its prepared schema source is independent of the admin runtime.

Before deployment: admin lint, Worker typecheck, focused options contract tests, nine security guard groups and production static build passed. The preceding local implementation had passed all 19 isolated lifecycle scenarios and responsive browser QA.

## Bounded live test results

| Check | Result |
|---|---|
| Owner authentication and persistent session | Passed, session survived deployment and admin reloads |
| Dedicated deployed credential | Existing dedicated Sanity project Editor metadata verified; actual singleton create/update succeeded through deployed API |
| Add one temporary size and color | Passed |
| Editor visibility | Both appeared unselected in the new-product editor; no product fields were edited or saved |
| Reload persistence | Both still appeared after full editor reload |
| Case/whitespace duplicates | Passed; same choices returned and singleton `_rev` did not change |
| Anonymous options reads/writes | 401 |
| Invalid CSRF or Origin | 403 |
| Forbidden `siteSettings` kind | 400, no mutation |
| General settings mutation route | 405, unavailable even with valid owner session/CSRF |
| Rename temporary options only | Passed, original list entries unchanged |
| Remove temporary options only | Passed, original lists restored exactly |
| Product/category preservation | All **72 pre-existing document hashes unchanged**, including product sizes/colors/category references, retained QA draft and image assets |
| QA unpublished | Confirmed; no publish/edit/unpublish operation performed |
| Webhook configuration | Hash unchanged |
| Webhook delivery / Pages builds | Zero new attempts and zero builds observed in two test-window checks; existing rule excludes `catalogOptions` |
| Desktop/mobile | Live desktop 1440×900 and mobile 390×844 rendered; mobile editor document width 390 px, no horizontal overflow |
| Cleanup | Temporary options removed, private verifier session revoked/file removed, temporary trace connection removed |

One singleton was created: **`atelier-admin-catalog-options`**, type **`catalogOptions`**. No other Sanity document changed and no image assets were created. Six real mutations were performed: two additions, two renames, two removals. The two duplicate-add probes were idempotent and did not mutate Sanity.

Temporary labels (now absent):

- Size `ATELIER QA SIZE 1016-23b65332`, renamed to `ATELIER QA SIZE R 1016-23b65332`.
- Color `ATELIER QA COLOR 1016-23b65332`, renamed to `ATELIER QA COLOR R 1016-23b65332`.

Final real lists retained exactly:

- Sizes: XS, S, M, L, XL, 36, 38, 40, 42, One size.
- Colors: שחור, לבן, שמנת, חום, אפור, זית.

Existing product-only custom values are untouched; the reusable list does not automatically import them or replace them on products.

## Webhook behavior

The top-level webhook `filter` is null, but its effective rule has the following filter:

```groq
(_type in ["product","galleryImage","category","collection","siteSettings"] || before()._type in ["product","galleryImage","category","collection","siteSettings"])
```

`catalogOptions` is excluded. Its list changes therefore do not require or trigger storefront rebuilds in this test. No webhook rule, URL, secret or storefront code was modified. Later authorized product saves remain product mutations using the existing publishing path; no live product save was repeated during this rollout.

## Remote runtime and Free observations

- Temporary trace-v1 capture: **26 API request samples**, including 21 catalog-options requests; CPU **0–5 ms**, zero exceptions, all captured outcomes `ok`.
- Eight successful catalog-options POST samples (six mutations plus two duplicate probes): **3, 2, 1, 1, 2, 2, 2, 2 ms CPU**. Their wall time includes Sanity/network waiting and is not CPU time.
- Sampled GraphQL test-window snapshot: **104 Worker requests**, zero errors, maximum reported bucket CPU p99 **5.285 ms**, maximum memory p99 **4.630 MiB**. Per-request memory was not exposed in the trace stream.
- Durable Object snapshot for the window: 104 requests, 0.354 GB-s duration, 293 rows read / 2 written; zero exceeded CPU/memory or fatal errors.
- Daily snapshot: 650 Worker requests, 550 DO requests, 1.374 GB-s DO duration, 946 rows read / 29 written; zero errors. This is far below the displayed Free daily allowances (100,000 requests each, 13,000 GB-s DO duration, 5 million SQL rows read and 100,000 written).
- Storage analytics returned no rows: actual stored bytes are unmeasured, not zero. Analytics are sampled/delayed and the test window includes reads/security probes, not only mutations. Trace capture is incomplete relative to all traffic. Results support this bounded use; they do not certify future peak traffic, maximum-sized lists or concurrency.
- Wrangler reported 17 ms Worker startup time during deployment. This is deployment initialization telemetry, not the per-request CPU measurements above.

No observed security, compatibility or Free-plan blocker required rollback. No payments or additional services were enabled.

## Remaining limits

Up to 100 reusable sizes and 100 colors; size labels 40 characters, color labels 80. Existing product limits remain 20 sizes / 30 colors. Sizes/colors stay optional. Rename/removal changes the reusable list only, never existing products. Conflicting concurrent changes return 409; refresh before retrying. Unknown color names use the existing neutral fallback swatch, with no new hex/color metadata model.

The Studio schema source is prepared but the Studio application was not separately deployed as part of this admin-only rollout. No live product mutation/selection save was performed; its integration semantics retain the prior local regression coverage. Ongoing remote load and maximum-list CPU headroom remain unverified. Existing emergency write-disable instructions in `ADMIN_STAGE2_ACTIVATION.md` apply to the new API too.

## Evidence

- `docs/admin-screenshots/catalog-options-rollout-tests.json`: bounded operations, original lists, preservation audit and observations (sanitized).
- `catalog-options-rollout-tail.json`: request CPU samples and debugger cleanup.
- `catalog-options-rollout-metrics.json`, `catalog-options-rollout-daily-usage.json`: sampled runtime/quota snapshots.
- `catalog-options-rollout-desktop.jpg`, `catalog-options-rollout-mobile.jpg`, `catalog-options-rollout-editor-mobile.jpg`, `catalog-options-rollout-free.jpg`: live browser proof.
