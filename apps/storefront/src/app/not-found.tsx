import Link from "next/link";

export default function NotFound() {
  return (
    <section className="container flex min-h-[70vh] flex-col items-start justify-center gap-6 py-24">
      <p className="section-label">404</p>
      <h1 className="max-w-2xl text-4xl font-light leading-tight md:text-6xl">העמוד לא נמצא</h1>
      <p className="max-w-xl text-lg text-[var(--muted)]">יכול להיות שהפריט הוסר או שהקישור השתנה לאחר עדכון הקולקציה.</p>
      <Link className="tap inline-flex items-center border border-[var(--ink)] px-5 text-sm font-bold" href="/catalog">
        חזרה לקולקציה
      </Link>
    </section>
  );
}
