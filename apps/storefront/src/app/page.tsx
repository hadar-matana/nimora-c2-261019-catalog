import type {Metadata} from "next";
import {storefrontBrand} from "@/lib/brand";
import {CatalogClient} from "@/components/CatalogClient";
import {getAllCategories, getAllProducts, getSiteSettings} from "@/lib/queries";

export async function generateMetadata(): Promise<Metadata> {
  const brand = storefrontBrand(await getSiteSettings());
  return {title: {absolute: brand.name}};
}

export default async function HomePage() {
  const [products, categories, settings] = await Promise.all([
    getAllProducts(),
    getAllCategories(),
    getSiteSettings(),
  ]);

  return (
    <section className="container pb-12 pt-4 md:pb-18 md:pt-6">
      <CatalogClient products={products} categories={categories} showPrices={settings.showPrices ?? true} />
    </section>
  );
}
