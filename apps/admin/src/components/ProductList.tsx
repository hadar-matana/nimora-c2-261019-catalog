"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Plus, ArrowLeft, Tag, X } from "lucide-react";
import { useAdmin } from "./AdminContext";
import { price, type AdminProduct } from "@/lib/model";

export function Status({ product }: { product: AdminProduct }) {
  return (
    <span className={`status ${product.status}`}>
      <span />
      {product.status === "published" ? "מפורסם באתר" : "טיוטה"}
    </span>
  );
}
export function ProductList({ recent = false }: { recent?: boolean }) {
  const { products, categories } = useAdmin();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState(10);
  const filtered = products.filter(
    (p) =>
      p.name.includes(search.trim()) &&
      (status === "all" || p.status === status) &&
      (!category || p.categoryId === category),
  );
  const displayed = recent
    ? [...products].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3)
    : filtered.slice(0, limit);
  return (
    <>
      {!recent && (
        <div className="filters">
          <div className="search-field">
            <Search size={19} />
            <input
              aria-label="חיפוש לפי שם מוצר"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(10);
              }}
              placeholder="חיפוש לפי שם מוצר…"
            />
            {search && (
              <button
                className="icon-button"
                aria-label="ניקוי חיפוש"
                onClick={() => setSearch("")}
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="filter-controls">
            <div className="segmented" aria-label="סינון לפי סטטוס">
              {[
                ["all", "הכול", products.length],
                ["published", "מפורסמים", products.filter((p) => p.status === "published").length],
                ["draft", "טיוטות", products.filter((p) => p.status === "draft").length],
              ].map(([value, label, count]) => (
                <button
                  key={value}
                  className={status === value ? "selected" : ""}
                  aria-pressed={status === value}
                  onClick={() => {
                    setStatus(String(value));
                    setLimit(10);
                  }}
                >
                  {label}
                  <span>{count}</span>
                </button>
              ))}
            </div>
            <select
              aria-label="סינון לפי קטגוריה"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setLimit(10);
              }}
            >
              <option value="">כל הקטגוריות</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      {displayed.length ? (
        <div className="product-table">
          <div className="table-heading" aria-hidden="true">
            <span>מוצר</span>
            <span>מחיר</span>
            <span>קטגוריה</span>
            <span>סטטוס</span>
            <span>עודכן לאחרונה</span>
            <span />
          </div>
          {displayed.map((product) => (
            <Link
              href={`/products/edit?id=${encodeURIComponent(product.id)}`}
              className="product-row"
              key={product.id}
              aria-label={`עריכת ${product.name}`}
            >
              <div className="product-identity">
                {product.images[0] ? (
                  <img src={product.images[0].src} alt="" />
                ) : (
                  <span className="image-placeholder">
                    <Tag size={23} />
                  </span>
                )}
                <strong>{product.name}</strong>
              </div>
              <span className="product-price">{price(product.priceAgorot)}</span>
              <span className="product-category">
                {categories.find((c) => c.id === product.categoryId)?.name ?? "ללא קטגוריה"}
              </span>
              <Status product={product} />
              <time dateTime={product.updatedAt}>
                {new Intl.DateTimeFormat("he-IL", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                }).format(new Date(product.updatedAt))}
              </time>
              <span className="edit-affordance">
                עריכה
                <ArrowLeft size={14} />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Tag size={28} strokeWidth={1.3} />
          <h2>{products.length ? "לא נמצאו מוצרים" : "הפריט הראשון שלך מתחיל כאן"}</h2>
          <p>
            {products.length
              ? "נסי שם אחר או שנו את הסינון."
              : "הוסיפי תמונות וכמה פרטים, והקטלוג שלך יתחיל להתמלא."}
          </p>
          {products.length ? (
            <button
              className="button"
              onClick={() => {
                setSearch("");
                setCategory("");
                setStatus("all");
              }}
            >
              ניקוי הסינון
            </button>
          ) : (
            <Link href="/products/new" className="button primary">
              <Plus size={17} />
              הוספת מוצר
            </Link>
          )}
        </div>
      )}
      {!recent && filtered.length > limit && (
        <button className="button load-more" onClick={() => setLimit(limit + 10)}>
          הצגת מוצרים נוספים
        </button>
      )}
      {!recent && displayed.length > 0 && (
        <p className="result-count">
          מוצגים {displayed.length} מתוך {filtered.length} מוצרים
        </p>
      )}
    </>
  );
}
