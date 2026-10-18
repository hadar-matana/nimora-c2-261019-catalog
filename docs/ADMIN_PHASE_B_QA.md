# ATELIER — Phase B handoff and QA

Date: 2026-10-14. Local mock UI only; production architecture remains unapproved.

## Implementation

`apps/admin` is a standalone Next.js application. The storefront and Studio source, public Sanity dataset, webhooks and deployment configuration were not changed. Root scripts add explicit admin commands without adding admin to the existing storefront/Studio production build pipeline.

Implemented owner screens: simulated login, dashboard, compact product list, image-first add/edit form, local image controls, both previews and category management. Published edits require Save Changes. Draft save/publication and confirmed editor-only unpublish/republish work within the local mock provider. Permanent deletion, technical fields, site settings and unrelated commerce screens are absent.

## Browser verification

Playwright/Chrome checks cover 375, 390, 768, 1280 and 1440 px. Each width captures login, dashboard, list, editor, full preview, card preview and categories; checks RTL, navigation and horizontal overflow. The full mocked workflow suite passed 71 assertions against both the development preview and the production build running locally. Final screenshots come from the built local app.

All required commands passed: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm lint:admin`, `pnpm typecheck:admin` and `pnpm build:admin`. The first storefront build attempt was blocked by sandbox DNS; the read-only Sanity fetch succeeded when rerun with network permission. No content mutations were performed.

Workflow coverage includes missing/invalid credentials, password visibility, login/logout, signed-out navigation, search, status/category filters and empty state, discard/cancel including browser Back, published edits remaining unapplied until save, exact decimal prices, unpublish cancel/confirm, retained drafts, republish, required publication validation, incomplete draft save, invalid photo type, multi-image selection, drag/button reorder, removal, gallery navigation, unsaved preview preservation, publication without optional sizes/colors, category add/duplicate/rename/reorder, incremental loading and refresh reset. It also verifies no external browser requests, browser exceptions or localStorage data.

Local browser tests verify simulated UI behavior, not production authentication or tenant security. Camera/photo-picker behavior uses the browser's native file chooser and has not been verified on a physical phone. Tests do not establish a secure server upload pipeline.

## Reference comparison

The approved mockups guided the ivory/black/taupe palette, right desktop sidebar, compact rows, sparse controls, photo thumbnails, status pills and mobile form/preview layouts. Generated neutral studio imagery replaces unrelated catalog demo photos. Deliberate differences: a clear local-demo label, dashboard/home navigation, no decorative commerce features, accessible image reorder buttons and explicit unpublish confirmation. The editor puts images above fields on desktop as requested, rather than copying the reference's side-by-side image/field panel literally.

| Approved reference | Implemented result |
| --- | --- |
| Desktop product rows / editor / full preview | [Products, 1440px](admin-screenshots/products-1440.png), [editor](admin-screenshots/editor-1440.png), [full preview](admin-screenshots/preview-1440.png) |
| Mobile rows / photo-first editor / preview | [Products, 390px](admin-screenshots/products-390.png), [editor](admin-screenshots/editor-390.png), [full preview](admin-screenshots/preview-390.png), [card](admin-screenshots/card-390.png) |
| Additional screens | [Login](admin-screenshots/login-1440.png), [dashboard](admin-screenshots/dashboard-1440.png), [categories](admin-screenshots/categories-1440.png) |

For a side-by-side view including the supplied reference images, open [the comparison gallery](admin-screenshots/comparison.html). All breakpoint captures are retained in `docs/admin-screenshots/`.

## Local preview

```sh
pnpm dev:admin
```

Open http://127.0.0.1:3001. Login with `atelier` / `demo123`. These are publicly documented mock values, not real credentials. All mock data resets on refresh. Use only sample photos; no server persistence exists.

To reproduce browser QA, keep that preview running and execute `pnpm --filter admin test:ui` with Chrome installed. Root existing checks are `pnpm lint`, `pnpm typecheck`, `pnpm build`; admin checks are `pnpm lint:admin`, `pnpm typecheck:admin`, `pnpm build:admin`.

## Remaining limitations and Phase C gate

- Mock login is a UI simulation; no secure sessions, protected APIs, tenant authorization, databases, provider provisioning or production integration exists.
- Drafts, categories and photos are in memory. Refresh deliberately resets them; there is no durable save, real upload or deployment status tracking.
- Upload validation is client-side demonstration only. Production needs server validation, storage policy and actual security tests. HEIC is unsupported.
- Visual verification uses desktop Chrome emulation, not physical iOS/Android devices. Unsaved browser Back returns to the product list after confirmation.
- Preview contact action is visibly inert; no real phone/Instagram/account settings are exposed.
- Generated imagery is illustrative and must not be presented as real merchant inventory.
- Hosting vendors, operating costs and the full tenant/draft/media architecture must be reconsidered for an affordable MVP before Phase C. Stop at Phase B pending explicit approval.

## Login regression fix

The configured mock credentials were correctly `atelier` / `demo123`. Exact credentials succeeded in the user's installed Chrome browser before the fix. The reported Hebrew invalid-credentials message was reproduced in a fresh Chrome tab by entering `demo123 ` with trailing whitespace. The old provider also compared usernames case-sensitively; password whitespace was preserved while username whitespace alone was trimmed. The original failed attempt's exact field values were not retained, so its precise input variant cannot be confirmed retrospectively.

The mock comparison now centralizes credentials, strips surrounding whitespace and invisible RTL directional formatting, and ignores username capitalization. Password capitalization and internal spaces remain significant. The form still reads current DOM FormData at submit time, including autofilled values, rather than relying on potentially stale React field state. Autocapitalization, spelling correction and autocorrection are disabled; a submission lock prevents overlapping attempts. No saved password-manager credentials were inspected or modified. The UI styling and all local-only guards are unchanged.

Verified after rebuilding, through the installed Chrome browser: whitespace/capitalization variant redirects to `/`; wrong password shows the existing Hebrew error; retrying exact credentials after failure redirects to the dashboard. Fresh tabs demonstrate the result without dependence on prior mock session state. The user's in-app tab was refreshed to load the rebuilt code.

Four regression tests (including a matrix of whitespace/RTL/case variants) pass with `pnpm --filter admin test:auth`; admin lint, typecheck and build also pass. This forgiving normalization applies only to the publicly documented local mock credentials and is not a production password policy.

Chrome evidence: [successful dashboard redirect](admin-screenshots/login-success-chrome.jpg), [invalid credentials](admin-screenshots/login-invalid-chrome.jpg).
