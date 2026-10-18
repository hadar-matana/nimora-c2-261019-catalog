import {brandConfig} from "../../../../packages/config/deployment.mjs";
import {deployment} from "@/config/site";
import {imageUrl} from "@/lib/sanity";
import type {SiteSettings} from "@/types/content";

export function storefrontBrand(settings: SiteSettings) {
  const brand = brandConfig(deployment, settings);
  return {...brand, logo: deployment === "client" ? imageUrl(settings.logo, 400) : ""};
}
