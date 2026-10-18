import {cmsTarget, deploymentKind, publicUrl} from "../../../../packages/config/deployment.mjs";

export const deployment = deploymentKind(process.env.NEXT_PUBLIC_DEPLOYMENT_KIND);
export const defaultSiteConfig = {
  displayName: deployment === "demo" ? "ATELIER" : "",
  description: deployment === "demo" ? "גלו את הקולקציה ואת הפריטים שלנו." : "",
  baseUrl: publicUrl(process.env.NEXT_PUBLIC_SITE_URL, "storefront URL"),
  studioUrl: process.env.NEXT_PUBLIC_STUDIO_URL ? publicUrl(process.env.NEXT_PUBLIC_STUDIO_URL, "Studio URL") : "",
  instagramUrl: "",
  whatsappNumber: "",
  showPrices: true,
  enableInquiries: true,
  demoMode: false,
  currency: "ILS"
};
const target = cmsTarget(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID, process.env.NEXT_PUBLIC_SANITY_DATASET, process.env.NEXT_PUBLIC_SANITY_API_VERSION);
export const sanityConfig = {projectId: target.projectId, dataset: target.dataset, apiVersion: target.apiVersion};
