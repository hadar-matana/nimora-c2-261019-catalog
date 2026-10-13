# New Client Setup

1. Duplicate this repository or create a new repository from it.
2. Create a customer-specific Sanity project and dataset.
3. Update the Sanity project ID and dataset in `apps/studio/sanity.config.ts`, `apps/studio/sanity.cli.ts`, and Cloudflare environment variables.
4. Update colors and basic copy in `apps/storefront/src/config/site.ts` and `apps/storefront/src/app/globals.css`.
5. Seed starter categories or import the customer's real products.
6. Invite the store owner to Sanity with the appropriate role available on the selected plan.
7. Create a separate Cloudflare Pages project for the customer.
8. Configure a deploy hook and a Sanity webhook for that customer's project.
9. Connect a custom domain if the customer has one.
10. Verify product publishing, image uploads, unpublishing, deep product links and mobile layout before handoff.

Do not reuse one Sanity project for unrelated customers unless there is a deliberate isolation strategy. The recommended approach is one Sanity project and one Cloudflare Pages deployment per customer.
