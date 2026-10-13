"use client";

import Image from "next/image";
import {useState} from "react";
import {imageAlt, imageUrl} from "@/lib/sanity";
import type {SanityImage} from "@/types/content";

export function ProductGallery({images, productName}: {images: SanityImage[]; productName: string}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/5] overflow-hidden bg-[var(--warm)]">
        {active ? (
          <Image
            src={imageUrl(active, 1200, 1500)}
            alt={imageAlt(active, productName)}
            fill
            sizes="(min-width: 1024px) 52vw, 100vw"
            className="object-cover"
            priority
          />
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {images.map((image, index) => (
            <button
              type="button"
              className={`relative aspect-[4/5] overflow-hidden border ${
                index === activeIndex ? "border-[var(--ink)]" : "border-transparent"
              }`}
              key={image._key ?? image.asset?._id ?? index}
              onClick={() => setActiveIndex(index)}
              aria-label={`הצג תמונה ${index + 1}`}
            >
              <Image src={imageUrl(image, 280, 350)} alt="" fill sizes="120px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
