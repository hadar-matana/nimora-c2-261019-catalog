"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { ProductEditor } from "@/components/ProductEditor";
import { useAdmin } from "@/components/AdminContext";
export default function EditProductPage() {
  return (
    <Suspense
      fallback={<main className="loading-screen">פותחים את המוצר…</main>}
    >
      <EditProduct />
    </Suspense>
  );
}
function EditProduct() {
  const params = useSearchParams();
  const { products } = useAdmin();
  const product = products.find((p) => p.id === params.get("id"));
  return (
    <Shell>
      {product ? (
        <ProductEditor key={product.id} existing={product} />
      ) : (
        <div className="empty-state">
          <h1>המוצר לא נמצא</h1>
          <p>אפשר לרענן את הרשימה או לבחור מוצר אחר.</p>
          <Link href="/products" className="button">
            חזרה למוצרים
          </Link>
        </div>
      )}
    </Shell>
  );
}
