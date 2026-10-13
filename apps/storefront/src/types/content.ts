export type SanityImage = {
  _key?: string;
  asset?: {
    _ref?: string;
    _id?: string;
    url?: string;
    metadata?: {
      dimensions?: {
        width: number;
        height: number;
        aspectRatio: number;
      };
      lqip?: string;
    };
  };
  alt?: string;
};

export type Category = {
  _id: string;
  name: string;
  slug: string;
  sortOrder?: number;
  coverImage?: SanityImage;
};

export type Collection = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  sortOrder?: number;
  coverImage?: SanityImage;
};

export type Product = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  priceAgorot?: number;
  currency?: string;
  category?: Category;
  collections?: Collection[];
  images: SanityImage[];
  sizes?: string[];
  colors?: string[];
  featured?: boolean;
  isNew?: boolean;
  sortOrder?: number;
};

export type GalleryImage = {
  _id: string;
  title?: string;
  caption?: string;
  image: SanityImage;
  category?: Category;
  collection?: Collection;
  product?: Pick<Product, "_id" | "name" | "slug">;
  featured?: boolean;
  sortOrder?: number;
};

export type SiteSettings = {
  displayName?: string;
  description?: string;
  logo?: SanityImage;
  accentColor?: string;
  instagramUrl?: string;
  whatsappNumber?: string;
  contactEmail?: string;
  showPrices?: boolean;
  enableInquiries?: boolean;
  demoMode?: boolean;
};
