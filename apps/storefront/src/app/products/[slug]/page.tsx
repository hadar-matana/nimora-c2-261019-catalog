import type {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "next/link";
import {ArrowLeft} from "lucide-react";
import {ProductCard} from "@/components/ProductCard";
import {ProductGallery} from "@/components/ProductGallery";
import {ProductInquiryButton} from "@/components/ProductInquiryButton";
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
  const enableInquiries = settings.enableInquiries ?? true;

  return (
    <section className="container py-8 md:py-14">
      <Link href="/catalog" className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)]">
        <ArrowLeft size={18} />
        חזרה לקטלוג
      </Link>

      <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <ProductGallery images={product.images} productName={product.name} />

        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="border-b border-[var(--border)] pb-8">
            <p className="section-label mb-4">{product.category?.name ?? "פריט"}</p>
            <h1 className="text-5xl font-light leading-tight md:text-7xl">{product.name}</h1>
            {showPrices && product.priceAgorot ? (
              <p className="mt-5 text-2xl font-semibold">{formatPrice(product.priceAgorot, product.currency)}</p>
            ) : null}
            {product.description ? <p className="mt-6 text-lg leading-8 text-[var(--muted)]">{product.description}</p> : null}
          </div>

          <div className="grid gap-6 border-b border-[var(--border)] py-8 sm:grid-cols-2">
            {product.sizes?.length ? (
              <div>
                <h2 className="mb-3 text-sm font-bold">מידות</h2>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((size) => (
                    <span className="border border-[var(--border)] bg-white px-3 py-2 text-sm" key={size}>
                      {size}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {product.colors?.length ? (
              <div>
                <h2 className="mb-3 text-sm font-bold">צבעים</h2>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((color) => (
                    <span className="border border-[var(--border)] bg-white px-3 py-2 text-sm" key={color}>
                      {color}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {enableInquiries ? (
            <div className="py-8">
              <ProductInquiryButton product={product} settings={settings} />
            </div>
          ) : null}
        </div>
      </div>

      {related.length ? (
        <section className="mt-20 space-y-8 md:mt-28">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="section-label mb-3">עוד באותו סגנון</p>
              <h2 className="text-4xl font-light">פריטים קשורים</h2>
            </div>
            <Link href="/catalog" className="text-sm font-bold text-[var(--olive)]">
              לקטלוג
            </Link>
          </div>
          <div className="balanced-grid">
            {related.map((item) => (
              <ProductCard product={item} key={item._id} showPrice={showPrices} />
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
