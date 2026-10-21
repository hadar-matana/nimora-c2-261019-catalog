# NIMORA C2 — final approval summary

Aligned 2026-10-21. **NO-GO for provisioning. Planning approval grants no execution authority.**

Executable source: `d4277cfc0f5c6de7e1b1527fe07add16198e6062`, existing branch `codex/c1-native-namespace-contract`. A subsequent docs-only commit does not repin this source. Proposal digest: `3b722abd6143dfac1773954aecc1f82c17454eee1dc52cc0f324ef4393a836e6`.

[Resource envelope](phase-c1/proposed-resources.json), [24-step commands, verification, recovery and measurements](phase-c1/execution-checklist.csv), [full plan and cost model](PHASE_C1_PLAN.md), [verification and freshness](phase-c1/verification.json).

## Exact scope requiring separate execution approval

All names are proposed, not reserved. Personal Cloudflare account `07eb45a2b5a037d1138beea811cf549b`, Sanity organization `ovea9a4hm`, GitHub owner `hadar-matana`. No existing demo resource is an execution target.

| Resources/actions                        | Exact targets                                                                                                | Expected incremental cost                                       | Future authorization boundary / checklist                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| One public repository, two branches      | `hadar-matana/nimora-c2-261019-catalog`; `client/nimora-c2-261019`, `client/nimora-r1-261019`                | $0; no paid Actions                                             | Repository creation/push and limited Git app access, C03                                               |
| Two Sanity projects, two public datasets | `NIMORA C2 Simulation`, `NIMORA C2 Recovery`; each `catalog`                                                 | $0 only if actual Free eligibility confirmed                    | Separate creation/plan acceptance, C04–05; no demo dataset                                             |
| Two Studio apps/hosts, exact CORS        | `nimora-c2-261019-studio.sanity.studio`, `nimora-r1-261019-studio.sanity.studio`                             | Expected $0                                                     | App registrations/CORS C06; own Studio deploy C14                                                      |
| Two Pages projects/hosts                 | `nimora-c2-261019-store.pages.dev`, `nimora-r1-261019-store.pages.dev`                                       | $0 within confirmed Free allowance; max 12 total build attempts | Create/configure C08–09, bounded own builds C21–22; automatic previews/Git deploys disabled            |
| Two Workers/provider hosts               | `nimora-c2-261019-admin.hadarmat.workers.dev`, `nimora-r1-261019-admin.hadarmat.workers.dev`                 | $0 within Free request/CPU caps                                 | Deploy C10–11, own hostname/remote gate C14; writes initially disabled                                 |
| Two independent SQLite DO namespaces     | `nimora-c2-261019-admin_OwnerAuth`, `nimora-r1-261019-admin_OwnerAuth`                                       | $0 conditional Free usage                                       | Own Worker migrations only C10–11; observe/bind C12, no invented IDs                                   |
| Primary publishing only                  | `nimora-c2-261019-publish`; `nimora-c2-261019-published-to-pages`; exact primary branch/catalog              | $0 within build/request cap                                     | Create disabled C21; separate activation and one test publish C22; recovery has no hooks               |
| Client-only credentials                  | Two owner credentials, two editor and two viewer robot tokens, two backup keys, one private audit key        | Expected $0; actual roles must be verified                      | Explicit new-client credential/escrow approval C13; no production rotation; no frontend secrets        |
| Synthetic data, backup and restore       | 100 products, 400 accepted originals; primary About/options; isolated recovery import                        | Cloud $0 conditional; images below                              | Separate canary/write/upload/import approvals C15–20; final publish/lockdown C22                       |
| Private local/offsite backup             | Per-client paths/key identifiers in proposal; existing encrypted removable medium, >=10 GiB each destination | $0 only using existing owned storage                            | Confirm canonical offsite path/custodian C00/C13, export/copy/key recovery C18; no new storage account |

## Build and namespace gates

Build static admin assets with **`ADMIN_LOCAL_PROOF=1 pnpm build:admin`**, under the exact generated public client variables. Scan output before any separately approved Worker deployment. `0` selects the wrong dynamic output for this architecture. Other builds: `pnpm build:studio`, `pnpm build:storefront`.

Native namespace labels must equal exactly `worker.name + "_OwnerAuth"`; AUTH binding, OwnerAuth class, Worker/script, account and provider-observed namespace ID must all agree. Binding requires a verified admin journal entry, independent provider lookup/verification and re-verification of prior journal resources. Null-to-observed-ID is the only permitted assignment. No alias or UUID generation.

