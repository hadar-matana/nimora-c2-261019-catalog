import {defaultSiteConfig} from "@/config/site";
import {formatPrice} from "@/lib/format";
import type {Product, SiteSettings} from "@/types/content";

const MIN_WHATSAPP_DIGITS = 8;
const MAX_WHATSAPP_DIGITS = 15;

export function normalizeInstagramUrl(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return undefined;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (!/(^|\.)instagram\.com$/i.test(url.hostname)) return undefined;
      return url.toString();
    } catch {
      return undefined;
    }
  }

  const username = raw
    .replace(/^@/, "")
    .replace(/^instagram\.com\//i, "")
    .replace(/^www\.instagram\.com\//i, "")
    .replace(/\/+$/, "");

  if (!/^[a-zA-Z0-9._]{1,30}$/.test(username)) return undefined;
  return `https://www.instagram.com/${username}/`;
}

export function normalizeWhatsappNumber(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return undefined;

  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length < MIN_WHATSAPP_DIGITS || digits.length > MAX_WHATSAPP_DIGITS) return undefined;
  return digits;
}

export function createWhatsappHref(number: string, messageLines: string[]) {
  return `https://wa.me/${number}?text=${encodeURIComponent(messageLines.filter(Boolean).join("\n"))}`;
}

export function getContactLinks(settings: SiteSettings) {
  const instagramUrl = normalizeInstagramUrl(settings.instagramUrl ?? defaultSiteConfig.instagramUrl);
  const whatsappNumber = normalizeWhatsappNumber(settings.whatsappNumber ?? defaultSiteConfig.whatsappNumber);
  const inquiriesEnabled = settings.enableInquiries ?? defaultSiteConfig.enableInquiries;

  return {
    instagramUrl,
    whatsappNumber: inquiriesEnabled ? whatsappNumber : undefined
  };
}

export function createGeneralWhatsappHref(number: string) {
  return createWhatsappHref(number, ["היי! אשמח לקבל פרטים על הקטלוג של ATELIER."]);
}

export function createProductWhatsappHref({
  number,
  product,
  selectedSize,
  selectedColor,
  showPrice,
  productUrl
}: {
  number: string;
  product: Product;
  selectedSize?: string;
  selectedColor?: string;
  showPrice: boolean;
  productUrl: string;
}) {
  const price = showPrice && product.priceAgorot ? formatPrice(product.priceAgorot, product.currency) : "";

  return createWhatsappHref(number, [
    `היי! אשמח לברר לגבי ${product.name}.`,
    selectedSize ? `מידה: ${selectedSize}` : "",
    selectedColor ? `צבע: ${selectedColor}` : "",
    price ? `מחיר: ${price}` : "",
    `קישור למוצר: ${productUrl}`,
    "האם הפריט זמין?"
  ]);
}
