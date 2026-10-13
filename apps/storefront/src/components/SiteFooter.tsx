import Link from "next/link";
import {Instagram, Mail} from "lucide-react";
import {defaultSiteConfig} from "@/config/site";
import type {SiteSettings} from "@/types/content";

export function SiteFooter({settings}: {settings: SiteSettings}) {
  return (
    <footer className="mt-16 border-t border-[var(--border)]">
      <div className="container grid gap-8 py-10 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="text-2xl font-light">{settings.displayName || defaultSiteConfig.displayName}</p>
          <p className="mt-3 max-w-xl text-[var(--muted)]">
            {settings.description || defaultSiteConfig.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-bold">
          <Link href="/gallery">גלריה</Link>
          <Link href="/catalog">קטלוג</Link>
          {settings.instagramUrl ? (
            <a href={settings.instagramUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
              <Instagram size={16} />
              אינסטגרם
            </a>
          ) : null}
          {settings.contactEmail ? (
            <a href={`mailto:${settings.contactEmail}`} className="inline-flex items-center gap-1">
              <Mail size={16} />
              מייל
            </a>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
