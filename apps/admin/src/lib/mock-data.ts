import type { AdminProduct, Category } from "./model";

export const initialCategories: Category[] = [
  { id: "dresses", name: "שמלות" },
  { id: "jackets", name: "ג׳קטים" },
  { id: "shirts", name: "חולצות" },
  { id: "pants", name: "מכנסיים" },
];
const rows = [
  ["dress", "שמלת מקסי שחורה", 24900, "dresses", "published"],
  ["blazer", "בלייזר מחויט", 28900, "jackets", "published"],
  ["linen", "חולצת פשתן לבנה", 15900, "shirts", "draft"],
  ["pants", "מכנסי אריג רחבים", 19900, "pants", "published"],
  ["satin", "שמלת סאטן בג׳", 27900, "dresses", "draft"],
] as const;
export function seedProducts(): AdminProduct[] {
  return rows.map(([id, name, priceAgorot, categoryId, status], index) => ({
    id,
    name,
    priceAgorot,
    categoryId,
    status,
    images: [{ id: `${id}-photo`, src: `/demo/${id}.png`, alt: name }],
    description: "פריט אלגנטי מבד רך ונעים. גזרה נינוחה שמתאימה לרגעים הקטנים ולאירועים מיוחדים.",
    sizes: ["XS", "S", "M", "L", "XL"],
    colors: ["שחור", "שמנת"],
    updatedAt: new Date(Date.UTC(2026, 9, 14 - index, 9, 24)).toISOString(),
  }));
}
