export type Publication = "draft" | "published";
export type ProductImage = {
  id: string;
  src: string;
  alt: string;
  assetId?: string;
};
export type AdminProduct = {
  id: string;
  name: string;
  priceAgorot: number;
  categoryId: string;
  description: string;
  images: ProductImage[];
  sizes: string[];
  colors: string[];
  status: Publication;
  updatedAt: string;
  revision?: { published: string | null; draft: string | null };
};
export type Category = { id: string; name: string; revision?: string };
export const sizes = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "36",
  "38",
  "40",
  "42",
  "One size",
];
export const colors = [
  { name: "שחור", hex: "#141414" },
  { name: "לבן", hex: "#fff" },
  { name: "שמנת", hex: "#e4d3bd" },
  { name: "חום", hex: "#816c59" },
  { name: "אפור", hex: "#a4a09b" },
  { name: "זית", hex: "#737862" },
];
export function shekels(value: string): number | null {
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function price(value: number) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: value % 100 ? 2 : 0,
  }).format(value / 100);
}
export function emptyProduct(): AdminProduct {
  return {
    id: crypto.randomUUID(),
    name: "",
    priceAgorot: 0,
    categoryId: "",
    description: "",
    images: [],
    sizes: [],
    colors: [],
    status: "draft",
    updatedAt: new Date().toISOString(),
  };
}
export function validateProduct(
  product: AdminProduct,
  priceInput: string,
  publishing: boolean,
) {
  const errors: Record<string, string> = {};
  if (!product.name.trim()) errors.name = "יש להזין את שם המוצר";
  if (priceInput && shekels(priceInput) === null)
    errors.price = "יש להזין מחיר תקין, למשל 249 או 249.90";
  if (publishing) {
    if (!priceInput || shekels(priceInput) === null)
      errors.price = "יש להזין מחיר תקין בשקלים";
    if (!product.categoryId) errors.category = "יש לבחור קטגוריה";
    if (!product.images.length)
      errors.images = "יש להוסיף לפחות תמונה אחת לפני הפרסום";
  }
  return errors;
}
