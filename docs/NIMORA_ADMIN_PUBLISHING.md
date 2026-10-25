# Owner product editing and storefront publishing

Product saves use the authenticated same-origin Admin API, CSRF tokens and
optimistic Sanity revision checks. An Editor robot token is server-side only.
`ADMIN_CONTENT_SCOPE=products` permits product and image operations and denies
other content mutations. QA switches remain off.

Publishing is opt-in per environment. The operator independently verifies the
Cloudflare account, Pages project and production branch before installing its
dedicated deploy-hook capability as a Worker secret. The runtime validates the
exact HTTPS provider URL and hook ID, CMS identity and Pages hostname. Ordinary
Git deployments and branch previews can remain disabled.

Published saves/unpublishing prepare durable work before the CMS transaction.
A separate named instance in the existing AUTH namespace debounces requests and
serializes builds. Draft saves and uploads alone never enqueue publication.
The public build marker fingerprints published content revisions only. Builds
check the fingerprint before and after static export and refuse a stale marker
if content changed during the build. Static export cleanup remains mandatory.
Set `STOREFRONT_PUBLICATION_TRACKING=approved` in the corresponding Pages build.

Admin shows queued, building, live or failure status. A saved CMS change is not
lost if deployment fails. Network-uncertain hook calls are not automatically
repeated; the owner can explicitly retry from Admin. A build not reflected in the
public marker within ten minutes is reported as failed/timed out. Later edits
coalesce into a follow-up build after an active deployment. The prepare window
also reconciles an interrupted CMS response without replaying the mutation.

This workflow uses the existing Workers/Durable Objects and Pages Git build
service. It consumes the account's normal request/storage/build allowance;
Free-plan quotas still apply. No paid features, additional namespaces, browser
CMS tokens or publishing credentials in frontend builds are required.

Run `pnpm --filter admin test:publishing`, the existing security/contract tests,
lint, type checks and client-configured builds before enabling an environment.
