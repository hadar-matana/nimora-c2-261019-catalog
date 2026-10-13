# Fashion Catalog Demo QA / UX Audit

Audit date: 2026-10-13  
Admin Studio: https://fashion-catalog-demo.sanity.studio/  
Public site: https://fashion-catalog-demo.pages.dev/  
Sanity project / dataset: `3ahm0828` / `production`

## Phase 1 Remediation Update

Update date: 2026-10-13

### Resolved In Phase 1

| Finding | Status | Verification |
| --- | --- | --- |
| CMS publishing did not rebuild storefront | Resolved | Created a Cloudflare Pages deploy hook and Sanity document webhook named `cloudflare-pages-publish` for `production`. Drafts and versions are excluded. Creating, updating, and deleting temporary product `qa-product-phase1` triggered Cloudflare deployments `a3ffcdf1`, `7b169428`, and `aa9badab`; the live product appeared, updated, then returned 404 after deletion. |
| Default production build failed with Turbopack | Resolved | Storefront build now uses `next build --webpack`; `pnpm build` passed and generated the static export. |
| Existing seeded product arrays had missing keys | Resolved | Ran dry-run migration: 12 of 14 product documents needed repair. Ran the migration, then dry-run reported 0 remaining product documents needing repair. Seed script now writes stable `_key` values for product image and collection arrays. |
| Hebrew product slug generation produced an empty slug | Resolved | Added Hebrew transliteration/fallback slug generation with uniqueness checks and non-destructive auto-fill only when slug is empty. Temporary Hebrew product used slug `shmlt-bdykh-shlb-1`. |
| Price entered in agorot | Resolved | Product schema now labels price as `מחיר (₪)` and uses a custom input that accepts shekels while storing integer agorot. Temporary product price `129.90` was stored as `12990` and rendered live as ₪129.90. |
| Product form was flat and too long | Resolved | Product fields are grouped into `מידע בסיסי`, `פרטי מוצר`, and `הגדרות מתקדמות`; slug/currency/display controls moved to advanced. |
| Image upload guidance was not discoverable | Improved | Added `העלאת תמונות` guidance explaining multi-file selection/drag-and-drop, first image as primary, reorder and remove behavior. Sanity's native array image editor still provides the actual upload/reorder/remove UI. |
| Public storefront announced itself as a demo/admin tool | Resolved | Removed public admin navigation link, conspicuous demo notice, fake WhatsApp modal, Sanity/build-time copy, and technical gallery/footer copy. Footer keeps a discreet illustrative-products disclosure. |
| Catalog card links lacked useful accessible names | Resolved | Product card links now include product name, category, and price in their accessible label. |
| Gallery captions exposed demo/Sanity mechanics | Resolved for seeded content | Updated seeded gallery captions and existing production gallery captions to shopper-facing copy. |

### Verification Commands

