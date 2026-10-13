"use client";

import Image from "next/image";
import Link from "next/link";
import {useEffect, useMemo, useState} from "react";
import {ArrowLeft, ArrowRight, X} from "lucide-react";
import {imageAlt, imageUrl} from "@/lib/sanity";
import type {Category, Collection, GalleryImage} from "@/types/content";

export function GalleryClient({
  images,
  categories,
  collections
}: {
  images: GalleryImage[];
  categories: Category[];
  collections: Collection[];
}) {
  const [filter, setFilter] = useState("all");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const filteredImages = useMemo(() => {
    if (filter === "all") return images;
    return images.filter((item) => item.category?.slug === filter || item.collection?.slug === filter);
  }, [filter, images]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (activeIndex === null) return;
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowLeft") setActiveIndex((activeIndex + 1) % filteredImages.length);
      if (event.key === "ArrowRight") setActiveIndex((activeIndex - 1 + filteredImages.length) % filteredImages.length);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, filteredImages.length]);

  const active = activeIndex === null ? null : filteredImages[activeIndex];
  const safeActiveIndex = activeIndex ?? 0;

  return (
    <div>
      <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
        <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
          הכל
        </FilterButton>
        {[...categories, ...collections].map((item) => (
          <FilterButton active={filter === item.slug} onClick={() => setFilter(item.slug)} key={item._id}>
            {item.name}
          </FilterButton>
        ))}
      </div>

      {filteredImages.length ? (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {filteredImages.map((item, index) => (
            <button
              type="button"
              className="group mb-4 block w-full break-inside-avoid overflow-hidden bg-white text-right"
              key={item._id}
              onClick={() => setActiveIndex(index)}
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-[var(--warm)]">
                <Image
                  src={imageUrl(item.image, 900)}
                  alt={imageAlt(item.image, item.title ?? "תמונת גלריה")}
                  fill
                  sizes="(min-width: 1024px) 31vw, (min-width: 640px) 45vw, 92vw"
                  className="object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              </div>
              {(item.title || item.caption) && (
                <div className="border-x border-b border-[var(--border)] p-4">
                  <h2 className="font-semibold">{item.title}</h2>
                  {item.caption ? <p className="mt-1 text-sm text-[var(--muted)]">{item.caption}</p> : null}
                </div>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex min-h-64 items-center justify-center border border-dashed border-[var(--border)] bg-white/50 p-8 text-center text-[var(--muted)]">
          אין תמונות בסינון הזה.
        </div>
      )}

      {active ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[rgba(23,20,18,0.86)] p-4"
          role="dialog"
          aria-modal="true"
          aria-label={active.title ?? "תמונה מוגדלת"}
          onClick={() => setActiveIndex(null)}
        >
          <div className="relative grid w-full max-w-6xl gap-4 md:grid-cols-[1fr_320px]" onClick={(event) => event.stopPropagation()}>
            <div className="relative min-h-[58vh] overflow-hidden bg-black md:min-h-[82vh]">
              <Image
                src={imageUrl(active.image, 1500)}
                alt={imageAlt(active.image, active.title ?? "תמונה מוגדלת")}
                fill
                sizes="100vw"
                className="object-contain"
              />
            </div>
            <aside className="bg-[var(--background)] p-5">
              <div className="mb-8 flex items-center justify-between">
                <p className="section-label">{active.category?.name || active.collection?.name || "גלריה"}</p>
                <button type="button" className="tap inline-flex items-center justify-center" onClick={() => setActiveIndex(null)} aria-label="סגירה">
                  <X size={22} />
                </button>
              </div>
              <h2 className="text-3xl font-light">{active.title}</h2>
              {active.caption ? <p className="mt-3 leading-7 text-[var(--muted)]">{active.caption}</p> : null}
              {active.product?.slug ? (
                <Link className="tap mt-6 inline-flex items-center border border-[var(--ink)] px-4 text-sm font-bold" href={`/products/${active.product.slug}`}>
                  צפייה בפריט
                </Link>
              ) : null}
              <div className="mt-8 flex gap-2">
                <button
                  type="button"
                  className="tap inline-flex items-center justify-center border border-[var(--border)] px-4"
                  onClick={() => setActiveIndex((safeActiveIndex - 1 + filteredImages.length) % filteredImages.length)}
                  aria-label="תמונה קודמת"
                >
                  <ArrowRight size={20} />
                </button>
                <button
                  type="button"
                  className="tap inline-flex items-center justify-center border border-[var(--border)] px-4"
                  onClick={() => setActiveIndex((safeActiveIndex + 1) % filteredImages.length)}
                  aria-label="תמונה הבאה"
                >
                  <ArrowLeft size={20} />
                </button>
              </div>
            </aside>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterButton({active, onClick, children}: {active: boolean; onClick: () => void; children: React.ReactNode}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap shrink-0 border px-4 text-sm font-bold ${
        active ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--border)] bg-white"
      }`}
    >
      {children}
    </button>
  );
}
