"use client";

import {useState} from "react";
import {MessageCircle, X} from "lucide-react";
import {defaultSiteConfig} from "@/config/site";
import type {Product, SiteSettings} from "@/types/content";

export function ProductInquiryButton({product, settings}: {product: Product; settings: SiteSettings}) {
  const [showDemoModal, setShowDemoModal] = useState(false);
  const whatsappNumber = settings.whatsappNumber?.replace(/[^\d]/g, "");
  const canOpenWhatsapp = Boolean(whatsappNumber) && !(settings.demoMode ?? defaultSiteConfig.demoMode);
  const message = `היי, רציתי לברר לגבי הפריט ${product.name}. האם הוא זמין?`;
  const href = canOpenWhatsapp ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}` : undefined;

  return (
    <>
      {href ? (
        <a
          className="tap inline-flex w-full items-center justify-center gap-2 bg-[var(--olive)] px-5 font-bold text-white sm:w-auto"
          href={href}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle size={19} />
          בירור בוואטסאפ
        </a>
      ) : (
        <button
          type="button"
          className="tap inline-flex w-full items-center justify-center gap-2 bg-[var(--olive)] px-5 font-bold text-white sm:w-auto"
          onClick={() => setShowDemoModal(true)}
        >
          <MessageCircle size={19} />
          הדגמת בירור בוואטסאפ
        </button>
      )}

      {showDemoModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(23,20,18,0.72)] p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-[var(--background)] p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-light">כך תיראה הפנייה באתר אמיתי</h2>
              <button type="button" className="tap inline-flex items-center justify-center" onClick={() => setShowDemoModal(false)} aria-label="סגירה">
                <X size={21} />
              </button>
            </div>
            <p className="leading-7 text-[var(--muted)]">
              באתר של לקוח אמיתי הכפתור יפתח שיחת WhatsApp למספר החנות, עם הודעה מוכנה על הפריט: {product.name}.
            </p>
            <div className="mt-5 border border-[var(--border)] bg-white p-4 text-sm">{message}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
