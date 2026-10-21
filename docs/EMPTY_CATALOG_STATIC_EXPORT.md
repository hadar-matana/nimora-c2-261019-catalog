# Empty catalogs and static product routes

Next.js 16.4.0 rejects `generateStaticParams() === []` when `output: "export"`
is enabled. A client with valid branding and no published products therefore
cannot export the original `/products/[slug]` page.

The internal route is now `/products/[[...slug]]`. Published product slugs are
returned as one-element arrays; their public URLs remain `/products/<slug>/`.
An empty published catalog returns the optional base parameter `{slug: []}`.
Both metadata and page rendering reject absent or multi-segment slugs with
`notFound()` before performing any product lookup. `dynamicParams = false`
prevents runtime fallback. No reserved or fabricated product slug is used.

Next exports the empty base route as a not-found HTML artifact. The storefront
build removes that generated directory after export, so Pages uses the existing
global `404.html` rather than serving a soft 404 with HTTP 200. Cleanup refuses
to remove non-error HTML or any directory containing real product directories.
Use `pnpm build:storefront` (or the storefront package's `pnpm build`), rather
than invoking `next build` directly, to include this required cleanup.

There is no Pages architecture, CMS query, perspective, credential, dependency
or product URL change. Public queries still use the explicitly configured CMS
project/dataset and Sanity's `published` perspective. Draft-only catalogs export
no product pages. The homepage and catalog show “הקולקציה תעלה בקרוב” when empty;
the existing category-filter empty message and populated UI are preserved.

Run `pnpm --filter storefront test:static-export` for four real Next builds
against isolated synthetic provider fixtures: empty, drafts only, one published
product, and multiple published products. The test verifies exact product route
counts, absence of draft/foreign routes and links, empty states, and global 404.
The provider double asserts the real application's project, dataset and
`published` perspective; it is injected only into a temporary test configuration.
It is never referenced by production application configuration.

Local read-only verification also built both NIMORA datasets with zero products
and the demo with 13 published product routes. No CMS documents were changed.
Existing demo markup for homepage, catalog, About and a product detail was
compared with an unchanged approved-source build; mobile category filtering,
gallery navigation and size/color selection were checked locally.

The fix is review-only. It requires a newly approved executable SHA before any
NIMORA deployment. The review commit uses Cloudflare's documented
`[CF-Pages-Skip]` prefix to avoid an automatic demo branch deployment.
