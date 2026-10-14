import Link from "next/link";
import {Instagram, MessageCircle} from "lucide-react";
import {defaultSiteConfig} from "@/config/site";
import {createGeneralWhatsappHref, getContactLinks} from "@/lib/contact";
import type {SiteSettings} from "@/types/content";

export function SiteHeader({settings}: {settings: SiteSettings}) {
  const displayName = defaultSiteConfig.displayName;
  const {instagramUrl, whatsappNumber} = getContactLinks(settings);
  const whatsappHref = whatsappNumber ? createGeneralWhatsappHref(whatsappNumber) : undefined;

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[rgba(251,250,248,0.88)] backdrop-blur-xl transition-shadow duration-300 supports-[backdrop-filter]:bg-[rgba(251,250,248,0.82)]">
      <div className="container grid min-h-20 grid-cols-[1fr_auto_1fr] items-center gap-4 md:min-h-24">
        <div className="flex justify-start gap-1">
          {instagramUrl ? (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="tap contact-icon inline-flex items-center justify-center"
              aria-label="אינסטגרם"
            >
              <Instagram size={22} strokeWidth={1.8} />
            </a>
          ) : null}
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="tap contact-icon inline-flex items-center justify-center"
              aria-label="וואטסאפ"
            >
              <MessageCircle size={22} strokeWidth={1.8} />
            </a>
          ) : null}
        </div>
        <Link href="/" className="atelier-wordmark transition-opacity duration-200 hover:opacity-75" aria-label="ATELIER דף הבית">
          {displayName}
        </Link>
        <div className="flex justify-end text-sm font-semibold">
          <Link className="tap nav-link inline-flex items-center px-1 text-[var(--ink)]" href="/catalog">
            קטלוג
          </Link>
        </div>
      </div>
    </header>
  );
}
