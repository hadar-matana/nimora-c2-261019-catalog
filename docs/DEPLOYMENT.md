# Deployment

## Accounts

This is a personal project. GitHub operations must use:

```bash
GH_CONFIG_DIR="$HOME/.config/gh-personal" gh <command>
```

Expected Git remote:

```bash
git@github-personal:hadar-matana/fashion-catalog-demo.git
```

Sanity project:

- Project ID: `3ahm0828`
- Dataset: `production`

Cloudflare account:

- Account ID: `07eb45a2b5a037d1138beea811cf549b`

## Local Build

```bash
pnpm install
pnpm seed
pnpm lint
pnpm typecheck
pnpm build
```

The storefront is a Next.js static export. The generated public output is:

```text
apps/storefront/out
```

## Cloudflare Pages

Recommended project name:

```text
fashion-catalog-demo
```

Build settings:

- Framework preset: None / custom
- Root directory: repository root
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build:storefront`
- Output directory: `apps/storefront/out`
- Node version: `22`

Environment variables:

```text
NEXT_PUBLIC_SANITY_PROJECT_ID=3ahm0828
NEXT_PUBLIC_SANITY_DATASET=production
NEXT_PUBLIC_SANITY_API_VERSION=2025-02-19
NEXT_PUBLIC_SITE_URL=https://fashion-catalog-demo.pages.dev
NEXT_PUBLIC_STUDIO_URL=https://fashion-catalog-demo.sanity.studio
```

Do not commit deploy hook URLs or tokens.

## Sanity Studio

Deploy from the repository root:

```bash
pnpm studio:deploy
```

Use the hosted Studio URL returned by Sanity. The intended hostname is:

```text
https://fashion-catalog-demo.sanity.studio
```

## Publishing Webhook

The intended publishing flow is:

1. Content is published, unpublished or deleted in Sanity.
2. A Sanity webhook calls the Cloudflare Pages deploy hook.
3. Cloudflare rebuilds the static storefront.
4. The new published content appears on the public site.

Configure the Sanity webhook after creating a Cloudflare Pages deploy hook. Trigger only on mutations for:

- `product`
- `galleryImage`
- `category`
- `collection`
- `siteSettings`

Filter out draft-only edits where possible so ordinary draft typing does not rebuild the site.

## Custom Domain Later

No domain is required for launch. To connect a customer domain later:

1. Add the domain in Cloudflare Pages.
2. Follow Cloudflare's DNS instructions.
3. Verify HTTPS provisioning.
4. Update `NEXT_PUBLIC_SITE_URL`.
5. Redeploy.

Do not modify unrelated DNS records.
