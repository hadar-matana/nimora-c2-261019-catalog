import Link from "next/link";
import {Instagram, Mail, MessageCircle} from "lucide-react";
import {defaultSiteConfig} from "@/config/site";
import {createGeneralWhatsappHref, getContactLinks} from "@/lib/contact";
import type {SiteSettings} from "@/types/content";

export function SiteFooter({settings}: {settings: SiteSettings}) {
  const {instagramUrl, whatsappNumber} = getContactLinks(settings);
  const whatsappHref = whatsappNumber ? createGeneralWhatsappHref(whatsappNumber) : undefined;

  return (
    <footer className="mt-16 border-t border-[var(--border)] bg-white">
      <div className="container grid gap-8 py-8 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div>
          <p className="atelier-wordmark text-[2rem] md:text-[2.6rem]">{defaultSiteConfig.displayName}</p>
        </div>
        <p className="text-center text-sm text-[var(--muted)]">אופנה נשית. בכל יום מחדש.</p>
        <div className="flex flex-wrap justify-start gap-4 text-sm font-semibold md:justify-end">
          <Link href="/catalog">קטלוג</Link>
          {instagramUrl ? (
            <a href={instagramUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 transition-opacity hover:opacity-65">
              <Instagram size={16} />
              אינסטגרם
            </a>
          ) : null}
          {whatsappHref ? (
            <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 transition-opacity hover:opacity-65">
              <MessageCircle size={16} />
              וואטסאפ
            </a>
          ) : null}
          {settings.contactEmail ? (
            <a href={`mailto:${settings.contactEmail}`} className="inline-flex items-center gap-1 transition-opacity hover:opacity-65">
              <Mail size={16} />
              מייל
            </a>
          ) : null}
        </div>
      </div>
      {settings.demoMode ? (
        <p className="container pb-6 text-center text-xs text-[var(--muted)]">הפריטים והתמונות באתר ההדגמה להמחשה בלבד.</p>
      ) : null}
    </footer>
  );
}
