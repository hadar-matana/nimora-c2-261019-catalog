# Catalog options — local implementation, 16 October 2026

Status: implemented and verified locally only. No Cloudflare deployment, live Sanity reads/writes, new infrastructure, billing change or storefront modification was performed for this task.

## Owner experience

The existing `/categories/` page now has the Hebrew heading/navigation label **אפשרויות הקטלוג** and three simple sections: categories, sizes and colors. Existing category create/rename/order behavior remains unchanged. Reusable sizes/colors can be added, renamed or removed. The explanation explicitly states that renaming/removing a reusable value leaves existing products unchanged.

The editor keeps its existing optional selection controls. It combines reusable choices with the exact values already saved on the product, so legacy/removed/renamed values remain visible and selected. Adding a size or color directly in the editor persists that choice centrally and selects it locally. Clear helper text explains that the reusable choice is saved immediately, while the product selection still requires the normal save action. Discarding product edits does not undo a separately saved reusable choice. Empty sizes/colors remain valid.

New values use Unicode NFKC normalization, trimmed/collapsed whitespace and case-insensitive duplicate keys. An equivalent addition reuses the existing label instead of creating another option. Rename collisions return a clear error. Existing product strings are never normalized, rewritten or migrated merely by opening/saving an options list. Product selection prefers its existing label over an equivalent preset.

## Minimal backward-compatible model

One singleton document, created lazily on the **first authorized options change**:

```json
{
  "_id": "atelier-admin-catalog-options",
  "_type": "catalogOptions",
  "sizes": ["XS", "S", "M"],
  "colors": ["שחור", "לבן"]
}
```

Before it exists, reads return the current admin defaults without creating anything. An intentionally empty saved list stays empty. Up to 100 reusable values per kind, sizes 40 characters, colors 80 characters. Existing per-product limits of 20 sizes/30 colors remain unchanged.

Product `sizes` and `colors` stay optional arrays of strings; category references, IDs, slugs, product images and public queries remain unchanged. No reference migration or product backfill is required. Existing arbitrary product values are not automatically copied to the reusable list; an owner can add them deliberately. Renaming a reusable label affects future selection only, so historical labels may coexist with the new name on older products. Custom colors are names, not new RGB/hex data; the admin uses its existing neutral fallback swatch for unknown names.

Studio source adds a read-only `catalogOptions` schema to recognize the singleton. Its normal owner editing surface is the standalone admin. The Studio product-size field loses only its hard-coded picker list and remains `array<string>`, matching colors; this lets custom values remain editable in Studio without changing stored data. No Studio deployment was performed.

The options document contains no credentials or site configuration. Like ordinary catalog metadata in the existing public dataset, it should not contain private information. No settings, branding, account or infrastructure fields are added to the owner UI/API.

## API and security

Authenticated `GET /api/catalog-options`; authenticated, same-origin CSRF-protected `POST /api/catalog-options` accepts only:

- `{kind:"sizes"|"colors", action:"add"|"remove", value:string}`
- `{kind:"sizes"|"colors", action:"rename", previous:string, value:string}`

Server chooses the document ID and only writes the selected array field. It checks document type before mutation. Existing auth/session middleware, Stage 1 write-disable gate and QA-only gate include this route. First creation uses `create` (never replace); later changes use `ifRevisionID`. Concurrent conflicts return 409 rather than silently overwriting another update; refresh before trying again. No automatic mutation retry. Sanity tokens stay server-side. Removing/renaming a value never issues product mutations or deletes the singleton.

The dedicated Editor credential already used for catalog writes is sufficient for this document type; no broader credentials or permissions are introduced. Real token permissions, request CPU and live webhook behavior for the new document type remain unverified until separately approved remote testing. One small additional authenticated read is made when loading the admin catalog; actual Free runtime must be measured remotely, not inferred from local tests.

## Verification

