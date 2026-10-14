import Image from "next/image";
import Link from "next/link";
import {formatPrice} from "@/lib/format";
import {imageAlt, imageUrl} from "@/lib/sanity";
import type {Product} from "@/types/content";

export function ProductCard({product, showPrice, index = 0}: {product: Product; showPrice: boolean; index?: number}) {
  const mainImage = product.images?.[0];
  const secondaryImage = product.images?.[1];
  const price = showPrice && product.priceAgorot ? formatPrice(product.priceAgorot, product.currency) : undefined;
  const linkLabel = [product.name, product.category?.name, price].filter(Boolean).join(", ");

  return (
    <Link
      href={`/products/${product.slug}`}
      className="catalog-card group block"
      style={{animationDelay: `${Math.min(index, 11) * 42}ms`}}
      aria-label={linkLabel}
    >
      <article>
        <div className="relative aspect-[3/4] overflow-hidden bg-[var(--warm)]">
          {mainImage ? (
            <Image
              src={imageUrl(mainImage, 820, 1100)}
              alt={imageAlt(mainImage, product.name)}
              fill
              sizes="(min-width: 1180px) 24vw, (min-width: 768px) 32vw, 48vw"
              className="product-card-image object-cover transition duration-700 ease-out group-hover:scale-[1.025]"
            />
          ) : null}
          {secondaryImage ? (
            <Image
              src={imageUrl(secondaryImage, 820, 1100)}
              alt=""
              fill
              sizes="(min-width: 1180px) 24vw, (min-width: 768px) 32vw, 48vw"
              className="product-card-image absolute inset-0 object-cover opacity-0 transition duration-700 ease-out group-hover:scale-[1.025] group-hover:opacity-100"
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
