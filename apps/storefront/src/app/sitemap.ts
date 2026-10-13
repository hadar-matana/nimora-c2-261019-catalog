import type {MetadataRoute} from "next";
import {defaultSiteConfig} from "@/config/site";
import {getProductSlugs} from "@/lib/queries";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getProductSlugs();
  const staticRoutes = ["", "/gallery", "/catalog"].map((route) => ({
    url: `${defaultSiteConfig.baseUrl}${route}`,
    lastModified: new Date()
  }));

  return [
    ...staticRoutes,
    ...slugs.map((slug) => ({
      url: `${defaultSiteConfig.baseUrl}/products/${slug}`,
      lastModified: new Date()
    }))
  ];
}
