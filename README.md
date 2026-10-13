# Fashion Catalog Demo

Reusable Hebrew/RTL fashion gallery and product catalog demo for independent boutiques.

## Architecture

- `apps/storefront`: Next.js App Router storefront, static export, React, TypeScript and Tailwind CSS.
- `apps/studio`: Sanity Studio connected to project `3ahm0828` and dataset `production`.
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
- `docs/DEPLOYMENT.md`: Cloudflare/Sanity deployment workflow.
- `docs/NEW_CLIENT_SETUP.md`: how to reuse for another boutique.
- `docs/IMAGE_SOURCES.md`: demo image sources and replacement guidance.
- `docs/LAUNCH_CHECKLIST.md`: verified and pending launch items.
