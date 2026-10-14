import type {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "next/link";
import {ArrowRight} from "lucide-react";
import {ProductCard} from "@/components/ProductCard";
import {ProductGallery} from "@/components/ProductGallery";
import {ProductInquiryPanel} from "@/components/ProductInquiryPanel";
import {formatPrice} from "@/lib/format";
import {getProductBySlug, getProductSlugs, getRelatedProducts, getSiteSettings} from "@/lib/queries";

type ProductPageProps = {
  params: Promise<{slug: string}>;
};

export async function generateStaticParams() {
  const slugs = await getProductSlugs();
  return slugs.map((slug) => ({slug}));
}

export async function generateMetadata({params}: ProductPageProps): Promise<Metadata> {
  const {slug} = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};

  return {
    title: product.name,
    description: product.description ?? `${product.name} בקטלוג האופנה`
  };
}

export default async function ProductPage({params}: ProductPageProps) {
  const {slug} = await params;
  const [product, settings] = await Promise.all([getProductBySlug(slug), getSiteSettings()]);

  if (!product) {
    notFound();
  }

  const related = await getRelatedProducts(product._id, product.category?._id, 4);
  const showPrices = settings.showPrices ?? true;
  const context = [product.category?.name, ...(product.collections?.map((collection) => collection.name) ?? [])].filter(Boolean).join(" / ");

  return (
    <section className="container py-5 md:py-10">
      <Link href="/catalog" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] md:mb-8">
        <ArrowRight size={18} />
        חזרה לקטלוג
      </Link>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.14fr)_minmax(360px,0.86fr)] lg:gap-16">
        <ProductGallery images={product.images} productName={product.name} />

        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="border-b border-[var(--border)] pb-7">
            {context ? <p className="mb-4 text-sm text-[var(--muted)]">{context}</p> : null}
            <h1 className="text-3xl font-normal leading-tight md:text-5xl">{product.name}</h1>
            {showPrices && product.priceAgorot ? (
              <p className="mt-4 text-xl font-semibold md:text-2xl">{formatPrice(product.priceAgorot, product.currency)}</p>
            ) : null}
            {product.description ? <p className="mt-6 text-lg leading-8 text-[var(--muted)]">{product.description}</p> : null}
          </div>

          <ProductInquiryPanel product={product} settings={settings} showPrice={showPrices} />
        </div>
      </div>

      {related.length ? (
        <section className="mt-18 space-y-8 md:mt-28">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="section-label mb-3">עוד באותו סגנון</p>
              <h2 className="text-3xl font-normal">פריטים קשורים</h2>
            </div>
            <Link href="/catalog" className="text-sm font-semibold underline underline-offset-4">
              לקטלוג
            </Link>
          </div>
          <div className="balanced-grid">
            {related.map((item, index) => (
              <ProductCard product={item} index={index} key={item._id} showPrice={showPrices} />
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
