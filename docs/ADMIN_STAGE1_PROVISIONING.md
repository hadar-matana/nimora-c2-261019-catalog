# Stage 1 private owner provisioning

Owner provisioning and [remote read-only Stage 1 verification](ADMIN_STAGE1_REMOTE_VERIFICATION.md) are now complete. Existing owners should sign in at https://atelier-admin.hadarmat.workers.dev/login/; do not rerun provisioning to log in. The helper below is restricted to private provisioning and refuses public/active configuration.

Initial deployment accepted on Workers Free, 15 October 2026. The Worker `atelier-admin` and SQLite namespace `atelier-admin_OwnerAuth` exist. Migration `v1` was accepted. Public workers.dev and preview routes remain disabled, as do all Sanity writes/uploads.

## 1. Create a dedicated read-only Sanity credential yourself

1. Open [Sanity Manage](https://www.sanity.io/manage) using your personal account.
2. Select the existing ATELIER project, ID `3ahm0828`.
3. Open **API → Tokens → Add API token**.
4. Label it **ATELIER admin Stage 1 read-only** and select **Viewer**. Do not select Editor or enable a paid/custom role.
5. Save the token in your password manager. Do not paste it into this chat, a shell command, a source file or a `.env` file.

Sanity documents Viewer as its read-only project token role: [roles](https://www.sanity.io/docs/content-lake/roles-concepts), [project token API](https://www.sanity.io/docs/http-reference/projects-api).

## 2. Run the private terminal helper

In a private interactive terminal on this Mac:

```sh
cd /Users/hadarmatana/code/personal/fashion-catalog-demo
node apps/admin/scripts/provision-owner.mjs
```

The helper verifies the personal Cloudflare identity and disabled access/write gates. It asks for a username, a new unique owner password twice, the dedicated Viewer token and confirmation of its role. **All inputs are hidden.** Use a password manager to generate/store a new password of at least 16 characters, with at most 72 UTF-8 bytes. Do not reuse temporary QA credentials or another service's password.

The helper checks real read access, hashes the password locally with bcrypt cost 12, and sends four secret bindings directly to the existing Worker over HTTPS. It does not print or save the password, hash, token or credential version. The report contains only secret names and read counts. It refuses the existing broad Sanity CLI credential. Viewer-role selection is confirmed by the operator; it does not probe write permissions by making a production mutation.

No new resources, billing changes, permission changes, public routes or Sanity content mutations are performed by this helper. If an operation fails, it stops without retrying and the Worker remains fail-closed. Partial secret installation is possible after a network error; report only the failure message, never credentials.

## 3. Continue Stage 1 verification

Return to the chat and say **“Owner provisioning is complete.”** Do not include secrets. Public activation and remote auth/read-only/browser/runtime checks still need to be completed. A user sign-in may be required for browser QA; no temporary QA account will be reused.

Stage 2 remains unapproved. No product, category or upload write operation may be enabled or tested.
