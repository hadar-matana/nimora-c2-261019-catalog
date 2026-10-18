import type {CSSProperties} from "react";
import {storefrontBrand} from "@/lib/brand";
import type {Metadata} from "next";
import "./globals.css";
import {defaultSiteConfig} from "@/config/site";
import {SiteFooter} from "@/components/SiteFooter";
import {SiteHeader} from "@/components/SiteHeader";
import {getSiteSettings} from "@/lib/queries";

export async function generateMetadata(): Promise<Metadata> {
  const brand = storefrontBrand(await getSiteSettings());
  return {
    metadataBase: new URL(defaultSiteConfig.baseUrl),
    title: {default: brand.name, template: `%s | ${brand.name}`},
    description: brand.description,
    openGraph: {title: brand.name, description: brand.description, locale: "he_IL", type: "website", ...(brand.logo ? {images: [brand.logo]} : {})}
  };
}

export default async function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  const settings = await getSiteSettings();
  const brand = storefrontBrand(settings);
  const colors = brand.accentColor ? {"--accent": brand.accentColor, "--accent-contrast": brand.accentContrastColor ?? "#ffffff"} as CSSProperties : undefined;

  return (
    <html lang="he" dir="rtl">
      <body style={colors}>
        <a href="#main-content" className="sr-only focus:not-sr-only">דילוג לתוכן</a>
        <SiteHeader settings={settings} />
        <main id="main-content">{children}</main>
        <SiteFooter settings={settings} />
      </body>
    </html>
  );
}
