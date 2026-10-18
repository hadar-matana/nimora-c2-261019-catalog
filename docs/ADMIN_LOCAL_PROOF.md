# ATELIER admin — local compatibility proof

2026-10-14. The single-store direction in `ADMIN_MVP_PLAN.md` is approved, subject to the user's hard $0 additional recurring cost requirement and separate deployment approval. **Local functional checks pass; the $0 launch gate remains blocked.** Nothing was deployed, provisioned or upgraded. No Sanity mutation, asset upload, storefront change or webhook change was made.

## Results and their limits

| Check | Actual result |
|---|---|
| Static Next.js 16.4 export | All admin screens export successfully; query-based edit screen uses Suspense. Worker asset binding serves the export. |
| Real runtime | Wrangler 4.150.0 / local `workerd`, SQLite-backed Durable Object. Compatibility date is 2026-10-13: this installed binary rejected 2026-10-14. This was a local configuration correction. |
| Server password verification | bcryptjs cost 12; randomly generated temporary local account; exact password bytes, username trim/case normalization. Wrong password and trailing password space rejected. Inputs over bcrypt's 72-byte limit rejected before hashing. |
| Password CPU sampling | Three verifications: request elapsed 243 / 230 / 225 ms. V8 inspector sampled 655.873 ms in bcrypt stacks total, about 218.6 ms each. These are local samples, **not Cloudflare billed CPU**. Password work occurs inside the DO, whose documented default CPU limit is 30 seconds. |
| Session persistence | Secure, HttpOnly, SameSite=Lax, host-only cookie accepted in real Chrome on loopback. Refresh and complete runtime restart retain the session using the same local SQLite state. |
| Session policy | Logout revokes the token; credential-version rotation invalidates old sessions. Expiry rejects a session in the real runtime using a 1.2-second local test TTL and the same expiry condition used by the default eight-hour policy. Eight hours were not waited out. |
| Authorization and CSRF | Unauthenticated API 401; protected HTML redirect, including `/index.html`, product HTML and static route payload paths. Tampered session rejected. Wrong origin rejected; missing CSRF rejected on mutations/logout. Login bodies above 2048 bytes rejected with 413 for both declared and chunked delivery. Client flags do not authorize requests. |
| Rate limits | Five failed attempts per IP / 15 minutes, twenty per owner / 15 minutes, checked atomically before hashing. Six concurrent failed attempts produced five 401s and one 429. Counters include successful attempts too. |
| Upload transport and local limits | A real PNG transfers byte-for-byte to a loopback fixture. Exactly 10 MiB transport accepted; larger bodies rejected with 413 both with Content-Length and chunked delivery. Unsupported MIME and mismatched signatures rejected with 415; unauthorized/CSRF requests never reach the fixture. The maximum-size transport fixture is deliberately not an image-decoding test. |
| Existing Sanity reads | Real read-only request via Worker returns 12 published products / 5 categories; no draft IDs. No Sanity token is loaded by the proof. |
| Browser | Real Chrome: invalid Hebrew login error, successful dashboard redirect, catalog, refresh/restart persistence, logout returning to login, desktop and 390 × 844 mobile layout; editor save correctly shows the blocked-write error without success or navigation. Existing CSS/design retained. |
| Checks | Lint, UI typecheck, Worker typecheck, mock-auth regression tests, default build and static proof build. Exported text assets also pass a scan for the local account password, hash and username. See captured JSON evidence and screenshots below. |

## Hard blockers before launch

Follow-up: see [final non-billable verification](ADMIN_FINAL_VERIFICATION.md) for the owner’s dashboard evidence, renewed GET-only entitlement checks, isolated CPU results and the identified Wrangler proxy cancellation limitation. The findings below are the earlier proof baseline; the follow-up refines their interpretation.

1. **Account entitlement is unverified.** The read-only subscription lookup recorded in the approved plan returned HTTP 403. `default_usage_model: standard` is not a Free subscription check. There is no verified evidence yet that this account can create the Worker and SQLite DO with no paid upgrade, or of its remaining quota. The user must confirm Workers Free and SQLite DO Free eligibility in the personal Cloudflare dashboard before any resources are provisioned. Stop if that dashboard requires a paid plan. Sanity's actual current Free subscription and available asset/API quota must also be confirmed without an upgrade.
2. **Outer Worker upload CPU is not qualified.** Local shared-isolate profiling showed 26.9–30.6 ms of sampled non-idle activity per 10 MiB upload, including session validation and runtime overhead; the refined run showed 7.3 ms in JavaScript frames per upload. Session requests sampled about 7.4–9.6 ms total, also including DO work. These figures cannot be assigned to the outer Worker or equated to billed CPU. They nevertheless provide insufficient margin/evidence to promise reliable operation under the outer Worker's documented 10 ms Free limit. A bounded streaming implementation or another explicitly reviewed $0 approach, followed by separate runtime measurements, is required before claiming success. No paid alternative was enabled.
3. **Live Sanity uploads and private draft writes are untested.** A local HTTP fixture proves request transport and boundary checks, not Sanity authentication, asset decoding/acceptance, CDN visibility, quotas or draft/publish behavior. Those tests require separately authorized disposable content/asset writes to the existing project and a server-only write credential. The local proof contains neither that credential nor an enabled production upload/mutation route. Draft asset URLs remain public as accepted by the user; this proof does not change that limitation.
4. **Full CRUD integration and production security review remain.** The proof adapter exposes authenticated published reads, with product/category writes intentionally blocked. The default Phase B adapter retains its existing mock workflows. The complete real draft/save/publish/unpublish adapter, optimistic revision handling, reference-aware unpublish checks (existing galleries contain strong product references), upload error handling and webhook behavior must be tested before release. This is a compatibility prototype, not a finished deployable MVP or a security audit certification.

