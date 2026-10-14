# ATELIER Catalog Design Decisions

Phase 2 turns the public storefront into the Package B catalog demo only. Package A gallery content and schemas remain in Sanity for later reuse, but the public catalog site does not expose a gallery page or gallery navigation.

## Visual System

- Brand wordmark: `ATELIER` is rendered as an uppercase serif mark in the header and footer.
- Interface language: Hebrew RTL for shopper-facing UI, with the English wordmark kept LTR.
- Palette: white and warm off-white surfaces, almost-black text, muted gray secondary text, and hairline borders.
- Product photography is the primary visual element. Cards avoid borders, shadows, badges, colored panels, and decorative copy.

## Homepage

The homepage is the catalog grid. There is no hero banner, package switcher, admin copy, or marketing introduction before products. The initial viewport contains the minimal header, category filters, and live Sanity products.

## Filtering

Category filters are client-side buttons sourced from Sanity categories. `הכל` is selected by default and includes every published product, including products without a category. Mobile uses a horizontal scroll row to keep the catalog compact.

## Product Detail

Product pages keep one primary image visible at a time, with swipe navigation on mobile, pagination dots, and thumbnail navigation on desktop. Product name, price, description, category/collection context, size/color selections, and WhatsApp inquiry live alongside or below the gallery depending on viewport.

## WhatsApp Inquiry

The catalog does not implement cart, checkout, inventory reservation, accounts, wishlist, or payments. When a valid WhatsApp number is configured, the CTA validates required size/color choices and opens `wa.me` with a Hebrew message containing the product name, selected options, price, and shareable product URL. If no valid number is configured, the CTA is hidden.

## Contact Configuration

Public contact actions are sourced from the published Sanity Site Settings document, not from React constants or private environment variables. `instagramUrl` accepts either an Instagram username or a full Instagram profile URL. `whatsappNumber` accepts common international formats and is normalized to digits before creating a `wa.me` link. If either field is empty or invalid, that public action is hidden rather than replaced with a placeholder.

## Motion

Motion is intentionally restrained: product cards use a short staggered reveal, product images ease on hover, category indicators animate in place, carousel image changes cross-fade subtly, and option/CTA controls use small press states. The global `prefers-reduced-motion` rule disables these effects for customers who request reduced motion.
