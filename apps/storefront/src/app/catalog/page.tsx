import type {Metadata} from "next";
import {CatalogClient} from "@/components/CatalogClient";
import {getAllCategories, getAllCollections, getAllProducts, getSiteSettings} from "@/lib/queries";

export const metadata: Metadata = {
  title: "קטלוג",
  description: "קטלוג אופנה עם חיפוש, סינון לפי קטגוריה וקולקציה, ודפי פריט."
};

export default async function CatalogPage() {
  const [products, categories, collections, settings] = await Promise.all([
    getAllProducts(),
    getAllCategories(),
    getAllCollections(),
    getSiteSettings()
  ]);

  return (
    <section className="container py-10 md:py-16">
      <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div className="max-w-3xl space-y-4">
          <p className="section-label">קטלוג</p>
          <h1 className="text-5xl font-light leading-tight md:text-7xl">כל הפריטים במקום אחד, בלי עומס של חנות אונליין.</h1>
        </div>
        <p className="max-w-sm text-[var(--muted)]">אפשר לסנן לפי קטגוריה וקולקציה, לחפש לפי שם פריט ולפתוח כל פריט לפרטים נוספים.</p>
      </div>
      <CatalogClient
        products={products}
        categories={categories}
        collections={collections}
        showPrices={settings.showPrices ?? true}
      />
    </section>
  );
}
