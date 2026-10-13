"use client";

import {useMemo, useRef, useState} from "react";
import type {RefObject} from "react";
import {MessageCircle} from "lucide-react";
import {defaultSiteConfig} from "@/config/site";
import {formatPrice} from "@/lib/format";
import type {Product, SiteSettings} from "@/types/content";

type MissingField = "size" | "color" | null;

export function ProductInquiryPanel({
  product,
  settings,
  showPrice
}: {
  product: Product;
  settings: SiteSettings;
  showPrice: boolean;
}) {
  const sizes = product.sizes?.filter(Boolean) ?? [];
  const colors = product.colors?.filter(Boolean) ?? [];
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [missingField, setMissingField] = useState<MissingField>(null);
  const sizeRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);
  const whatsappNumber = settings.whatsappNumber?.replace(/[^\d]/g, "");
  const inquiriesEnabled = settings.enableInquiries ?? defaultSiteConfig.enableInquiries;
  const canInquire = inquiriesEnabled && Boolean(whatsappNumber && whatsappNumber.length >= 8);
  const price = showPrice && product.priceAgorot ? formatPrice(product.priceAgorot, product.currency) : "";

  const productPath = useMemo(() => `/products/${product.slug}/`, [product.slug]);

  function focusMissing(field: MissingField) {
    const target = field === "size" ? sizeRef.current : colorRef.current;
    target?.scrollIntoView({behavior: "smooth", block: "center"});
    const button = target?.querySelector("button");
    button?.focus({preventScroll: true});
  }

  function handleInquiry() {
    if (sizes.length && !selectedSize) {
      setMissingField("size");
      focusMissing("size");
      return;
    }

    if (colors.length && !selectedColor) {
      setMissingField("color");
      focusMissing("color");
      return;
    }

    if (!whatsappNumber) return;

    const productUrl =
      typeof window !== "undefined"
        ? new URL(productPath, window.location.origin).toString()
        : `${defaultSiteConfig.baseUrl}${productPath}`;
    const messageLines = [
      `היי! אשמח לברר לגבי ${product.name}.`,
      selectedSize ? `מידה: ${selectedSize}` : "",
      selectedColor ? `צבע: ${selectedColor}` : "",
      price ? `מחיר: ${price}` : "",
      `קישור למוצר: ${productUrl}`,
      "האם הפריט זמין?"
    ].filter(Boolean);
    const href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(messageLines.join("\n"))}`;

    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <div className={canInquire ? "pb-24 md:pb-0" : undefined}>
      <div className="grid gap-6 border-b border-[var(--border)] py-7">
        {sizes.length ? (
          <OptionGroup
            containerRef={sizeRef}
            label="מידה"
            options={sizes}
            selected={selectedSize}
            missing={missingField === "size"}
            onSelect={(value) => {
              setSelectedSize(value);
              setMissingField(null);
            }}
          />
        ) : null}
        {colors.length ? (
          <OptionGroup
            containerRef={colorRef}
            label="צבע"
            options={colors}
            selected={selectedColor}
            missing={missingField === "color"}
            onSelect={(value) => {
              setSelectedColor(value);
              setMissingField(null);
            }}
            swatches
          />
        ) : null}
      </div>

      {canInquire ? (
        <>
          <div className="hidden py-8 md:block">
            <InquiryButton onClick={handleInquiry} />
          </div>
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[rgba(251,250,248,0.94)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
            <InquiryButton onClick={handleInquiry} />
          </div>
        </>
      ) : null}
    </div>
  );
}

const colorMap: Record<string, string> = {
  "לבן": "#f7f5ef",
  "שנהב": "#e7dfd1",
  "שמנת": "#efe5d3",
  "חול": "#cfc3af",
  "שחור": "#111111",
  "זית": "#6f7358",
  "ירוק מרווה": "#8f9a82",
  "חום": "#6b5141",
  "חום קקאו": "#6a5146",
  "חמרה": "#a06752",
  "אפור אבן": "#aaa69e",
  "כחול בהיר": "#bad0df",
  "כחול שטיפה בינונית": "#657f99"
};

function OptionGroup({
  label,
  options,
  selected,
  missing,
  onSelect,
  swatches,
  containerRef
}: {
  label: string;
  options: string[];
  selected: string;
  missing: boolean;
  onSelect: (value: string) => void;
  swatches?: boolean;
  containerRef?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={containerRef}>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-base font-normal">{label}:</h2>
        {missing ? <p className="text-sm font-semibold text-[var(--ink)]">בחרי {label} כדי להמשיך</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selected === option;
          const color = colorMap[option];

          return (
            <button
              type="button"
              className={`tap inline-flex items-center justify-center border bg-white px-4 text-sm transition ${
                isSelected ? "border-[var(--ink)] shadow-[inset_0_0_0_1px_var(--ink)]" : "border-[var(--border)] hover:border-[var(--stone)]"
              } ${swatches ? "gap-2 rounded-full pl-4 pr-2" : "min-w-12 rounded"}`}
              onClick={() => onSelect(option)}
              aria-pressed={isSelected}
              key={option}
            >
              {swatches && color ? (
                <span
                  className="h-6 w-6 rounded-full border border-[var(--border)]"
                  style={{backgroundColor: color}}
                  aria-hidden="true"
                />
              ) : null}
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InquiryButton({onClick}: {onClick: () => void}) {
  return (
    <button
      type="button"
      className="tap inline-flex w-full items-center justify-center gap-2 rounded bg-[var(--charcoal)] px-5 text-sm font-semibold text-white transition hover:bg-black md:w-auto md:min-w-72"
      onClick={onClick}
    >
      <MessageCircle size={19} />
      לפרטים והזמנה בוואטסאפ
    </button>
  );
}
