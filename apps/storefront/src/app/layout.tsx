import type {Metadata} from "next";
import "./globals.css";
import {defaultSiteConfig} from "@/config/site";
import {SiteFooter} from "@/components/SiteFooter";
import {SiteHeader} from "@/components/SiteHeader";
import {getSiteSettings} from "@/lib/queries";

export const metadata: Metadata = {
  metadataBase: new URL(defaultSiteConfig.baseUrl),
  title: {
    default: defaultSiteConfig.displayName,
    template: `%s | ${defaultSiteConfig.displayName}`
  },
  description: defaultSiteConfig.description,
  openGraph: {
    title: defaultSiteConfig.displayName,
    description: defaultSiteConfig.description,
    locale: "he_IL",
    type: "website"
  }
};

export default async function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  const settings = await getSiteSettings();

  return (
    <html lang="he" dir="rtl">
      <body>
        <SiteHeader settings={settings} />
        <main>{children}</main>
        <SiteFooter settings={settings} />
      </body>
    </html>
  );
}
