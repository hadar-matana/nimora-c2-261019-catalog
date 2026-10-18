# ATELIER admin — local Phase B preview

This is a separate Hebrew/RTL Next.js admin UI with **simulated authentication and in-memory mock content only**. It is not a production admin, and must not be deployed publicly. Phase B approval does not approve the production architecture, vendors, or operating costs.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm dev:admin
```

Open http://127.0.0.1:3001. Demo username: `atelier`. Demo password: `demo123`. Do not enter real credentials. The server binds to loopback, cloud provider builds are blocked, and the production runtime requires explicit local-preview enablement (set by `pnpm --filter admin start`). These guards prevent common accidental deployments; they do not turn simulated login into secure authentication.

The local demo accepts username capitalization, surrounding whitespace and invisible RTL directional formatting from copied text. Password letters remain case-sensitive. This forgiving comparison is only for the public mock credentials and must not be reused for production password authentication.

All products, categories, selected photos and login state exist only in React memory. They survive client navigation and reset on a browser refresh. Saved changes never affect the public storefront. Logout removes simulated access; refreshing restores the initial mock catalog.

## Available screens

- `/login`: username/password, visibility toggle, validation and simulated progress.
- `/`: lightweight dashboard, product counts, recent products and owner navigation.
- `/products`: compact responsive rows, search, category/status filters, empty states and incremental loading.
- `/products/new`, `/products/edit?id=…`: images first, decimal shekel input, required publication details, optional description/sizes/colors and explicit saves.
- `/categories`: add, rename, reorder and product counts; no destructive deletion.

The editor supports local multi-photo selection/drop, immediate thumbnails, decoding/type/size/count validation, progress, removal and drag or button reordering. First image is the catalog image. JPEG, PNG and WebP are accepted, up to 10 MB each and ten images per product. There is no server upload or storage. HEIC is not supported in this phase.

Drafts can be incomplete except for a name and valid supplied price. Publication requires an image, price and category. Published changes apply only on Save Changes. Editor-only unpublish asks for confirmation and keeps the last saved product as a draft. Preview uses unsaved form values without publishing, and offers catalog-card and full-product views. No slugs, account settings, branding controls, orders, cart, checkout or wishlist are exposed.

## Checks

```sh
pnpm lint:admin
pnpm typecheck:admin
pnpm build:admin
pnpm --filter admin test:auth
# With the preview running in another terminal, and Chrome installed:
pnpm --filter admin test:ui
```

Browser tests use Playwright with the installed Chrome browser (`PLAYWRIGHT_CHANNEL` can override the channel). `ADMIN_TEST_URL` can select another **local** preview port. Screenshots are written to `docs/admin-screenshots`. Production-build local preview:

```sh
pnpm build:admin
pnpm --filter admin start
```

Do not run a dev server and production build against the same `.next` directory concurrently. Stop dev before switching to build/start.

## Boundaries for future work

`src/lib/model.ts` contains plain UI view models and price validation; `mock-data.ts` contains seed data. `MockProvider` is the mock auth/data adapter; screens consume it without importing Sanity, database SDKs or credentials. Replace it with approved integrations in future phases. Server validation, secure sessions, authorization, durable data, tenant isolation, backups and production publishing are not implemented.

The architecture must be revisited before Phase C with recurring cost and operational simplicity as core constraints. Nothing in this prototype commits the product to separate Sanity projects, PostgreSQL draft workspaces, R2 buckets or Vercel Pro.

See `docs/ADMIN_PHASE_B_QA.md` for screenshots, reference comparisons, test coverage and limitations. Generated mock-photo prompts and provenance are in `public/demo/ASSETS.md`.
