import Image from "next/image";
import Link from "next/link";
import {ArrowLeft, Images, ShoppingBag} from "lucide-react";
import {ProductCard} from "@/components/ProductCard";
import {imageAlt, imageUrl} from "@/lib/sanity";
import {getFeaturedProducts, getGalleryImages, getSiteSettings} from "@/lib/queries";

export default async function HomePage() {
  const [settings, featuredProducts, galleryImages] = await Promise.all([
    getSiteSettings(),
    getFeaturedProducts(4),
    getGalleryImages()
  ]);
  const heroImages = galleryImages.slice(0, 4);

  return (
    <div>
      <section className="container grid gap-10 pb-14 pt-8 md:grid-cols-[0.9fr_1.1fr] md:items-end md:pb-24 md:pt-16">
        <div className="space-y-7">
          <p className="section-label">קולקציה נבחרת</p>
          <h1 className="editorial-title">גלריה וקטלוג לפריטים שאפשר לראות, לשמור ולברר בקלות.</h1>
          <p className="max-w-xl text-lg leading-8 text-[var(--muted)]">
            תמונות גדולות, קטלוג מסודר ודפי פריט נקיים עוזרים לבחור את הלוק הבא בלי עומס מיותר.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link className="tap inline-flex items-center gap-2 bg-[var(--ink)] px-5 text-sm font-bold text-white" href="/catalog">
              <ShoppingBag size={18} />
              לקטלוג
            </Link>
            <Link className="tap inline-flex items-center gap-2 border border-[var(--ink)] px-5 text-sm font-bold" href="/gallery">
              <Images size={18} />
              לגלריה
            </Link>
          </div>
        </div>

        <div className="grid min-h-[430px] grid-cols-2 gap-3 md:min-h-[620px]">
          {heroImages.length === 0 ? (
            <div className="col-span-2 flex h-full items-center justify-center border border-dashed border-[var(--border)] bg-white/50 text-[var(--muted)]">
              תמונות הגלריה יופיעו כאן אחרי הסידינג הראשון.
            </div>
          ) : (
            heroImages.map((item, index) => (
              <div
                className="relative overflow-hidden bg-[var(--warm)]"
                style={{marginTop: index % 2 ? "56px" : "0"}}
                key={item._id}
              >
                <Image
                  src={imageUrl(item.image, 760, 980)}
                  alt={imageAlt(item.image, item.title ?? "תמונת גלריה")}
                  fill
                  sizes="(min-width: 768px) 28vw, 46vw"
                  className="object-cover"
                  priority={index < 2}
                />
              </div>
            ))
          )}
        </div>
      </section>

      <section className="border-y border-[var(--border)] bg-white/42">
        <div className="container grid gap-8 py-10 md:grid-cols-3 md:py-14">
          <div>
            <p className="section-label mb-3">01</p>
            <h2 className="text-2xl font-light">גלריה שמרגישה כמו לוקבוק</h2>
          </div>
          <div>
            <p className="section-label mb-3">02</p>
            <h2 className="text-2xl font-light">קטלוג עם חיפוש וסינון</h2>
          </div>
          <div>
            <p className="section-label mb-3">03</p>
            <h2 className="text-2xl font-light">פנייה מהירה לבירור זמינות</h2>
          </div>
        </div>
      </section>

      <section className="container space-y-8 py-16 md:py-24">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="section-label mb-3">פריטים נבחרים</p>
            <h2 className="text-4xl font-light md:text-5xl">כניסה מהירה לקטלוג</h2>
          </div>
          <Link href="/catalog" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--olive)]">
            כל הפריטים
            <ArrowLeft size={18} />
          </Link>
        </div>

        <div className="balanced-grid">
          {featuredProducts.map((product) => (
            <ProductCard product={product} key={product._id} showPrice={settings.showPrices ?? true} />
          ))}
        </div>
      </section>
    </div>
  );
}
