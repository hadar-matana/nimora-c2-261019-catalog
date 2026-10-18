import {target} from "../deployment";
import {getCliClient} from "sanity/cli";
import {stableArrayKey} from "../lib/arrayKeys";

const client = getCliClient({apiVersion: target.apiVersion});

type DemoImage = {
  url: string;
  alt: string;
};

type DemoProduct = {
  id: string;
  name: string;
  slug: string;
  category: string;
  collections: string[];
  description: string;
  priceAgorot: number;
  sizes: string[];
  colors: string[];
  featured: boolean;
  isNew: boolean;
  sortOrder: number;
  images: DemoImage[];
};

const imageParams = "?auto=format&fit=crop&w=1600&q=82";

const privateSeedIds = [
  "category.dresses",
  "category.tops",
  "category.pants",
  "category.sets",
  "category.accessories",
  "collection.soft-tailoring",
  "collection.summer-edit",
  "collection.evening-minimal",
  "product.satin-midi-dress",
  "product.linen-button-shirt",
  "product.wide-tailored-pants",
  "product.oversized-blazer",
  "product.classic-rib-tank",
  "product.floral-maxi-dress",
  "product.midi-skirt",
  "product.relaxed-cotton-shirt",
  "product.two-piece-set",
  "product.straight-leg-jeans",
  "product.minimal-shoulder-bag",
  "product.silk-scarf",
  ...Array.from({length: 10}, (_, index) => `gallery.look-${index + 1}`)
];

const categories = [
  {id: "category-dresses", name: "שמלות", slug: "dresses", sortOrder: 10},
  {id: "category-tops", name: "חולצות", slug: "tops", sortOrder: 20},
  {id: "category-pants", name: "מכנסיים", slug: "pants", sortOrder: 30},
  {id: "category-sets", name: "סטים", slug: "sets", sortOrder: 40},
  {id: "category-accessories", name: "אקססוריז", slug: "accessories", sortOrder: 50}
];

const collections = [
  collection("collection-soft-tailoring", "Soft Tailoring", "soft-tailoring", "פריטים מחויטים ורכים ליום עבודה, פגישה או ערב רגוע.", 10),
  collection("collection-summer-edit", "Summer Edit", "summer-edit", "בדים קלים, צבעים טבעיים וגזרות נושמות.", 20),
  collection("collection-evening-minimal", "Evening Minimal", "evening-minimal", "מראה ערב נקי עם נוכחות שקטה.", 30)
];