Both actual proposal clones pass local dry-run/registry checks with **in-memory synthetic observations**; 21 negative checks and five namespace regression groups pass. Zero cloud calls or creates occurred in these tests. This proves the schema, not live isolation. All actual Sanity project IDs, Studio app IDs, namespace IDs and primary hook IDs remain **null/unresolved**; no executable manifest exists yet.

## Quotas, costs and timing

Public Pages Free documentation was rechecked: **500 builds/month**, one concurrent build and 100 projects. The exact account remaining-build meter is **unverified**; Workers build minutes and deployment-history counts are not substitutes. [Pages limits](https://developers.cloudflare.com/pages/platform/limits/).

Public Sanity Free remains $0, with two public datasets and up to 20 human seats. The organization dashboard shows one existing Growth Trial demo project. New-project Free assignment/creation capacity and numeric organization project limit remain **unverified** until an approved bootstrap; no project was created to test them. [Sanity pricing](https://www.sanity.io/pricing).

Cloudflare existing-token GET returned HTTP 401 on 2026-10-21; no credential refresh/change was attempted. Dashboard access confirms Workers Free ($0) and identifies the personal account and only the existing demo Pages/Worker. The Pages dashboard also confirms approved production commit `e33d95253f249ba401c9affb70716dab0a812f2a` and deployment `1c7661d6-af46-44fd-ae3d-d82875babe8f`. Detailed 2026-10-19 counters in the full plan are historical. Fresh authenticated baseline checks are required before execution; no paid upgrade is authorized.

**Proposed cash ceiling, not spending authorization:** $0 new recurring cloud charges plus at most **$25 total one-time images**, inclusive of tax/minimum purchase, only after a verified quote and terms. Public reference $0.04/image gives $16 for 400 accepted images, $19.20 at 480 maximum attempts before tax. Existing image account/credits/minimum purchase are unverified. If price, entitlement or storage cannot fit this ceiling, stop and requote; no auto-topup, subscription, paid plan or new storage purchase.

| Retention | Expected cloud charges     | Image usage once, before tax | Proposed total cash ceiling |
| --------- | -------------------------- | ---------------------------- | --------------------------- |
| 1 week    | $0 conditional Free limits | $16–$19.20                   | $25, using existing storage |
| 1 month   | $0 conditional Free limits | $16–$19.20                   | $25, using existing storage |
| 3 months  | $0 conditional Free limits | $16–$19.20                   | $25, using existing storage |

C2 estimated active work **13h55m–24h35m**; serialized system waits **91–506 min**, partly overlapping. Completed namespace engineering is excluded. No labor rate, guaranteed provider processing time or future bill is implied.

## Minimum outstanding decisions and stop gates

1. Accept exact two-stack scope, names, public repository visibility, source/digest and mutation sequence above; approval must explicitly authorize execution, separately from this planning task.
2. Choose/approve image provider, rights/terms and verified all-in quote within $25, or a licensed zero-cost alternative. No demo images, generated images or account creation are authorized now.
3. Confirm existing encrypted offsite medium, >=10 GiB capacity and canonical path. Confirm an approved password manager, recovery custodian and independent key recovery; keys must not share archive media. No new storage spend is included.
4. Select 7/30/90-day retention. Current manifests specify **30 days, keepLast=2**; another choice requires revising/re-digesting the proposal before approval. Offsite retains at least one verified capture. Deletion is a separate approval, never an automatic rollback.
5. Restore read access and reverify production baseline/quotas immediately before C2. Confirm actual Free eligibility before accepting new-project creation; stop at billing/plan/access uncertainty.

Order: approval/preflight → image rights/assets → isolated repo → separate CMS/Studio bootstrap → materialize real IDs → own Pages/admin deployment closed → observe/bind namespaces → unique secrets/escrow → read/auth negatives → separately approved canary/data entry → quiesced backup/offsite/key test → separately approved recovery import → live isolation → primary-only publishing test → lockdown/retention handoff.

**NO-GO to create resources now.** No purchase, deployment, credential creation, CMS write/import/restore, hook invocation or C2 action is authorized by this package. Existing ATELIER production must remain at `e33d95253f249ba401c9affb70716dab0a812f2a` with its approved admin baseline.
