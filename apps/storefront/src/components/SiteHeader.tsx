import Link from "next/link";
import {Instagram} from "lucide-react";
import {defaultSiteConfig} from "@/config/site";
import type {SiteSettings} from "@/types/content";

export function SiteHeader({settings}: {settings: SiteSettings}) {
  const displayName = defaultSiteConfig.displayName;
  const instagramUrl = settings.instagramUrl || defaultSiteConfig.instagramUrl;

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[rgba(251,250,248,0.92)] backdrop-blur-xl">
      <div className="container grid min-h-20 grid-cols-[1fr_auto_1fr] items-center gap-4 md:min-h-24">
        <div className="flex justify-start">
          {instagramUrl ? (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="tap inline-flex items-center justify-center"
              aria-label="אינסטגרם"
            >
              <Instagram size={22} strokeWidth={1.8} />
            </a>
          ) : null}
        </div>
        <Link href="/" className="atelier-wordmark" aria-label="ATELIER דף הבית">
          {displayName}
        </Link>
        <div className="flex justify-end text-sm font-semibold">
          <Link className="tap inline-flex items-center px-1 text-[var(--ink)]" href="/catalog">
            קטלוג
          </Link>
        </div>
      </div>
    </header>
  );
}
