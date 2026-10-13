"use client";

import {useMemo, useState} from "react";
import {Search, SlidersHorizontal, X} from "lucide-react";
import {ProductCard} from "@/components/ProductCard";
import type {Category, Collection, Product} from "@/types/content";

type SortMode = "default" | "price-asc" | "price-desc" | "featured";

export function CatalogClient({
  products,
  categories,
  collections,
  showPrices
}: {
  products: Product[];
  categories: Category[];
  collections: Collection[];
  showPrices: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [collection, setCollection] = useState("all");
  const [sort, setSort] = useState<SortMode>("default");
  const [featuredOnly, setFeaturedOnly] = useState(false);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const list = products.filter((product) => {
      const matchesQuery =
        !normalizedQuery ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.description?.toLowerCase().includes(normalizedQuery);
      const matchesCategory = category === "all" || product.category?.slug === category;
      const matchesCollection = collection === "all" || product.collections?.some((item) => item.slug === collection);
      const matchesFeatured = !featuredOnly || product.featured || product.isNew;
      return matchesQuery && matchesCategory && matchesCollection && matchesFeatured;
    });

    return [...list].sort((a, b) => {
      if (sort === "price-asc") return (a.priceAgorot ?? Number.MAX_SAFE_INTEGER) - (b.priceAgorot ?? Number.MAX_SAFE_INTEGER);
      if (sort === "price-desc") return (b.priceAgorot ?? -1) - (a.priceAgorot ?? -1);
      if (sort === "featured") return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
      return (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
    });
  }, [category, collection, featuredOnly, products, query, sort]);

  const hasFilters = query || category !== "all" || collection !== "all" || sort !== "default" || featuredOnly;

  return (
    <div className="space-y-8">
      <div className="border border-[var(--border)] bg-white p-4 md:p-5">
        <div className="grid gap-3 md:grid-cols-[1.3fr_1fr_1fr_1fr_auto]">
          <label className="relative block">
            <span className="sr-only">חיפוש</span>
            <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="חיפוש לפי שם פריט"
              className="tap w-full border border-[var(--border)] bg-[var(--background)] py-2 pl-3 pr-10"
            />
          </label>

          <FilterSelect label="קטגוריה" value={category} onChange={setCategory}>
            <option value="all">כל הקטגוריות</option>
            {categories.map((item) => (
              <option value={item.slug} key={item._id}>
                {item.name}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect label="קולקציה" value={collection} onChange={setCollection}>
            <option value="all">כל הקולקציות</option>
            {collections.map((item) => (
              <option value={item.slug} key={item._id}>
                {item.name}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect label="מיון" value={sort} onChange={(value) => setSort(value as SortMode)}>
            <option value="default">סדר תצוגה</option>
            <option value="featured">נבחרים קודם</option>
            <option value="price-asc">מחיר נמוך לגבוה</option>
            <option value="price-desc">מחיר גבוה לנמוך</option>
          </FilterSelect>

          <button
            type="button"
            className="tap inline-flex items-center justify-center gap-2 border border-[var(--border)] px-3 text-sm font-bold"
            onClick={() => setFeaturedOnly((value) => !value)}
            aria-pressed={featuredOnly}
          >
            <SlidersHorizontal size={17} />
            {featuredOnly ? "נבחרים בלבד" : "הצג נבחרים"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
          <p>{filteredProducts.length} פריטים מוצגים</p>
          {hasFilters ? (
            <button
              type="button"
              className="tap inline-flex items-center gap-2 font-bold text-[var(--ink)]"
              onClick={() => {
                setQuery("");
                setCategory("all");
                setCollection("all");
                setSort("default");
                setFeaturedOnly(false);
              }}
            >
              <X size={16} />
              ניקוי סינון
            </button>
          ) : null}
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
          <h2 className="text-2xl font-light">לא נמצאו פריטים</h2>
          <p className="mt-2 text-[var(--muted)]">אפשר לנקות סינון או לחפש מילים אחרות.</p>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="tap w-full border border-[var(--border)] bg-[var(--background)] px-3 py-2"
      >
        {children}
      </select>
    </label>
  );
}