Passed after remediation:

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm --filter studio exec sanity exec scripts/repair-array-keys.ts --with-user-token -- --dry-run
```

Production deployments verified:

- Studio deployed to https://fashion-catalog-demo.sanity.studio/
- Storefront Git deployment from commit `889e954` became canonical at https://fashion-catalog-demo.pages.dev/
- Sanity webhook rebuilds produced Cloudflare deployments `a3ffcdf1` (create), `7b169428` (update), and `aa9badab` (delete/unpublish).

Temporary QA content cleanup:

```sh
pnpm --filter studio exec sanity documents query '*[_id in ["qa-product-phase1", "drafts.qa-product-phase1"] || (_type == "product" && slug.current == "shmlt-bdykh-shlb-1")]{_id,_type,name,slug}' --api-version 2025-02-19 --project-id 3ahm0828 --dataset production
```

Result: `[]`

### Remaining Limitations

- Browser automation could open the deployed Studio structure and verify all five admin sections without structure errors, but the embedded Sanity document form controls were not consistently exposed to the automation layer. CRUD and asset-upload verification therefore used authenticated Sanity CLI/API operations plus live-browser storefront verification.
- The product image workflow is improved through clear guidance while still relying on Sanity's native image array editor. A fully custom multi-image manager remains a later UX enhancement.
- The built-in Studio chrome still contains some English labels such as Publish/Draft/Comments; localizing all Sanity workflow chrome remains future work.
- Unpublish is still Sanity's native published-document action rather than a custom Hebrew primary action.

## Scope And Method

I used the authenticated Chrome session to test the deployed Sanity Studio and the live Cloudflare Pages storefront. I created temporary QA content only where needed, published it briefly, and cleaned it up afterward. I did not change seeded demo products, site settings, Cloudflare configuration, GitHub configuration, or infrastructure.

Temporary content cleanup was verified with:

```sh
pnpm --filter studio exec sanity documents query '*[_id in ["drafts.qa-product-codex-audit","qa-product-codex-audit","drafts.qa-gallery-codex-audit","qa-gallery-codex-audit"] || name match "QA*" || title match "QA*"]{_id,_type,name,title}' --api-version 2025-02-19 --project-id 3ahm0828 --dataset production
```

Result: `[]`

## Test Matrix

| Area | Status | Notes |
| --- | --- | --- |
| Studio login / authenticated access | Tested successfully | Existing authenticated Chrome session opened the Studio. |
| Structure root | Tested successfully | All five custom sections load. |
| Products list | Tested successfully | Existing products visible; temporary product publish/unpublish flow tested. |
| Product name / slug | Tested with issues | English slug generation works; Hebrew-only names generate an empty slug. |
| Product image upload | Partially blocked | UI exposes Upload/Select, but browser automation could not trigger the file chooser. A temporary product with two uploaded Sanity assets was created through CLI to inspect the Studio image list and publish flow. |
| Multiple product images | Tested successfully via seeded/temporary data | Multiple images render in the form, can be opened individually, and have item menus; direct browser upload was blocked. |
| Product publish | Tested successfully | Temporary product published in Studio after validation passed. |
| Product unpublish | Tested successfully with UX issue | Unpublish exists only in the Published perspective and requires mode switching/discovery. |
| Gallery section | Tested with transient issue | First load showed empty list/disabled create; reload populated 10 gallery items and enabled creation. Temporary gallery item was published and cleaned up. |
| Categories | Tested successfully | Temporary category created, slug generated, published, and deleted. |
| Collections | Tested successfully | Temporary collection created, slug generated, published, and deleted. |
| Site Settings | Tested read-only successfully | Existing settings loaded; no changes made. |
| Public homepage | Tested with UX issues | Loads, but clearly presents itself as a demo/admin tool instead of a real shop. |
| Public catalog | Tested successfully with UX issues | Search/filter/sort work; copy exposes technical implementation. |
| Product detail | Tested successfully with UX issues | Product gallery, related products, pricing, and inquiry modal work. |
| Public gallery | Tested successfully with UX issues | Filters and lightbox work; captions expose demo/Sanity copy. |
| CMS publishing to storefront rebuild | Tested failed / gap | Sanity has no listed webhooks; temporary Sanity publishes did not create a Cloudflare Pages deployment. |
| Typecheck | Passed | `pnpm typecheck` passed. |
| Studio build | Passed | `pnpm --filter studio build` passed. |
| Storefront lint/typecheck | Passed | `pnpm --filter storefront lint` and `pnpm --filter storefront typecheck` passed. |
| Default full build | Failed | `pnpm build` fails at storefront `next build` with a Turbopack internal error. |
| Storefront webpack build | Passed | `pnpm --filter storefront exec next build --webpack` passed. |

## Critical Functional Bugs

### 1. CMS Publishing Does Not Rebuild The Public Storefront

Severity: Critical  
Estimated difficulty: Medium

What is wrong: The storefront is a static export generated at build time, but Sanity publishes do not trigger a Cloudflare Pages rebuild.

Repro:
1. Publish temporary content in Sanity Studio.
2. Check Sanity hooks with `sanity hooks list`.
3. Check Cloudflare Pages deployments with `wrangler pages deployment list --project-name fashion-catalog-demo`.

Expected: Publishing a product/gallery/category/collection/site setting should trigger a storefront rebuild or another preview/live update pipeline.

Actual: `sanity hooks list` returned no hooks. Cloudflare Pages showed only Git-backed deployments from commits (`1e7774c`, `2cde972`), not a new CMS-triggered deployment after publishing QA content.

Technical solution: Add a Sanity webhook for create/update/delete/publish/unpublish events that calls a Cloudflare Pages deploy hook, or move storefront rendering to a runtime/ISR architecture that does not require a full Pages rebuild for every content change.

### 2. Default Production Build Fails With Turbopack

Severity: Critical  
Estimated difficulty: Medium

What is wrong: The repo-level production build fails on the storefront step.

Repro:
1. Run `pnpm build`.

Expected: Studio and storefront both build successfully.

Actual: Studio builds, then storefront `next build` fails with `TurbopackInternalError: Failed to write app endpoint /page`, caused by `globals.css`, `creating new process`, `binding to a port`, `Operation not permitted (os error 1)`.

Technical solution: Pin the production storefront build to webpack while investigating the Next 16/Turbopack panic. `pnpm --filter storefront exec next build --webpack` passed, so the app can build with webpack.

### 3. Existing Seeded Product Array Data Has Missing Keys

Severity: High  
Estimated difficulty: Medium

What is wrong: Existing seeded product image arrays and collection arrays show Sanity's "Missing keys" warning, preventing list editing until repaired.

Repro:
1. Open Products.
2. Open an existing seeded product such as `product-silk-scarf`.
3. Inspect the Images and Collections fields.

Expected: Images and collection references should be editable immediately.

Actual: Sanity shows "Some items in the list are missing their keys. This must be fixed in order to edit the list" with an "Add missing keys" repair button.

Technical solution: Update the seed script/data migration so all array items include stable `_key` values. Run a one-time migration on existing seeded product arrays.

### 4. Hebrew Slug Generation Produces An Empty Slug

Severity: High  
Estimated difficulty: Low

What is wrong: Store owners writing Hebrew product/category names can click Generate and get an empty slug.

Repro:
1. Create a product.
2. Enter a Hebrew-only name such as `בדיקת מוצר זמנית`.
3. Click Generate on the slug field.

Expected: A valid slug should be produced, or the UI should clearly ask for an English URL slug.

Actual: The slug field remains empty. English input such as `QA Product Temporary` generated `qa-product-temporary`.

Technical solution: Add a custom slugify function that transliterates Hebrew or generates a fallback slug. Alternatively change the label/help text to "English URL slug" and validate with a clearer Hebrew error.

### 5. Gallery Section Initially Loaded Empty And Disabled

Severity: Medium  
Estimated difficulty: Low to Medium

What is wrong: The Gallery structure initially appeared empty with a disabled create action, despite 10 `galleryImage` documents existing in production.

Repro:
1. Navigate to Gallery from Studio after other document workflow testing.
2. Observe list state.
3. Reload the page.

Expected: Existing gallery items and the create action should appear on first load.

Actual: First load showed only the search box and a disabled `תמונת גלריה` create link. Reload populated the gallery list correctly.

Technical solution: Investigate Studio perspective/router state after switching between Draft/Published and custom structure panes. If reproducible, consider explicit `S.documentTypeList("galleryImage")` options or updating Sanity Studio version.

## Admin Usability Problems

### 6. Product Form Is Too Long And Operationally Flat

Severity: High  
Estimated difficulty: Medium

What is wrong: A store owner has to scan a single long form with core sales fields, media fields, taxonomy, status toggles, and sort controls all at the same level.

Repro: Open or create a product.

Expected: First screen should focus on the daily workflow: name, photos, category, price, sizes/colors, publish readiness.

Actual: Advanced controls such as `featured`, `isNew`, `sortOrder`, currency, comments, field actions, and Sanity chrome compete with core merchandising fields.

Technical solution: Use Sanity fieldsets/groups for "Basics", "Images", "Pricing", "Availability", "Display controls", and hide advanced fields behind a collapsed group.

### 7. Price Is Entered In Agorot

Severity: High  
Estimated difficulty: Low to Medium

What is wrong: The product form asks for `מחיר באגורות`, e.g. `12900 = ₪129`.

Repro: Create/edit a product and inspect the price field.

Expected: Store owner enters `129` or `329` in shekels.

Actual: Store owner must mentally convert to agorot, which invites pricing mistakes.

Technical solution: Add a custom Sanity input for shekels that writes agorot internally, or change schema to store shekels and convert only where needed.

### 8. Image Upload And Multi-Image Management Are Not Discoverable Enough

Severity: High  
Estimated difficulty: Medium

What is wrong: Images are an array of raw Sanity image items. "Add item" opens a detail modal with Upload/Select, but there is no domain-specific guidance like "Add product photos", no bulk upload affordance, and each image requires individual alt text.

Repro: Create a product and click Add item under Images.

Expected: Clear multi-photo upload workflow with reorder, primary image, alt defaults, and bulk add.

Actual: Generic Sanity array interaction; direct file chooser was not available to automation, and the UI is still cumbersome for nontechnical owners.

Technical solution: Create a custom product media input/component or split images into a clearer object type with `primary`, `gallery`, and automatic alt text fallback from product name.

### 9. Unpublish Is Hard To Find

Severity: Medium  
Estimated difficulty: Low

What is wrong: After publishing a product, the obvious document actions menu shows Duplicate, Link to Canvas, Delete, but not Unpublish. Unpublish appears only after switching to the Published perspective/status.

Repro:
1. Publish a product.
2. Open document actions.
3. Try to find Unpublish.
4. Click the Published status chip.

Expected: Unpublish should be discoverable from the primary action area or document actions.

Actual: It is hidden behind a perspective/status mode that nontechnical users are unlikely to understand.

Technical solution: Add a document action or custom publishing helper in the Studio that surfaces "Unpublish item" in the main action area, with Hebrew copy.

### 10. Mixed Hebrew And English Makes The Admin Feel Technical

Severity: Medium  
Estimated difficulty: Medium

What is wrong: Domain fields are Hebrew, but many workflow controls remain English: Publish, Draft, Generate, Add item, Field actions, Comments, Validation, Missing keys.

Repro: Create/edit any document.

Expected: A store owner sees one consistent language and only necessary CMS concepts.

Actual: The UI is bilingual in a way that reads like an internal developer CMS.

Technical solution: Add a Hebrew Studio locale where possible, customize document actions/field descriptions, and replace generic schema titles/descriptions with owner-friendly Hebrew labels.

## Public Website UX Problems

### 11. The Storefront Announces Itself As A Demo

Severity: Critical  
Estimated difficulty: Low

What is wrong: The homepage and footer contain explicit demo/product-builder language.

Repro: Open the homepage.

Expected: The first viewport should feel like a real clothing boutique.

Actual: It shows "זהו אתר הדגמה", "Fashion catalog demo", and copy about a static Sanity-powered catalog.

Technical solution: Turn demo copy into configurable internal/site settings and default the public storefront to real boutique copy. Keep demo disclaimers outside the customer-facing experience or behind an owner-only preview mode.

### 12. Admin Login Is Publicly Prominent

Severity: High  
Estimated difficulty: Low

What is wrong: Header shows `כניסת מנהל` on every public page.

Repro: Open any public page.

Expected: Shopper navigation should focus on catalog, gallery, contact, and brand.

Actual: The admin link competes with shopping navigation and reveals implementation/admin surface.

Technical solution: Hide the admin link in production storefronts, or move it to a private URL/bookmark/documentation page for store owners.

### 13. WhatsApp Inquiry Flow Is Demo-Only

Severity: High  
Estimated difficulty: Low

What is wrong: Product inquiry button opens a modal explaining what a real WhatsApp integration would do.

Repro:
1. Open `/products/satin-midi-dress/`.
2. Click `הדגמת בירור בוואטסאפ`.

Expected: Shopper clicks a WhatsApp button and opens a real prepared message.

Actual: A modal says "כך תיראה הפנייה באתר אמיתי" and explains the demo.

Technical solution: Treat missing WhatsApp number as a launch blocker or hide inquiry buttons until configured. When configured, open `wa.me` directly.

### 14. Public Copy Exposes Technical Implementation

Severity: High  
Estimated difficulty: Low

What is wrong: Pages mention Sanity, build-time content, static browser filtering, and "ניהול תוכן אמיתי".

Repro: Open homepage, catalog, gallery, and footer.

Expected: Shopper-facing copy should sell apparel, style, quality, service, and availability.

Actual: Copy sells the CMS/demo architecture.

Technical solution: Replace technical copy with brand/category copy. Move implementation language to case study/admin docs.

### 15. Catalog Cards Are Not Self-Describing To Assistive Technology

Severity: Medium  
Estimated difficulty: Low

What is wrong: The accessibility tree exposes product cards mostly as bare links by URL, not meaningful link names.

Repro: Open Catalog and inspect links.

Expected: Product links should be announced as product names with useful context.

Actual: Links appear as `fashion-catalog-demo.pages.dev/products/.../`.

Technical solution: Ensure `ProductCard` has an accessible link name that includes product name and optionally price/category.

### 16. Gallery Captions Repeatedly Say They Are Demo/Sanity Content

Severity: Medium  
Estimated difficulty: Low

What is wrong: Gallery captions include lines like "צילום השראה מתוך קטלוג ההדגמה" and "תמונה שניתנת לניהול ופרסום דרך Sanity Studio."

Repro: Open `/gallery/`.

Expected: Captions should tell a style story or product context.

Actual: Captions repeatedly explain demo/CMS mechanics.

Technical solution: Replace seeded gallery captions with boutique-style editorial captions.

## Visual Design Problems

### 17. Visual System Feels Like A Template, Not A Boutique

Severity: Medium  
Estimated difficulty: Medium

What is wrong: The site uses good photography, but the layout and copy combine into a builder/demo presentation rather than a finished fashion brand.

Repro: Open the homepage and gallery.

Expected: Strong brand signal, editorial rhythm, polished merchandising hierarchy.

Actual: The first viewport splits explanatory copy and an image grid; the design feels like a sample catalog product.

Technical solution: Create a brandable visual direction: boutique name as hero signal, seasonal collection framing, richer product storytelling, and owner-configurable brand copy/images.

### 18. Gallery Lightbox Has Awkward Wide Desktop Composition

Severity: Medium  
Estimated difficulty: Low to Medium

What is wrong: The lightbox uses a large image plus a left side panel, but on desktop the photo can be cropped/letterboxed awkwardly and the metadata panel feels detached.

Repro: Open Gallery, click the first image.

Expected: Immersive product/lookbook preview with intuitive next/previous controls.

Actual: A large dark overlay, white metadata panel, and large black bars make the experience feel utilitarian.

Technical solution: Rework the lightbox around full image inspection, smaller overlay controls, product CTA, and tighter responsive image framing.

### 19. Public Header Prioritizes Admin Access Over Brand/Shopping Flow

Severity: Medium  
Estimated difficulty: Low

What is wrong: The right/primary header area includes Admin Login and only two customer links.

Repro: Open any public page.

Expected: Header should communicate brand and shopping paths.

Actual: The admin affordance reads as part of the shopper journey.

Technical solution: Remove admin link, add contact/Instagram/WhatsApp links where configured, and keep catalog/gallery as primary customer navigation.

## Publishing / Infrastructure Gaps

### 20. No Sanity Webhooks Are Configured

Severity: Critical  
Estimated difficulty: Medium

Evidence: `pnpm --filter studio exec sanity hooks list --project-id 3ahm0828` returned no hooks.

Expected: At least one webhook should trigger Cloudflare Pages after published content changes.

Actual: No hooks were listed.

Technical solution: Add a Sanity webhook to trigger a Cloudflare deploy hook for the existing Pages project. Keep deploy hook secret outside the repo.

### 21. Cloudflare Pages Is Git-Backed, Not CMS-Backed

Severity: High  
Estimated difficulty: Low to Medium

Evidence: `npx --yes wrangler@4.150.0 pages deployment list --project-name fashion-catalog-demo` showed deployments sourced from Git commits `1e7774c` and `2cde972`.

Expected: CMS content changes should create a visible deployment or update path.

Actual: Pages deploys are tied to Git pushes only.

Technical solution: Keep Git integration for code changes, but add Sanity-to-Cloudflare deploy hook for content changes.

## Recommended Improvements

### Priority 0: Launch Blockers

1. Wire Sanity publish/unpublish/create/delete events to Cloudflare Pages rebuilds.
2. Remove public demo language, Sanity language, and Admin Login from the shopper site.
3. Configure real WhatsApp behavior or hide inquiry buttons until a number is set.
4. Fix default `pnpm build` by pinning webpack or resolving the Turbopack failure.

### Priority 1: Admin Usability

1. Replace agorot input with shekel input.
2. Add Hebrew-safe slug generation or clearer English slug guidance.
3. Repair existing missing `_key` array data in seeded products.
4. Group/collapse advanced product fields.
5. Create a simpler media management workflow for product and gallery images.

### Priority 2: Storefront Polish

1. Rewrite homepage, catalog, gallery, and footer copy as a real boutique.
2. Improve product card accessible names and shopper-facing product detail CTAs.
3. Rework gallery captions and lightbox composition.
4. Add real contact/social paths from Site Settings.

### Priority 3: Operational Hardening

1. Add a post-publish QA checklist for content editors.
2. Add smoke tests for the five Studio structure sections.
3. Add a content migration/check script for missing array keys.
4. Document the Cloudflare/Sanity rebuild flow in `docs/DEPLOYMENT.md` after it is configured.

## Verification Commands Run

Passed:

```sh
pnpm typecheck
pnpm --filter studio build
pnpm --filter storefront typecheck
pnpm --filter storefront lint
pnpm --filter storefront exec next build --webpack
```

Failed:

```sh
pnpm build
```

Failure summary: Studio build passed, but storefront `next build` failed with a Turbopack internal error while processing `apps/storefront/src/app/globals.css`. The webpack build path passed.

## Files Changed

- `docs/QA_UX_AUDIT.md`
