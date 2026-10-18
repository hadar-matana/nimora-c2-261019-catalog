"use client";

import Image from "next/image";
import {ChevronLeft, ChevronRight} from "lucide-react";
import {useRef, useState} from "react";
import {imageAlt, imageUrl} from "@/lib/sanity";
import type {SanityImage} from "@/types/content";

export function ProductGallery({images, productName}: {images: SanityImage[]; productName: string}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStart = useRef<number | null>(null);
  const pointerStart = useRef<number | null>(null);
  const mouseStart = useRef<number | null>(null);
  const lastSwipeAt = useRef(0);
  const active = images[activeIndex] ?? images[0];
  const hasMultipleImages = images.length > 1;

  const showPrevious = () => setActiveIndex((index) => (index === 0 ? images.length - 1 : index - 1));
  const showNext = () => setActiveIndex((index) => (index === images.length - 1 ? 0 : index + 1));

  function handleTouchEnd(clientX: number) {
    if (touchStart.current === null || !hasMultipleImages) return;

    const distance = clientX - touchStart.current;
    touchStart.current = null;
    handleSwipeDistance(distance);
  }

  function handleSwipeDistance(distance: number) {
    if (Math.abs(distance) < 36) return;
    const now = Date.now();
    if (now - lastSwipeAt.current < 90) return;
    lastSwipeAt.current = now;

    if (distance > 0) {
      showPrevious();
    } else {
      showNext();
    }
  }

  return (
    <div className="space-y-4">
      <div
        className="relative aspect-[4/5] overflow-hidden bg-[var(--warm)] md:aspect-[5/6]"
        onTouchStart={(event) => {
          touchStart.current = event.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
        onPointerDown={(event) => {
          pointerStart.current = event.clientX;
        }}
        onPointerUp={(event) => {
          if (pointerStart.current === null || !hasMultipleImages) return;
          const distance = event.clientX - pointerStart.current;
          pointerStart.current = null;
          handleSwipeDistance(distance);
        }}
        onMouseDown={(event) => {
          mouseStart.current = event.clientX;
        }}
        onMouseUp={(event) => {
          if (mouseStart.current === null || !hasMultipleImages) return;
          const distance = event.clientX - mouseStart.current;
          mouseStart.current = null;
          handleSwipeDistance(distance);
        }}
        onMouseLeave={() => {
          mouseStart.current = null;
        }}
      >
        {active ? (
          <Image
            key={activeIndex}
            src={imageUrl(active, 1200, 1500)}
            alt={imageAlt(active, productName)}
            fill
            sizes="(min-width: 1024px) 56vw, 100vw"
            className="gallery-active-image object-cover"
            priority
          />
        ) : null}
        {hasMultipleImages ? (
          <>
            <button
              type="button"
              className="tap absolute left-3 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/78 text-[var(--ink)] backdrop-blur transition hover:bg-white md:inline-flex"
              onClick={showNext}
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              onMouseUp={(event) => event.stopPropagation()}
              aria-label="התמונה הבאה"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              className="tap absolute right-3 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/78 text-[var(--ink)] backdrop-blur transition hover:bg-white md:inline-flex"
              onClick={showPrevious}
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              onMouseUp={(event) => event.stopPropagation()}
              aria-label="התמונה הקודמת"
            >
              <ChevronRight size={22} />
            </button>
          </>
        ) : null}
      </div>
      {hasMultipleImages ? (
        <>
          <div className="flex justify-center gap-2 md:hidden" aria-label="מיקום תמונה בגלריה">
            {images.map((image, index) => (
              <button
                type="button"
                className={`gallery-dot tap inline-flex items-center justify-center ${index === activeIndex ? "is-selected" : ""}`}
                key={image._key ?? image.asset?._id ?? index}
                onClick={() => setActiveIndex(index)}
                aria-label={`הצג תמונה ${index + 1}`}
                aria-current={index === activeIndex}
              ><span className={`h-1.5 w-1.5 rounded-full ${index === activeIndex ? "bg-[var(--ink)]" : "bg-[var(--stone)]"}`} /></button>
            ))}
          </div>
          <div className="hidden grid-cols-5 gap-3 md:grid">
            {images.map((image, index) => (
              <button
                type="button"
                className={`gallery-thumb relative aspect-[3/4] overflow-hidden border bg-[var(--warm)] ${
                  index === activeIndex ? "border-[var(--ink)]" : "border-transparent"
                }`}
                key={image._key ?? image.asset?._id ?? index}
                onClick={() => setActiveIndex(index)}
                aria-label={`הצג תמונה ${index + 1}`}
              >
                <Image src={imageUrl(image, 300, 400)} alt="" fill sizes="120px" className="object-cover" />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