The local emulator does not enforce/measure the account's remote billable CPU or daily allowances. Therefore the overall compatibility/$0 gate is **not fully passed**. Deployment must wait for resolution of all gates and explicit user approval; approval of the architecture is not deployment approval.

Current official limits: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/), [DO Free pricing and limits](https://developers.cloudflare.com/durable-objects/platform/pricing/). Remote allowance exhaustion on Free must be handled as an error, never as a trigger for an automatic paid upgrade.

## Local preview

From the repository root:

```sh
pnpm --filter admin build:proof
pnpm --filter admin provision:local
pnpm --filter admin dev:proof
```

Use `http://127.0.0.1:3002/login/` (the configured same origin). The provisioning prompt chooses a local username and generates a random temporary password, printed once to the operator. Only the salted hash, username and credential version go into ignored `apps/admin/worker/.dev.vars`, created with private permissions. This does not set remote Cloudflare secrets. Never use a password from another service. Restart the local Worker after provisioning. The proof is locked to loopback in both server binding and application code; no deployment script exists, workers.dev and preview URLs are disabled.

The proof UI reads the existing published catalog and shows a read-only proof banner in the existing banner slot. Saving/publishing/category edits report an error instead of changing real data or showing false success. Editor-selected images remain local previews during this stage. Real upload transport tests use `/api/uploads` directly, not the editor's Phase B FileReader workflow. Without the fixture, authenticated upload requests fail closed with 503. The original mock demo remains available through `pnpm --filter admin dev` on port 3001.

## Reproduce automated runtime checks

The proof servers were stopped after QA and the temporary plaintext test account/session files were removed. Provision a new local account for preview.

These tests use private temporary account/session files under `/private/tmp`, ignored local `.dev.vars` and `.wrangler/proof-state`. They never contain a real production credential. Start from a clean disposable local proof state, or allow the persisted 15-minute attempt window to expire before rerunning login-heavy tests. Fixture statistics are per fixture process.

```sh
# Terminal 1, root: prepares local test secrets and starts fixture on 3003
node apps/admin/tests/proof-fixture.mjs
# Terminal 2: after build:proof, starts Worker on 3002
pnpm --filter admin dev:proof
# Terminal 3:
node apps/admin/tests/proof-http.mjs
node apps/admin/tests/proof-assets.mjs
node apps/admin/tests/proof-profile.mjs
node apps/admin/tests/proof-profile-requests.mjs
# Stop Terminal 2 before this test; it manages local restarts and restores secrets
node apps/admin/tests/proof-session-policy.mjs
```

The tests use the inspector listener at loopback port 9229. CPU scripts reuse Wrangler's installed WebSocket dependency. Raw profiles containing source are not written or transmitted; recorded artifacts contain only summary measurements. The fixture's success is never described as a real Sanity upload.

## Evidence

- `admin-screenshots/local-proof-http.json`: HTTP checks and bcrypt elapsed time.
- `admin-screenshots/local-proof-profile.json`: password CPU sampling.
- `admin-screenshots/local-proof-request-profile.json`: session/upload sampling and qualifications.
- `admin-screenshots/local-proof-session-policy.json`: expiry, rotation, restart, revocation and concurrency checks.
- `admin-screenshots/local-proof-chrome-desktop.jpg`, `local-proof-chrome-mobile.jpg`: approved UI with existing real published products.

## Implementation files

New backend/runtime files are `apps/admin/worker/index.ts`, `wrangler.local.jsonc`, and `tsconfig.json`. New UI adapter files are `src/components/AdminContext.tsx` and `ApiProofProvider.tsx`; existing screens now consume the shared context. The root layout, Next config, login, Shell, query-based edit page, editor error handling and category error handling were adapted without CSS/design changes. `MockProvider` keeps the Phase B behavior. Added `scripts/provision-local.mjs`, `tests/proof-*.mjs`, package scripts/dependencies, local-secret ignore rules, this report and captured evidence. No storefront, Studio schema or webhook source changed.

## Exact next steps

1. User confirms the personal Cloudflare account's Free Worker/SQLite DO eligibility and existing Sanity Free quotas. No paid plan, subscription or new project.
2. Resolve the outer Worker upload CPU uncertainty locally; keep 10 MiB support only if there is defensible margin. Present any necessary architecture/limit change for review rather than silently altering the approved requirement or using paid services.
3. Finish real CRUD/draft adapters and add server-side schemas, revision checks, strong-reference handling and upload mapping while preserving the UI. Test against a local Sanity-shaped fixture first.
4. Obtain explicit approval for a narrowly scoped live Sanity smoke test using disposable test content and an operator-provisioned server-only token. Verify actual uploads, private drafts, publishing and the unchanged webhook without editing existing product content.
5. Repeat security/lifecycle/browser checks and present results plus a concrete deployment configuration. Request explicit approval for resource creation/deployment only after the above pass. Required configuration would be one Worker with static assets and worker-first guards, one SQLite DO binding/migration, server-only account hash/credential-version/Sanity token secrets, HTTPS cookie origin and fail-closed Free usage limits. The production configuration must also set an approved HTTPS same origin, enable a separately approved public hostname, deliberately replace the loopback-only guard and read-only proof adapter, and exclude fixture/profiling/test-TTL controls. Keep the mock build unavailable remotely. No R2, PostgreSQL, extra Sanity project, purchased domain or paid plan.
6. Only after separate approval, provision/deploy and confirm remote billed CPU/Free quota behavior under a limited protected test before owner use. Any failed $0 gate stops launch; it does not authorize an upgrade.
