import {defaultSiteConfig} from "@/config/site";
import {client} from "@/lib/sanity";
import type {Category, Collection, GalleryImage, Product, SiteSettings} from "@/types/content";

const imageProjection = `{
  _key,
  alt,
  asset->{
    _id,
    url,
    metadata {
      dimensions,
      lqip
    }
  }
}`;

const categoryProjection = `{
  _id,
  name,
  "slug": slug.current,
  sortOrder,
  coverImage ${imageProjection}
}`;

const collectionProjection = `{
  _id,
  name,
  "slug": slug.current,
  description,
  sortOrder,
  coverImage ${imageProjection}
}`;

const productProjection = `{
  _id,
  name,
  "slug": slug.current,
  description,
  priceAgorot,
  currency,
  images[] ${imageProjection},
  category->${categoryProjection},
  collections[]->${collectionProjection},
  sizes,
  colors,
  featured,
  isNew,
  sortOrder
}`;

export async function getSiteSettings(): Promise<SiteSettings> {
  const settings = (
    (await client.fetch<SiteSettings | null>(
      `*[_type == "siteSettings"] | order(_id asc)[0]{
        aboutHeading,
        aboutIntro,
        aboutBody,
        displayName,
        description,
        logo ${imageProjection},
        accentColor,
        instagramUrl,
        whatsappNumber,
        contactEmail,
        showPrices,
        enableInquiries,
        demoMode
      }`
    )) ?? {}
  );
  // Keep legacy demo metadata out of the brand experience without editing CMS data.
  if (settings.description?.includes("קטלוג אופנה להמחשת")) {
    return {...settings, description: defaultSiteConfig.description};
  }
  return settings;
}

export async function getAllCategories(): Promise<Category[]> {
  return client.fetch<Category[]>(
    `*[_type == "category"] | order(sortOrder asc, name asc) ${categoryProjection}`
  );
}

export async function getAllCollections(): Promise<Collection[]> {
  return client.fetch<Collection[]>(
    `*[_type == "collection"] | order(sortOrder asc, name asc) ${collectionProjection}`
  );
}

export async function getAllProducts(): Promise<Product[]> {
  return client.fetch<Product[]>(
    `*[_type == "product" && defined(slug.current) && count(images) > 0] | order(sortOrder asc, _createdAt desc) ${productProjection}`
  );
}

export async function getFeaturedProducts(limit = 6): Promise<Product[]> {
  return client.fetch<Product[]>(
    `*[_type == "product" && featured == true && defined(slug.current) && count(images) > 0] | order(sortOrder asc, _createdAt desc)[0...$limit] ${productProjection}`,
    {limit}
  );
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return client.fetch<Product | null>(
    `*[_type == "product" && slug.current == $slug][0] ${productProjection}`,
    {slug}
  );
}

export async function getProductSlugs(): Promise<string[]> {
  return client.fetch<string[]>(
    `*[_type == "product" && defined(slug.current) && count(images) > 0].slug.current`
  );
}

export async function getRelatedProducts(productId: string, categoryId?: string, limit = 4): Promise<Product[]> {
  return client.fetch<Product[]>(
    `*[
      _type == "product" &&
      _id != $productId &&
      defined(slug.current) &&
      count(images) > 0 &&
      (!defined($categoryId) || category._ref == $categoryId)
    ] | order(featured desc, sortOrder asc, _createdAt desc)[0...$limit] ${productProjection}`,
    {productId, categoryId, limit}
  );
}

export async function getGalleryImages(): Promise<GalleryImage[]> {
  return client.fetch<GalleryImage[]>(
    `*[_type == "galleryImage" && defined(image.asset)] | order(sortOrder asc, _createdAt desc) {
      _id,
      title,
      caption,
      image ${imageProjection},
      category->${categoryProjection},
      collection->${collectionProjection},
      "product": product->{
        _id,
        name,
        "slug": slug.current
      },
      featured,
      sortOrder
    }`
  );
}
