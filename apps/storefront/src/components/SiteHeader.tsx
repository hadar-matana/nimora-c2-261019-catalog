import Link from "next/link";
import {defaultSiteConfig} from "@/config/site";
import type {SiteSettings} from "@/types/content";

export function SiteHeader({settings}: {settings: SiteSettings}) {
  const displayName = settings.displayName || defaultSiteConfig.displayName;

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[rgba(250,248,245,0.88)] backdrop-blur-xl">
      <div className="container flex min-h-16 items-center justify-between gap-4">
        <Link href="/" className="font-bold">
          {displayName}
        </Link>
        <nav aria-label="ניווט ראשי" className="flex items-center gap-1 text-sm font-semibold">
          <Link className="tap hidden items-center px-3 text-[var(--muted)] transition hover:text-[var(--ink)] sm:inline-flex" href="/gallery">
            גלריה
          </Link>
          <Link className="tap hidden items-center px-3 text-[var(--muted)] transition hover:text-[var(--ink)] sm:inline-flex" href="/catalog">
            קטלוג
          </Link>
        </nav>
      </div>
      <nav aria-label="ניווט מובייל" className="container flex border-t border-[var(--border)] sm:hidden">
        <Link className="tap flex flex-1 items-center justify-center text-sm font-bold" href="/gallery">
          גלריה
        </Link>
        <Link className="tap flex flex-1 items-center justify-center border-r border-[var(--border)] text-sm font-bold" href="/catalog">
          קטלוג
        </Link>
      </nav>
    </header>
  );
}
