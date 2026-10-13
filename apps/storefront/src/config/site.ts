export const defaultSiteConfig = {
  displayName: "גלריית אופנה",
  description: "דמו קטלוג אופנה לבוטיקים: גלריה, מוצרים וניהול תוכן אמיתי.",
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://fashion-catalog-demo.pages.dev",
  studioUrl: process.env.NEXT_PUBLIC_STUDIO_URL ?? "https://fashion-catalog-demo.sanity.studio",
  instagramUrl: "",
  whatsappNumber: "",
  showPrices: true,
  enableInquiries: true,
  demoMode: true,
  currency: "ILS"
};

export const sanityConfig = {
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "3ahm0828",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2025-02-19"
};
