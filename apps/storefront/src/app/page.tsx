import type {Metadata} from "next";
import Image from 'next/image';
import Link from 'next/link';
import {CatalogClient} from "@/components/CatalogClient";
import {getAllCategories, getAllProducts, getSiteSettings} from "@/lib/queries";
import {imageAlt, imageUrl} from '@/lib/sanity';
import {defaultSiteConfig} from '@/config/site';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {title: {absolute: settings.displayName?.trim() || defaultSiteConfig.displayName}, description: settings.description || defaultSiteConfig.description};
}
export default async function HomePage() {
  const [products, categories, settings] = await Promise.all([getAllProducts(), getAllCategories(), getSiteSettings()]);
  const hero = products.find(product => product.featured && product.images?.[0]?.asset) ?? products.find(product => product.images?.[0]?.asset);
  const image = hero?.images[0];
  return <>
    <section className={`container editorial-hero ${image ? '' : 'without-image'}`} aria-label="הקולקציה שלנו">
      <div className="hero-copy">
        <p className="section-label">הקולקציה שלנו</p>
        <h1 className="hero-brand" dir="auto">{settings.displayName?.trim() || defaultSiteConfig.displayName}</h1>
        {settings.description?.trim() && <p className="hero-description" dir="auto">{settings.description}</p>}
        <a href="#collection" className="editorial-link">לגלות את הפריטים <span aria-hidden="true">↓</span></a>
        <Link href="/about" className="hero-about">קצת עלינו <span aria-hidden="true">←</span></Link>
      </div>
      {image && hero && <Link href={`/products/${hero.slug}`} className="hero-image" aria-label={`לצפייה בפריט: ${hero.name}`}>
        <Image src={imageUrl(image, 1400, 1700)} alt={imageAlt(image, hero.name)} fill sizes="(min-width: 768px) 54vw, 92vw" className="object-cover" preload />
        <span className="hero-caption"><span>{hero.name}</span><span aria-hidden="true">←</span></span>
      </Link>}
    </section>
    <section id="collection" className="container collection-section">
      <div className="collection-heading"><h2>הפריטים שלנו</h2><span>{products.length} פריטים</span></div>
      <CatalogClient products={products} categories={categories} showPrices={settings.showPrices ?? true} />
    </section>
  </>;
}
