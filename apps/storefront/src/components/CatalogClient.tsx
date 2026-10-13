"use client";

import {useMemo, useState} from "react";
import {ProductCard} from "@/components/ProductCard";
import type {Category, Product} from "@/types/content";

export function CatalogClient({
  products,
  categories,
  showPrices
}: {
  products: Product[];
  categories: Category[];
  showPrices: boolean;
}) {
  const [category, setCategory] = useState("all");

  const filteredProducts = useMemo(() => {
    if (category === "all") return products;
    return products.filter((product) => product.category?.slug === category);
  }, [category, products]);

  return (
    <div className="space-y-6">
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="flex min-w-max items-center justify-center gap-5 border-b border-[var(--border)] pb-3 text-sm md:min-w-0 md:gap-8 md:text-base">
          <CategoryButton label="הכל" selected={category === "all"} onClick={() => setCategory("all")} />
          {categories.map((item) => (
            <CategoryButton
              label={item.name}
              selected={category === item.slug}
              onClick={() => setCategory(item.slug)}
              key={item._id}
            />
          ))}
        </div>
      </div>

      {filteredProducts.length ? (
        <div className="balanced-grid">
          {filteredProducts.map((product) => (
            <ProductCard product={product} showPrice={showPrices} key={product._id} />
          ))}
        </div>
      ) : (
        <div className="flex min-h-64 flex-col items-center justify-center border border-dashed border-[var(--border)] bg-white/50 p-8 text-center">
          <h2 className="text-2xl font-light">אין פריטים בקטגוריה הזו</h2>
          <button type="button" className="tap mt-3 text-sm font-semibold underline underline-offset-4" onClick={() => setCategory("all")}>
            חזרה לכל הפריטים
          </button>
        </div>
      )}
    </div>
  );
}

function CategoryButton({
  label,
  selected,
  onClick
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`tap relative px-1 pb-1 transition ${selected ? "text-[var(--ink)]" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      {label}
      {selected ? <span className="absolute inset-x-0 -bottom-[13px] h-px bg-[var(--ink)]" aria-hidden="true" /> : null}
    </button>
  );
}
