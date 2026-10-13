import {createClient} from "@sanity/client";
import imageUrlBuilder from "@sanity/image-url";
import {sanityConfig} from "@/config/site";
import type {SanityImage} from "@/types/content";

export const client = createClient({
  ...sanityConfig,
  useCdn: false,
  perspective: "published"
});

const builder = imageUrlBuilder(client);

export function imageUrl(image?: SanityImage, width = 1200, height?: number) {
  if (!image?.asset) return "";

  let url = builder.image(image).width(width).auto("format").quality(82);
  if (height) {
    url = url.height(height).fit("crop");
  }

  return url.url();
}

export function imageAlt(image: SanityImage | undefined, fallback: string) {
  return image?.alt?.trim() || fallback;
}
