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
      <article>
        <div className="relative aspect-[3/4] overflow-hidden bg-[var(--warm)]">
          {mainImage ? (
            <Image
              src={imageUrl(mainImage, 820, 1100)}
              alt={imageAlt(mainImage, product.name)}
              fill
              sizes="(min-width: 1180px) 24vw, (min-width: 768px) 32vw, 48vw"
              className="object-cover transition duration-700 ease-out group-hover:scale-[1.025]"
            />
          ) : null}
        </div>
        <div className="pt-2 text-center md:pt-3">
          <h2 className="text-base font-normal leading-snug md:text-lg">{product.name}</h2>
          {price ? (
            <p className="mt-1 text-sm font-semibold md:text-base">{price}</p>
          ) : null}
        </div>
      </article>
    </Link>
  );
}
