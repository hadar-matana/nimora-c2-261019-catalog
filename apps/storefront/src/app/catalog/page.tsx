import type {Metadata} from "next";
import {CatalogClient} from "@/components/CatalogClient";
import {getAllCategories, getAllProducts, getSiteSettings} from "@/lib/queries";

export const metadata: Metadata = {
  title: "הקולקציה",
  description: "גלו את הפריטים שלנו ובחרו את הסגנון שלכן."
};

export default async function CatalogPage() {
  const [products, categories, settings] = await Promise.all([
    getAllProducts(),
    getAllCategories(),
    getSiteSettings()
  ]);

  return (
    <section className="container pb-12 pt-4 md:pb-18 md:pt-6">
      <div className="collection-heading"><h1 className="text-3xl font-normal md:text-4xl">הקולקציה</h1><span>{products.length} פריטים</span></div>
      <CatalogClient products={products} categories={categories} showPrices={settings.showPrices ?? true} />
    </section>
  );
}
