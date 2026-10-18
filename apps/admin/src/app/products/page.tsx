"use client";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Shell } from "@/components/Shell";
import { ProductList } from "@/components/ProductList";

export default function ProductsPage() {
  return (
    <Shell>
      <div className="page-heading">
        <div>
          <span className="eyebrow">הקטלוג שלך</span>
          <h1>המוצרים שלי</h1>
        </div>
        <Link href="/products/new" className="button primary">
          <Plus size={18} />
          הוספת מוצר
        </Link>
      </div>
      <ProductList />
    </Shell>
  );
}
