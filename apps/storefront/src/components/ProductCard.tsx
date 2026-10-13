import Image from "next/image";
import Link from "next/link";
import {formatPrice} from "@/lib/format";
import {imageAlt, imageUrl} from "@/lib/sanity";
import type {Product} from "@/types/content";

export function ProductCard({product, showPrice}: {product: Product; showPrice: boolean}) {
  const mainImage = product.images?.[0];
  const price = showPrice && product.priceAgorot ? formatPrice(product.priceAgorot, product.currency) : undefined;
  const linkLabel = [product.name, product.category?.name, price].filter(Boolean).join(", ");

  return (
    <Link href={`/products/${product.slug}`} className="group block" aria-label={linkLabel}>
      <article className="space-y-4">
        <div className="relative aspect-[4/5] overflow-hidden bg-[var(--warm)]">
          {mainImage ? (
            <Image
              src={imageUrl(mainImage, 720, 900)}
              alt={imageAlt(mainImage, product.name)}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 92vw"
              className="object-cover transition duration-500 group-hover:scale-[1.035]"
            />
          ) : null}
          <div className="absolute inset-x-0 top-0 flex justify-between p-3 text-xs font-bold">
            {product.isNew ? <span className="bg-white px-2 py-1">חדש</span> : <span />}
            {product.featured ? <span className="bg-[var(--ink)] px-2 py-1 text-white">נבחר</span> : null}
          </div>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold leading-snug">{product.name}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{product.category?.name}</p>
          </div>
          {price ? (
            <p className="shrink-0 text-sm font-bold">{price}</p>
          ) : null}
        </div>
      </article>
    </Link>
  );
}
