# Fashion Catalog Demo

Reusable Hebrew/RTL fashion gallery and product catalog demo for independent boutiques.

## Architecture

- `apps/storefront`: Next.js App Router storefront, static export, React, TypeScript and Tailwind CSS.
- `apps/studio`: Sanity Studio connected to project `3ahm0828` and dataset `production`.
- `apps/admin`: separate Hebrew/RTL administration UI, local Phase B mock preview only. Run `pnpm dev:admin` and use `atelier` / `demo123` at `http://127.0.0.1:3001`. Do not deploy this prototype or enter real credentials. See `apps/admin/README.md`.
- Content source of truth: Sanity Content Lake.
- Hosting target: Cloudflare Pages static site.

## Setup

```bash
pnpm install
pnpm seed
pnpm dev
```

Run the Studio locally:

```bash
pnpm dev:studio
```

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm build
```

The storefront static export is generated at:

```text
apps/storefront/out
```

## Environment

See:

- `apps/storefront/.env.example`
- `apps/studio/.env.example`

Public Sanity project IDs are safe to expose. Do not commit write tokens, deploy hook URLs or credentials.

## Deployment

Cloudflare Pages should build from the repository root:

- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build:storefront`
- Output directory: `apps/storefront/out`

Deploy Sanity Studio with:

```bash
pnpm studio:deploy
```

More detail is in `docs/DEPLOYMENT.md`.

## Documentation

- `docs/ADMIN_GUIDE.md`: Hebrew guide for store owners.
- `docs/ADMIN_PHASE_B_QA.md`: local mock admin handoff, checks and screenshot comparison.
- `docs/DEPLOYMENT.md`: Cloudflare/Sanity deployment workflow.
- `docs/NEW_CLIENT_SETUP.md`: how to reuse for another boutique.
- `docs/IMAGE_SOURCES.md`: demo image sources and replacement guidance.
- `docs/LAUNCH_CHECKLIST.md`: verified and pending launch items.

Local real-auth compatibility proof: [results, blockers and preview instructions](docs/ADMIN_LOCAL_PROOF.md). This is loopback-only and read-only for the existing Sanity catalog; no deployment is approved.

[Final non-billable entitlement and runtime verification](docs/ADMIN_FINAL_VERIFICATION.md): Free SQLite support is consistent with available evidence; production deployment remains unapproved and CPU/migration acceptance are not certified.

Current admin handoff: [local real-data integration, preview instructions, test evidence and minimal launch gate](docs/ADMIN_INTEGRATION.md). This supersedes the earlier proof instructions. Production mutations and deployment still require explicit approval.

[Authorized bounded real-Sanity QA results](docs/ADMIN_LIVE_SANITY_QA.md): uploads, native draft/private preview, publish/edit, existing Pages webhook builds and final public removal verified. The single QA product remains unpublished as a recoverable draft; no admin deployment was performed.

[Stage 1 deployment progress](docs/ADMIN_STAGE1_DEPLOYMENT.md): the approved private Worker/SQLite migration succeeded on Free. Public activation and remote tests await [private owner/read-token provisioning](docs/ADMIN_STAGE1_PROVISIONING.md). Stage 2 writes remain disabled.

[Remote Stage 1 verification](docs/ADMIN_STAGE1_REMOTE_VERIFICATION.md): authenticated read-only admin is available at https://atelier-admin.hadarmat.workers.dev/login/. Remote auth/session/security, real catalog reads and Chrome desktop/mobile checks passed; actual Free-tier CPU/memory/usage evidence is recorded. Stage 2 mutations/uploads remain disabled pending separate approval.
