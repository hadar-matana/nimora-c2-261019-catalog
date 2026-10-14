"use client";

import {useMemo, useState} from "react";
import {MessageCircle} from "lucide-react";
import {createProductWhatsappHref, getContactLinks} from "@/lib/contact";
import type {Product, SiteSettings} from "@/types/content";

export function ProductInquiryPanel({
  product,
  settings
}: {
  product: Product;
  settings: SiteSettings;
}) {
  const sizes = product.sizes?.filter(Boolean) ?? [];
  const colors = product.colors?.filter(Boolean) ?? [];
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const {whatsappNumber} = getContactLinks(settings);
  const canInquire = Boolean(whatsappNumber);

  const productPath = useMemo(() => `/products/${product.slug}/`, [product.slug]);

  function handleInquiry() {
    if (!whatsappNumber) return;

    const productUrl =
      typeof window !== "undefined"
        ? new URL(productPath, window.location.origin).toString()
        : productPath;
    const href = createProductWhatsappHref({
      number: whatsappNumber,
      product,
      selectedSize,
      selectedColor,
      productUrl
    });

    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <div className={canInquire ? "pb-28 md:pb-0" : undefined}>
      <div className="grid gap-6 border-b border-[var(--border)] py-7">
        {sizes.length ? (
          <OptionGroup
            label="מידה"
            options={sizes}
            selected={selectedSize}
            onSelect={setSelectedSize}
          />
        ) : null}
        {colors.length ? (
          <OptionGroup
            label="צבע"
            options={colors}
            selected={selectedColor}
            onSelect={setSelectedColor}
            swatches
          />
        ) : null}
      </div>

      {canInquire ? (
        <>
          <div className="hidden py-8 md:block">
            <InquiryButton onClick={handleInquiry} />
          </div>
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[rgba(251,250,248,0.94)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(15,15,15,0.06)] backdrop-blur md:hidden">
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
  onSelect,
  swatches
}: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  swatches?: boolean;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-base font-normal">{label}:</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selected === option;
          const color = colorMap[option];

          return (
            <button
              type="button"
              className={`tap option-button inline-flex items-center justify-center border bg-white px-4 text-sm transition ${
                isSelected ? "is-selected border-[var(--ink)] shadow-[inset_0_0_0_1px_var(--ink)]" : "border-[var(--border)] hover:border-[var(--stone)]"
              } ${swatches ? "gap-2 rounded-full pl-4 pr-2" : "min-w-12 rounded"}`}
              onPointerDown={() => onSelect(option)}
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
      className="tap cta-button inline-flex w-full items-center justify-center gap-2 rounded bg-[var(--charcoal)] px-5 text-sm font-semibold text-white transition md:w-auto md:min-w-72"
      onClick={onClick}
    >
      <MessageCircle size={19} />
      לפרטים והזמנה בוואטסאפ
    </button>
  );
}
