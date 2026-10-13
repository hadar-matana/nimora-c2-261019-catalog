import {defaultSiteConfig} from "@/config/site";

export const dynamic = "force-static";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/"
    },
    sitemap: `${defaultSiteConfig.baseUrl}/sitemap.xml`
  };
}
