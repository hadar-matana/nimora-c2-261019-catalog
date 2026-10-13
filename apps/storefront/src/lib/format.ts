export function formatPrice(priceAgorot?: number, currency = "ILS") {
  if (typeof priceAgorot !== "number") return "";

  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency,
    maximumFractionDigits: priceAgorot % 100 === 0 ? 0 : 2
  }).format(priceAgorot / 100);
}

export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}
