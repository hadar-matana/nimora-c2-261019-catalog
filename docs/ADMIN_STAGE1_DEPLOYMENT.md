# Stage 1 deployment progress — 15 October 2026

**Update:** [Remote Stage 1 verification passed](ADMIN_STAGE1_REMOTE_VERIFICATION.md). Authenticated read-only access is available at https://atelier-admin.hadarmat.workers.dev/login/ with the eight-hour session default restored. Sanity writes/uploads and preview URLs remain disabled. The sections below preserve the earlier provisioning handoff.

**Initial Free provisioning and private owner/read-token provisioning succeeded. All four secret bindings were verified on 15 October 2026 at 18:32 UTC without displaying their values. Public access remains disabled; remote Stage 1 security/runtime verification is pending. The admin is not production-ready.**

## Created resources

Personal Cloudflare account `07eb45a2b5a037d1138beea811cf549b`, identity `hadarmat@gmail.com` verified before the request.

| Resource | Result |
| --- | --- |
| Worker | `atelier-admin` |
| SQLite Durable Object namespace | `atelier-admin_OwnerAuth` |
| Namespace ID | `c0793f56356f4f1c8935e181e5d4d4ea` |
| Migration | `v1`, accepted; `new_sqlite_classes: ["OwnerAuth"]` |
| Initial upload | HTTP 200, successful; exactly one request, no retry |
| Initial version | `3781ef321a454480a77d7cc73776afd5` |
| Private UI asset version | `faceb2df-0cdc-4357-bfa1-17461c8a442f` |
| Public workers.dev routing | Disabled |
| Preview routing | Disabled |
| Application remote access | Disabled |
| Sanity production writes/uploads | Disabled |

The first upload used the compiled application and auth namespace with no credentials or public routes. Following acceptance, the built static admin UI was attached to the same Worker under the previously approved Stage 1 setup. This was not a retry of the initial migration and did not create another Worker or namespace. No independent R2 bucket, Pages project, D1 database, paid service or billing upgrade was created.

The deployment response and subsequent Worker inventory both report migration `v1`; namespace inventory confirms `use_sqlite: true`. The first local acceptance predicate incorrectly expected `migration_tag` on the script-settings response. It was corrected to use the Worker-list response and reconciled through GET requests only. The Cloudflare deployment itself succeeded; no second migration attempt was made.

[Sanitized initial deployment and inventory evidence](admin-screenshots/stage1-provisioning.json).

## Free status and runtime evidence

Actual Chrome dashboard checks before and after provisioning show **Free — $0 — Current plan**. [Before](admin-screenshots/stage1-provision-free-plan.jpg) · [After](admin-screenshots/stage1-after-provision-free-plan.jpg). No billing/subscription mutation or upgrade was attempted. `usage_model: standard` alone is not used as plan evidence.

Workers Free displayed allowances remain 100,000 requests/day and 10 ms CPU per outer Worker request. The dashboard also includes SQLite Durable Object allowances. The script upload reported **19 ms startup time** and a **132.29 KiB / 36.07 KiB gzip** Worker bundle. Startup time is not request CPU, and does not prove or disprove the per-request CPU limit. No authenticated remote traffic has been generated; per-request CPU, memory, session duration and remaining usage are not yet measured. Local profiling is not remote billed CPU evidence. Persistent invocation logging was not enabled, avoiding collection of authentication/session headers during provisioning.

## Current credential blocker

**Resolved:** after the helper's successful completion, a GET-only inventory verified `OWNER_USERNAME`, `OWNER_PASSWORD_HASH`, `CREDENTIAL_VERSION` and `SANITY_API_TOKEN`, all typed `secret_text`. Personal Cloudflare identity was verified by the inventory helper. `ADMIN_REMOTE_ENABLED` and `SANITY_ALLOW_PRODUCTION_WRITES` remain `disabled`; workers.dev and previews remain disabled. No configuration was changed during this verification. The paragraphs below record the earlier missing-binding state.

After the user's provisioning-completion message, a GET-only Worker settings check showed only `ADMIN_ORIGIN`, `ADMIN_REMOTE_ENABLED`, `ASSETS`, `AUTH`, `LOCAL_COMPAT_PROOF`, `SANITY_ALLOW_PRODUCTION_WRITES` and `SANITY_MODE`. None of `OWNER_USERNAME`, `OWNER_PASSWORD_HASH`, `CREDENTIAL_VERSION` or `SANITY_API_TOKEN` was present. The helper's completion report was also absent. Secret values were not read or displayed.

Public access was therefore left disabled. Do not bypass this gate, install temporary QA credentials, use mock authentication or substitute the broad personal Sanity CLI credential.

The user needs the [private provisioning procedure](ADMIN_STAGE1_PROVISIONING.md). It explains creating a dedicated Sanity **Viewer** token and running:

```sh
cd /Users/hadarmatana/code/personal/fashion-catalog-demo
node apps/admin/scripts/provision-owner.mjs
```

All helper input is hidden; secrets are sent directly to existing Worker secret bindings. The helper validates read access and locally hashes a new owner password. It creates no additional resources or public routes. It never prints assertion details that might expose private input. Report only its final non-secret success/error message to the chat.

## Verification still required after credentials exist

- Confirm four secret binding names/types without reading values; retain production-write/upload gate.
- Activate the approved read-only Worker hostname and verify login/logout, invalid credentials, unauthenticated APIs, CSRF, write/upload rejection, session persistence/revocation/expiration and real catalog reads.
- Check actual desktop/mobile browser rendering and observe real Cloudflare request CPU/outcomes, usage and any available memory signals. Do not treat successful provisioning as runtime certification.
- Stop after Stage 1 and request separate explicit Stage 2 approval. No production Sanity write test is authorized.

The intended hostname is `https://atelier-admin.hadarmat.workers.dev`, but it is **not an available admin URL yet** because routing remains disabled. No public storefront, Sanity content, publishing webhook, account permissions or billing settings were modified. The existing approved UI design was not changed.

Local script syntax checks and admin lint passed. Application/Worker behavior is unchanged by this provisioning-only work; remote functional tests remain pending.
