"use client";

import {MessageCircle} from "lucide-react";
import {defaultSiteConfig} from "@/config/site";
import type {Product, SiteSettings} from "@/types/content";

export function ProductInquiryButton({product, settings}: {product: Product; settings: SiteSettings}) {
  const whatsappNumber = settings.whatsappNumber?.replace(/[^\d]/g, "");
  const inquiriesEnabled = settings.enableInquiries ?? defaultSiteConfig.enableInquiries;
  const message = `היי, רציתי לברר לגבי הפריט ${product.name}. האם הוא זמין?`;
  const href = whatsappNumber && inquiriesEnabled ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}` : undefined;

  if (!href) return null;

  return (
    <a
      className="tap inline-flex w-full items-center justify-center gap-2 bg-[var(--olive)] px-5 font-bold text-white sm:w-auto"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      <MessageCircle size={19} />
      בירור בוואטסאפ
    </a>
  );
}
