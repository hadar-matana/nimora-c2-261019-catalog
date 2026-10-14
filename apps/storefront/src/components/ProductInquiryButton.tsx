"use client";

import {MessageCircle} from "lucide-react";
import {defaultSiteConfig} from "@/config/site";
import {createProductWhatsappHref, getContactLinks} from "@/lib/contact";
import type {Product, SiteSettings} from "@/types/content";

export function ProductInquiryButton({product, settings}: {product: Product; settings: SiteSettings}) {
  const {whatsappNumber} = getContactLinks(settings);
  const href = whatsappNumber
    ? createProductWhatsappHref({
        number: whatsappNumber,
        product,
        productUrl:
          typeof window !== "undefined"
            ? new URL(`/products/${product.slug}/`, window.location.origin).toString()
            : `${defaultSiteConfig.baseUrl}/products/${product.slug}/`
      })
    : undefined;

  if (!href) return null;

  return (
    <a
      className="tap cta-button inline-flex w-full items-center justify-center gap-2 bg-[var(--charcoal)] px-5 font-bold text-white sm:w-auto"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      <MessageCircle size={19} />
      בירור בוואטסאפ
    </a>
  );
}
