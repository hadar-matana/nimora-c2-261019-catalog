const hebrewMap: Record<string, string> = {
  א: "a",
  ב: "b",
  ג: "g",
  ד: "d",
  ה: "h",
  ו: "v",
  ז: "z",
  ח: "ch",
  ט: "t",
  י: "y",
  כ: "k",
  ך: "k",
  ל: "l",
  מ: "m",
  ם: "m",
  נ: "n",
  ן: "n",
  ס: "s",
  ע: "a",
  פ: "p",
  ף: "p",
  צ: "tz",
  ץ: "tz",
  ק: "k",
  ר: "r",
  ש: "sh",
  ת: "t",
};

export function productSlugify(value: string, fallback = "item") {
  const transliterated = value
    .normalize("NFKD")
    .replace(/[\u0591-\u05C7]/g, "")
    .split("")
    .map((char) => hebrewMap[char] ?? char)
    .join("");

  const slug = transliterated
    .toLowerCase()
    .replace(/['"’״׳]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80)
    .replace(/-+$/g, "");

  return slug || fallback;
}

export function fallbackProductSlug(id?: string) {
  const suffix = (id ?? Date.now().toString(36))
    .replace(/^drafts\./, "")
    .replace(/[^a-z0-9]+/gi, "")
    .slice(-8);
  return `item-${suffix || Date.now().toString(36)}`;
}
