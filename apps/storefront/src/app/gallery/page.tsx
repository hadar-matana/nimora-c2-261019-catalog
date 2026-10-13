import type {Metadata} from "next";
import {GalleryClient} from "@/components/GalleryClient";
import {getAllCategories, getAllCollections, getGalleryImages} from "@/lib/queries";

export const metadata: Metadata = {
  title: "גלריה",
  description: "גלריית תמונות אופנה מסוננת לפי קטגוריות וקולקציות."
};

export default async function GalleryPage() {
  const [images, categories, collections] = await Promise.all([getGalleryImages(), getAllCategories(), getAllCollections()]);

  return (
    <section className="container py-10 md:py-16">
      <div className="mb-10 max-w-3xl space-y-4">
        <p className="section-label">גלריה</p>
        <h1 className="text-5xl font-light leading-tight md:text-7xl">תמונות גדולות, סינון פשוט, והשראה לפני בחירת פריט.</h1>
      </div>
      <GalleryClient images={images} categories={categories} collections={collections} />
    </section>
  );
}