const products: DemoProduct[] = [
  product("product-satin-midi-dress", "שמלת סאטן בגזרת מידי", "satin-midi-dress", "category-dresses", ["collection-evening-minimal"], 32900, ["S", "M", "L"], ["שנהב", "שחור"], 10, true, true, [image("1496747611176-843222e1e57c", "דוגמנית בשמלת מידי בהירה"), image("1503342217505-b0a15ec3261c", "שמלת אופנה בגזרת מידי")], "שמלת מידי רכה עם נפילה נקייה וברק עדין. מתאימה לאירוע ערב או לסטיילינג יומי עם סנדל שטוח."),
  product("product-linen-button-shirt", "חולצת פשתן מכופתרת", "linen-button-shirt", "category-tops", ["collection-summer-edit", "collection-soft-tailoring"], 18900, ["S", "M", "L", "XL"], ["לבן", "חול"], 20, true, false, [image("1485968579580-b6d095142e6e", "חולצה בהירה בסגנון נקי")], "חולצת פשתן קלילה בגזרה משוחררת, עם צווארון נקי וכפתורים בגוון טבעי."),
  product("product-wide-tailored-pants", "מכנסיים מחויטים בגזרה רחבה", "wide-tailored-pants", "category-pants", ["collection-soft-tailoring"], 27900, ["36", "38", "40", "42"], ["אפור אבן", "שחור"], 30, true, false, [image("1529139574466-a303027c1d8b", "מכנסיים רחבים בלוק מחויט")], "מכנסיים גבוהים עם קו רגל רחב, בד יציב ונפילה אלגנטית."),
  product("product-oversized-blazer", "בלייזר אוברסייז", "oversized-blazer", "category-tops", ["collection-soft-tailoring"], 44900, ["S", "M", "L"], ["חום קקאו", "שחור"], 40, true, false, [image("1520975954732-35dd22299614", "בלייזר בגזרה רחבה")], "בלייזר בקו כתפיים רך, מתאים כשכבה עליונה מעל גופיה או שמלה."),
  product("product-classic-rib-tank", "גופיית ריב קלאסית", "classic-rib-tank", "category-tops", ["collection-summer-edit"], 8900, ["XS", "S", "M", "L"], ["לבן", "זית", "שחור"], 50, false, false, [image("1554412933-514a83d2f3c8", "גופיית בסיס במראה נקי")], "גופיית בסיס עם טקסטורת ריב עדינה, מתאימה לשכבות או ללבישה לבד."),
  product("product-floral-maxi-dress", "שמלת מקסי פרחונית", "floral-maxi-dress", "category-dresses", ["collection-summer-edit"], 29900, ["S", "M", "L"], ["פרחוני"], 60, false, true, [image("1515886657613-9f3515b0c78f", "שמלת מקסי בהדפס עדין")], "שמלת מקסי קלילה עם הדפס פרחוני עדין ושרוול קצר."),
  product("product-midi-skirt", "חצאית מידי", "midi-skirt", "category-dresses", ["collection-evening-minimal"], 21900, ["36", "38", "40", "42"], ["שחור", "שמנת"], 70, false, false, [image("1490481651871-ab68de25d43d", "לוק אופנה עם חצאית מידי")], "חצאית מידי בקו נקי, עם מותן גבוהה וסיומת רכה."),
  product("product-relaxed-cotton-shirt", "חולצת כותנה משוחררת", "relaxed-cotton-shirt", "category-tops", ["collection-summer-edit"], 15900, ["S", "M", "L"], ["לבן", "כחול בהיר"], 80, false, false, [image("1525507119028-ed4c629a60a3", "חולצת כותנה בגזרה רגועה")], "חולצת כותנה רכה ונושמת, עם נפח עדין ותחושה יומיומית."),
  product("product-two-piece-set", "סט שני חלקים", "two-piece-set", "category-sets", ["collection-summer-edit"], 34900, ["S", "M", "L"], ["חול", "ירוק מרווה"], 90, true, false, [image("1539109136881-3be0616acf4b", "סט קיץ שני חלקים")], "סט תואם של חולצה ומכנס קצר, נעים ליום חם ולחופשה."),
  product("product-straight-leg-jeans", "מכנסי ג׳ינס בגזרה ישרה", "straight-leg-jeans", "category-pants", ["collection-soft-tailoring"], 25900, ["36", "38", "40", "42"], ["כחול שטיפה בינונית"], 100, false, false, [image("1541099649105-f69ad21f3246", "ג׳ינס בגזרה ישרה")], "ג׳ינס כחול נקי בגזרה ישרה, מתאים כמעט לכל שילוב."),
  product("product-minimal-shoulder-bag", "תיק כתף מינימלי", "minimal-shoulder-bag", "category-accessories", ["collection-evening-minimal"], 19900, ["One size"], ["שחור", "חום"], 110, false, false, [image("1594223274512-ad4803739b7c", "תיק כתף מינימלי")], "תיק כתף קטן במראה נקי, לסיום לוק ערב או יום."),
  product("product-silk-scarf", "מטפחת משי מודפסת", "silk-scarf", "category-accessories", ["collection-evening-minimal"], 9900, ["One size"], ["שמנת", "חמרה"], 120, false, true, [image("1516762689617-e1cffcef479d", "אקססוריז אופנה בצבעים רכים")], "מטפחת משי קטנה עם הדפס גרפי עדין, לענידה בשיער, בצוואר או על התיק.")
];

const gallery = products.slice(0, 10).map((item, index) => ({
  id: `gallery-look-${index + 1}`,
  title: item.name,
  caption: [
    "מראה רך ונקי לשילוב יומיומי.",
    "שכבות קלילות עם נוכחות שקטה.",
    "פריט מרכזי ללוק ערב מינימלי.",
    "גזרה מחויטת שמתאימה לעונות מעבר.",
    "בסיס נוח לבנייה של כמה לוקים.",
    "הדפס עדין למראה קייצי ורענן.",
    "קו מידי נקי עם תחושה אלגנטית.",
    "חולצה משוחררת ליום עבודה או סוף שבוע.",
    "סט תואם למראה קליל ומסודר.",
    "פריט יומיומי שקל לשלב עם קולקציות שונות."
  ][index],
  image: item.images[0],
  category: item.category,
  collection: item.collections[0],
  product: item.id,
  featured: index < 4,
  sortOrder: (index + 1) * 10
}));

