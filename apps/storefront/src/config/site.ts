export const defaultSiteConfig = {
  displayName: "ATELIER",
  description: "קטלוג אופנה מינימליסטי לפריטי בוטיק, מחירים ופניות WhatsApp.",
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://fashion-catalog-demo.pages.dev",
  studioUrl: process.env.NEXT_PUBLIC_STUDIO_URL ?? "https://fashion-catalog-demo.sanity.studio",
  instagramUrl: "",
  whatsappNumber: "",
  showPrices: true,
  enableInquiries: true,
  demoMode: false,
  currency: "ILS"
};

export const sanityConfig = {
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "3ahm0828",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2025-02-19"
};