- **19 local workerd lifecycle scenarios passed**, including defaults, normalized duplicates, create/select/save/reload, rename conflicts, removed values retained on products, unchanged category documents, intentionally empty lists, failed mutations, owner/CSRF/type checks and existing product lifecycle.
- Nine security guard groups passed; new route included in read-only, QA-scope and active authentication/CSRF checks.
- Focused unit/contract tests passed for normalized equality, legacy visibility, exact fixed-ID/field mutation payload, revision conflicts, upstream failures and no retry/fail-closed behavior.
- Chrome, local fixture only: central size creation and rename; editor size selection plus custom size/color creation; draft saving; remove the selected color centrally; reopen the draft and confirm its color remains selected; confirm future products offer the custom sizes but exclude the removed color. No horizontal overflow at 390×844; desktop tested at 1440×900.
- Admin lint, UI typecheck, Worker typecheck, static build, Studio lint and Studio typecheck passed.
- One repeated run hit the existing local login rate limiter (429); final tests passed against fresh isolated DO auth storage, with no protection disabled.

Evidence: `docs/admin-screenshots/integration-lifecycle.json`, `catalog-options-browser.json`, `catalog-options-desktop.jpg`, `catalog-options-mobile.jpg`, `catalog-options-editor-mobile.jpg`.

## Changed source

- Admin model helper: `src/lib/catalog-options.ts`.
- Shared controls: `src/components/CatalogValues.tsx`.
- Admin context and both adapters: `AdminContext.tsx`, `ApiProofProvider.tsx`, `MockProvider.tsx`.
- Editor, navigation, central page and styles: `ProductEditor.tsx`, `Shell.tsx`, `src/app/categories/page.tsx`, `src/app/globals.css`.
- Worker: `worker/catalog-options.ts`, `worker/index.ts`.
- Studio: `schemaTypes/catalogOptions.ts`, `schemaTypes/index.ts`, `schemaTypes/product.ts`.
- Tests: `tests/catalog-options.mjs`, `tests/integration.mjs`, `tests/integration-guards.mjs`.

## Exact production rollout (requires separate approval)

1. Approve updating the existing `atelier-admin` Worker/UI and a bounded reusable-options live smoke test. No infrastructure/billing change or catalog migration is needed. Verify personal Cloudflare identity, Workers Free, four secret bindings, existing Editor role and retained unpublished QA draft before the update. Take a read-only baseline of existing documents and webhook filter; check whether this new document type matches the existing rebuild trigger. Do not change that webhook. A broad filter could cause an unnecessary rebuild on option changes.
2. Run the local lint/typecheck/build/fixture checks. Build with `pnpm --filter admin build`; deploy the same existing Worker with `WRANGLER_LOG_PATH=/private/tmp/atelier-options-deploy.log WRANGLER_SEND_METRICS=false pnpm --filter admin exec wrangler deploy --config worker/wrangler.release.jsonc`. No migration tags, bindings, secrets or infrastructure changes are needed.
3. Deploy API and UI together: the new UI expects `/api/catalog-options`; partial rollout with an old Worker would fail catalog loading. Verify owner session/catalog/preview, unauthorized and CSRF rejection, desktop/mobile and actual remote CPU/errors. Before the first mutation the default-list read is non-mutating.
4. Under the approved bounded smoke scope only, add one clearly named QA size/color and confirm persistence/duplicate handling, then remove those list entries. This creates the singleton if absent; retain it with the original reusable lists. Do not alter real products/categories or publish the retained QA draft. Compare document hashes: only the singleton should differ. Measure new endpoint CPU under Workers Free and stop/disable writes on failures. Live product selection testing would require separately scoped permission to save the retained QA draft.
5. The Studio schema is optional for runtime functionality (Sanity stores these documents without a Studio deployment). If the Studio UI is published separately, update its existing deployment only after approval; do not deploy the storefront or provision anything new.

Rollback: restore the prior existing Worker version/UI together. The singleton can remain harmlessly in Sanity; old code ignores it. Do not delete data during rollback. The existing emergency `SANITY_ALLOW_PRODUCTION_WRITES:disabled` deployment override also disables this new route; keep `SANITY_UPLOAD_RETEST_UNTIL:0`. See `ADMIN_STAGE2_ACTIVATION.md` for the exact emergency command. Pending accepted writes may finish.