function image(id: string, alt: string): DemoImage {
  return {url: `https://images.unsplash.com/photo-${id}${imageParams}`, alt};
}

function collection(id: string, name: string, slug: string, description: string, sortOrder: number) {
  return {id, name, slug, description, sortOrder};
}

function product(
  id: string,
  name: string,
  slug: string,
  category: string,
  collections: string[],
  priceAgorot: number,
  sizes: string[],
  colors: string[],
  sortOrder: number,
  featured: boolean,
  isNew: boolean,
  images: DemoImage[],
  description: string
): DemoProduct {
  return {id, name, slug, category, collections, description, priceAgorot, sizes, colors, featured, isNew, sortOrder, images};
}

async function uploadImage(url: string, alt: string, keySource: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status}`);

  const asset = await client.assets.upload("image", Buffer.from(await response.arrayBuffer()), {
    filename: `${slugify(alt)}.jpg`,
    contentType: response.headers.get("content-type") ?? "image/jpeg"
  });

  return {
    _key: stableArrayKey(keySource, "images", 0, {_type: "image", asset: {_ref: asset._id}, alt}),
    _type: "image",
    asset: {_type: "reference", _ref: asset._id},
    alt
  };
}

function ref(_ref: string, keySource?: string, fieldName?: string, index = 0) {
  return {
    ...(keySource && fieldName ? {_key: stableArrayKey(keySource, fieldName, index, {_type: "reference", _ref})} : {}),
    _type: "reference",
    _ref
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u0590-\u05ff]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

async function deletePrivateSeedDocs() {
  for (const id of [...privateSeedIds].reverse()) {
    await client.delete(id).catch((error: Error & {statusCode?: number}) => {
      if (error.statusCode !== 404) throw error;
    });
  }
}

async function seed() {
  console.log(`Seeding demo content into Sanity project ${target.projectId} / ${target.dataset}`);
  await deletePrivateSeedDocs();

  await client.createIfNotExists({
    _id: "siteSettings",
    _type: "siteSettings",
    displayName: "גלריית אופנה",
    description: "קטלוג אופנה להמחשת גלריה, מוצרים ופניות לקוחות. הפריטים והתמונות להמחשה בלבד.",
    accentColor: "#5D654E",
    showPrices: true,
    enableInquiries: true,
    demoMode: false
  });

  for (const item of categories) {
    await client.createOrReplace({_id: item.id, _type: "category", name: item.name, slug: {_type: "slug", current: item.slug}, sortOrder: item.sortOrder});
  }

  for (const item of collections) {
    await client.createOrReplace({_id: item.id, _type: "collection", name: item.name, slug: {_type: "slug", current: item.slug}, description: item.description, sortOrder: item.sortOrder});
  }

  for (const item of products) {
    const existing = await client.getDocument<{images?: unknown[]}>(item.id);
    const images = existing?.images?.length ? existing.images : await Promise.all(item.images.map((demoImage, index) => uploadImage(demoImage.url, demoImage.alt, `${item.id}:image:${index}`)));

    await client.createOrReplace({
      _id: item.id,
      _type: "product",
      name: item.name,
      slug: {_type: "slug", current: item.slug},
      category: ref(item.category),
      collections: item.collections.map((collectionId, index) => ref(collectionId, item.id, "collections", index)),
      description: item.description,
      priceAgorot: item.priceAgorot,
      currency: "ILS",
      sizes: item.sizes,
      colors: item.colors,
      featured: item.featured,
      isNew: item.isNew,
      sortOrder: item.sortOrder,
      images
    });
  }

  for (const item of gallery) {
    const existing = await client.getDocument<{image?: unknown}>(item.id);
    const uploadedImage = existing?.image ?? (await uploadImage(item.image.url, item.image.alt, item.id));

    await client.createOrReplace({
      _id: item.id,
      _type: "galleryImage",
      title: item.title,
      caption: item.caption,
      image: uploadedImage,
      category: ref(item.category),
      collection: ref(item.collection),
      product: ref(item.product),
      featured: item.featured,
      sortOrder: item.sortOrder
    });
  }

  console.log(`Seeded ${products.length} products, ${categories.length} categories, ${collections.length} collections, ${gallery.length} gallery images.`);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
