# Phase B — local preparation report

Branch: `codex/phase-b-provisioning-backup-isolation`, derived directly from Phase A `9539ed6f4c85a5e93ce1455ebae4b0b4ab46045b`. Local implementation, tests and procedures verified; cloud provisioning/restore/activation intentionally not executed. Local commits are listed with `git log --oneline codex/phase-a-client-configuration..HEAD`; no push or merge was performed. Main remains `e33d95253f249ba401c9affb70716dab0a812f2a`.

## Deliverables

- `apps/admin/tools/client/manifest.ts`: exact secret-free manifest schema, shared Phase A CMS/brand validators, reserved/demo/duplicate/inconsistent target rejection and action/account/resource/digest confirmation. [Intentionally invalid template](phase-b/client-manifest.template.json). No actual client manifest/registry created.
- `provision.ts` / `cli.ts`: explicit validate, nine-step dry-run plan, private no-overwrite configuration generation, disabled Worker writes/remote gate and automatic client Pages deployments/previews. Live apply/deploy/activate are refused. Dependency-injected uncertain-operation recovery and observed namespace rebind are tested without a cloud adapter.
- `backup.ts` / `backup_archive.py`: native export plus independent full content/count/original-asset validation, allowlisted resource/Worker config, checksums, AES-256-GCM private archives, verified local recovery, lost-registry inspection, retention plan without deletion and guarded isolated restore planning. The only cloud-capable backup command is read/export; it has not been run against live data.
- Actual existing Worker auth/session/Origin/CSRF and CMS-target isolation tests under mocked storage/network, credential HMAC and native hook-observation checks. [Live checklist](PHASE_B_ISOLATION.md) separates attestation from proof.
- [Provisioning commands](PHASE_B_PROVISIONING.md), [backup/recovery procedures](PHASE_B_BACKUP_RECOVERY.md), [future simulation steps and per-step estimates](PHASE_B_SIMULATION_PLAN.md), [blank measurement template](phase-b/simulation-measurements.template.csv), [verification evidence](phase-b/verification-results.json).

No application UI, storefront, Studio, Worker runtime source, lockfile or dependencies changed. Existing UI test screenshot destination gained an optional environment override to preserve old evidence. Native TypeScript imports are enabled for the operator tooling; no new packages are required.

## Verification

| Check                                                                  | Result                                                                                                                           |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Root lint and typecheck (storefront + Studio)                          | Pass                                                                                                                             |
| Admin lint, typecheck, Worker typecheck                                | Pass                                                                                                                             |
| Storefront build                                                       | Pass, 21 generated routes, explicit demo public CMS variables                                                                    |
| Studio build                                                           | Pass, explicit demo variables                                                                                                    |
| Admin build                                                            | Pass; two fake private sentinel values absent from browser output                                                                |
| Existing config/brand render regressions                               | Pass                                                                                                                             |
| Existing About/render/catalog options/write/security contracts         | Pass                                                                                                                             |
| Existing mock-auth regression                                          | 4/4 pass                                                                                                                         |
| New provisioning/negative/backup/recovery/security/CLI suite           | 15/15 pass; latest measured suite duration 1,283.724625 ms                                                                       |
| Native backup/local restore fixture                                    | Full source content/counts/originals validated; wrong key, corruption, traversal, missing assets, secrets and overwrite rejected |
| Dry-run                                                                | 9 operations, 0 cloud mutations, own CMS/Pages/Worker/Studio targets, previews and writes disabled                               |
| Existing browser screenshot/local-workerd integration/streaming suites | Not rerun in this phase; existing evidence preserved. Targeted existing regressions and actual Worker/CMS tests above passed     |

The fixture restore uses a mocked destination and tiny locally constructed native-format archive. No live Sanity native import, full-size export, real browser cross-client cookie test, provider scope enforcement or cloud failure recovery is claimed. No simulation environment or 100-product import was created.

## Production and preserved work

At 2026-10-18 12:51:06.812 UTC, authenticated GET comparisons against the saved baseline confirmed approved storefront production deployment `1c7661d6-af46-44fd-ae3d-d82875babe8f` at `e33d95253f249ba401c9affb70716dab0a812f2a`, admin Worker version `252a65f1-29b4-4801-9af9-0fadb5286505`, Worker settings/inventory/namespaces, Pages source/build/production variables, and Sanity project/datasets/hooks/all 73 documents unchanged.

Final checks at 2026-10-19 07:50:50.941 UTC: Sanity project/datasets/hooks and all 73 document contents still match the baseline. Public home, About, catalog and gallery HTML are byte-identical to that approved immutable Pages deployment; admin login returns HTTP 200. Existing Cloudflare credential returned HTTP 403, so the final authenticated Pages commit/Worker version/settings/namespace check is **unresolved**; credentials were not refreshed or changed. Public HTML equivalence is not a fresh control-plane commit/version assertion. No cloud write, deployment, retry/cancel, CMS edit, credential rotation, domain/resource creation or billing change was performed by Phase B. Main and the Phase A branch were not modified.

The pre-existing 212 untracked QA/evidence files remain locally and are excluded from the Phase B commit. Original readiness audit is unavailable; it was not reconstructed. Its absence does not prevent testing the current source/configuration and preparing tooling, but historical conclusions cannot be attributed to it. The Phase A report/configuration guide remain available and unchanged.

## Remaining gates before the timed simulation

1. Restore authenticated read access by an independently authorized operator and recheck production/admin baseline; no automatic token refresh or replacement was attempted.
2. Approve concrete personal account, new resource identities, exact source revision, budget and registry; revalidate native commands/provider API payloads/plan entitlement before each write. Provisioning execution is manual and reviewed; no live apply adapter is supplied or certified.
3. Perform live provider identity/binding/credential-scope, DNS/TLS, actual cross-client session/CSRF/CMS/upload/hook tests. Attestation validation alone does not authorize activation. Registry serialization/locking is operational, not distributed.
4. Choose private offsite storage and independently escrow keys, then authorize and measure a true native isolated restore. Large export bounds, exporter normalization/system exclusions, crash plaintext cleanup, native import transformations, offsite retention and real RPO/RTO need live verification. DO sessions/secrets are deliberately excluded from backups and require recreation/fresh login.
5. Follow the simulation plan: scope/identity → independent CMS → Pages → Worker/DO/private credentials → brand/About → prepare photos → enter/review ten products then remaining 90 → validated backup/isolated restore → isolation → separately approved client-only publish. No activation until all gates pass.

Forecast is **8.5–18 active human hours**, with per-step processing and cost bases in the simulation plan. Marginal provider charges could be $0 only within verified available free entitlements; no plan/seat/domain/offsite entitlement was assumed and actual charges were not measured. Labor cost is hours × the user's chosen rate. No 100-product performance result or provider-cost certification is claimed.

Actual active engineering time was not instrumented across interrupted sessions. Work started 2026-10-18 and resumed 2026-10-19; overnight wall-clock elapsed time is not labor. Only measured test duration is reported, without inventing billable time.
