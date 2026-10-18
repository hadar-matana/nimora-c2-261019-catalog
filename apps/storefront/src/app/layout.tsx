import type {Metadata} from "next";
import "./globals.css";
import {defaultSiteConfig} from "@/config/site";
import {SiteFooter} from "@/components/SiteFooter";
import {SiteHeader} from "@/components/SiteHeader";
import {getSiteSettings} from "@/lib/queries";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const name = settings.displayName?.trim() || defaultSiteConfig.displayName;
  const description = settings.description || defaultSiteConfig.description;
  return {
    metadataBase: new URL(defaultSiteConfig.baseUrl),
    title: {default: name, template: `%s | ${name}`},
    description,
    openGraph: {title: name, description, locale: "he_IL", type: "website"}
  };
}

export default async function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  const settings = await getSiteSettings();

  return (
    <html lang="he" dir="rtl">
      <body>
        <a href="#main-content" className="skip-link">דילוג לתוכן</a>
        <SiteHeader settings={settings} />
        <main id="main-content">{children}</main>
        <SiteFooter settings={settings} />
      </body>
    </html>
  );
}
