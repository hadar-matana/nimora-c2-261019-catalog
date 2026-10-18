"use client";
import Link from "next/link";
import { Plus, ArrowLeft, Tag, LayoutGrid } from "lucide-react";
import { Shell } from "@/components/Shell";
import { ProductList } from "@/components/ProductList";
import { useAdmin } from "@/components/AdminContext";

export default function DashboardPage() {
  const { products } = useAdmin();
  const published = products.filter((p) => p.status === "published").length;
  return (
    <Shell>
      <div className="page-heading">
        <div>
          <span className="eyebrow" dir="ltr">
            ATELIER / YOUR STORE
          </span>
          <h1>שלום, טוב שאת כאן.</h1>
          <p>יום חדש, מקום לרעיונות חדשים.</p>
        </div>
      </div>
      <section className="welcome-card">
        <div>
          <span className="eyebrow">הקולקציה הבאה מתחילה כאן</span>
          <h2>יש לך פריט חדש?</h2>
          <p>
            תמונה יפה, כמה מילים —<br />
            והוא מוכן למצוא את המקום שלו בקטלוג.
          </p>
          <Link className="button primary" href="/products/new">
            <Plus size={18} />
            הוספת מוצר
          </Link>
        </div>
        <div className="welcome-photo" role="img" aria-label="פריט מקולקציית החנות" />
      </section>
      <div className="stats">
        {[
          ["כל המוצרים", products.length],
          ["מפורסמים באתר", published],
          ["טיוטות שמחכות לך", products.length - published],
        ].map(([label, count]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
      <div className="section-heading">
        <h2>עודכנו לאחרונה</h2>
        <Link href="/products">
          לכל המוצרים
          <ArrowLeft size={16} />
        </Link>
      </div>
      <ProductList recent />
      <div className="quick-links">
        <Link href="/products">
          <Tag size={20} />
          <div>
            <strong>המוצרים שלי</strong>
            <span>כל הפריטים, התמונות והמחירים</span>
          </div>
          <ArrowLeft size={18} />
        </Link>
        <Link href="/categories">
          <LayoutGrid size={20} />
          <div>
            <strong>קטגוריות</strong>
            <span>עושות סדר בקולקציה</span>
          </div>
          <ArrowLeft size={18} />
        </Link>
      </div>
    </Shell>
  );
}
