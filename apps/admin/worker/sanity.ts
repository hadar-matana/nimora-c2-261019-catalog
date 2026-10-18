import { cmsTarget } from "../../../packages/config/deployment.mjs";
import type { AdminProduct, Category, ProductImage } from "../src/lib/model";
import { productSlugify } from "./slug";
export type SanityEnv = {
  SANITY_MODE?: string;
  SANITY_PROJECT_ID?: string;
  SANITY_DATASET?: string;
  SANITY_API_VERSION?: string;
  SANITY_FIXTURE_ORIGIN?: string;
  SANITY_API_TOKEN?: string;
  SANITY_ALLOW_PRODUCTION_WRITES?: string;
  SANITY_UPLOAD_RETEST_UNTIL?: string;
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type Doc = {
  _id: string;
  _type: string;
  _rev: string;
  _updatedAt: string;
  [key: string]: unknown;
};
type Image = {
  _key: string;
  _type?: string;
  alt?: string;
  asset: { _type: "reference"; _ref: string };
  [key: string]: unknown;
};
export type Catalog = { products: Doc[]; categories: Doc[]; assets: Doc[] };
export function uploadRetestActive(env: SanityEnv) {
  const until = Number(env.SANITY_UPLOAD_RETEST_UNTIL);
  const remaining = until - Date.now();
  return env.SANITY_MODE === "production" && Number.isSafeInteger(until) &&
    remaining > 0 && remaining <= 60 * 60 * 1000;
}
export function connection(env: SanityEnv, writing = false, uploading = false) {
  const fixture = env.SANITY_MODE === "fixture";
  if (!fixture && env.SANITY_MODE !== "production")
    throw new ApiError(503, "סביבת הנתונים לא הוגדרה");
  if (writing && !fixture && env.SANITY_ALLOW_PRODUCTION_WRITES !== "approved" &&
      !(uploading && uploadRetestActive(env)))
    throw new ApiError(403, "כתיבה לנתונים החיים דורשת אישור מפורש");
  let target;
  try {
    target = cmsTarget(env.SANITY_PROJECT_ID, env.SANITY_DATASET, env.SANITY_API_VERSION);
  } catch {
    throw new ApiError(503, "סביבת הנתונים לא הוגדרה");
  }
  const origin = fixture ? env.SANITY_FIXTURE_ORIGIN : target.origin;
  if (fixture) {
    let url;
    try { url = new URL(origin ?? ""); } catch { throw new ApiError(503, "סביבת הנתונים לא הוגדרה"); }
    if (url.hostname !== "127.0.0.1" || url.protocol !== "http:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash)
      throw new ApiError(503, "סביבת הנתונים לא הוגדרה");
  }
  const token = fixture ? "isolated-sanity-fixture" : env.SANITY_API_TOKEN;
  if (!token) throw new ApiError(503, "חיבור מאובטח לקטלוג טרם הוגדר");
  return { ...target, origin: origin!, token: token!, fixture, apiVersion: "/v" + target.apiVersion, assetPrefix: fixture ? origin + "/images/" : target.assetPrefix };
}
export async function readJson(
  response: Response,
  limit = 4 * 1024 * 1024,
  invalidStatus = 502,
): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new ApiError(invalidStatus, "בקשה או תשובה לא תקינה");
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const p = await reader.read();
    if (p.done) break;
    size += p.value.length;
    if (size > limit) {
      void reader.cancel().catch(() => {});
      throw new ApiError(invalidStatus === 400 ? 413 : 502, "המידע גדול מדי");
    }
    parts.push(p.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError(invalidStatus, "מידע לא תקין");
  }
}
export async function query<T>(
  env: SanityEnv,
  groq: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const { origin, token, apiVersion, dataset } = connection(env);
  const url = new URL(origin + apiVersion + "/data/query/" + dataset);
  url.searchParams.set("query", groq);
  url.searchParams.set("perspective", "raw");
  for (const [k, v] of Object.entries(params))
    url.searchParams.set("$" + k, JSON.stringify(v));
  const response = await fetch(url, {
    headers: { Authorization: "Bearer " + token },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new ApiError(502, "לא ניתן לטעון את הקטלוג");
  const result = (await readJson(response)) as { result: T };
  if (!result || typeof result !== "object" || !("result" in result))
    throw new ApiError(502, "תשובת שרת לא תקינה");
  return result.result;
}
export async function mutate(env: SanityEnv, mutations: unknown[]) {
  const { origin, token, apiVersion, dataset } = connection(env, true);
  const r = await fetch(
    origin +
      apiVersion +
      "/data/mutate/" + dataset + "?visibility=sync&returnIds=true",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mutations }),
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!r.ok) {
    void r.body?.cancel().catch(() => {});
    throw new ApiError(
      r.status === 409 ? 409 : 502,
      r.status === 409
        ? "הפריט השתנה מאז פתיחתו. רענני את הרשימה לפני שמירה נוספת."
        : "לא ניתן לשמור כעת. רענני את הרשימה כדי לבדוק אם השינוי נשמר.",
    );
  }
  const data = (await readJson(r, 65536)) as { transactionId?: string };
  if (!data?.transactionId)
    throw new ApiError(502, "לא ניתן לאשר שהשמירה הושלמה. רענני את הרשימה.");
}
export async function catalog(env: SanityEnv): Promise<Catalog> {
  const result = await query<Catalog>(
    env,
    '{"products":*[_type=="product" && !(_id in path("versions.**"))][0...2001],"categories":*[_type=="category" && !(_id in path("drafts.**"))]|order(sortOrder asc)[0...201],"assets":*[_type=="sanity.imageAsset"][0...10001]}',
  );
  if (
    !Array.isArray(result.products) ||
    !Array.isArray(result.categories) ||
    !Array.isArray(result.assets)
  )
    throw new ApiError(502, "תשובת קטלוג לא תקינה");
  if (
    result.products.length >= 2001 ||
    result.categories.length >= 201 ||
    result.assets.length >= 10001
  )
    throw new ApiError(503, "הקטלוג גדול ממגבלת הממשק. פני למנהלת המערכת.");
  return result;
}
export function id(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(value) ||
    value.startsWith("drafts.") ||
    value.startsWith("versions.") ||
    value.includes("..")
  )
    throw new ApiError(400, "מזהה פריט לא תקין");
  return value;
}
function pair(data: Catalog, key: string) {
  return {
    published: data.products.find((d) => d._id === key),
    draft: data.products.find((d) => d._id === "drafts." + key),
  };
}
export function view(data: Catalog, key: string): AdminProduct {
  const { published, draft } = pair(data, key);
  const d = draft ?? published;
  if (!d) throw new ApiError(404, "המוצר לא נמצא");
  return {
    id: key,
    name: String(d.name ?? ""),
    description: String(d.description ?? ""),
    priceAgorot: Number(d.priceAgorot ?? 0),
    categoryId: (d.category as { _ref?: string })?._ref ?? "",
    status: published ? "published" : "draft",
    updatedAt: d._updatedAt,
    sizes: (d.sizes as string[]) ?? [],
    colors: (d.colors as string[]) ?? [],
    revision: {
      published: published?._rev ?? null,
      draft: draft?._rev ?? null,
    },
    // Studio can persist unfinished image placeholders in native drafts.
    // Ignore them in the view without mutating the original document.
    images: ((d.images as Image[]) ?? [])
      .filter((i) => i?.asset?._ref)
      .map((i) => ({
        id: i._key,
        assetId: i.asset._ref,
        alt: i.alt ?? String(d.name ?? ""),
        src: String(data.assets.find((a) => a._id === i.asset._ref)?.url ?? ""),
      })),
  };
}
export function catalogView(data: Catalog, env: SanityEnv) {
  const keys = [
    ...new Set(data.products.map((d) => d._id.replace(/^drafts\./, ""))),
  ];
  return {
    products: keys.map((key) => view(data, key)),
    categories: data.categories.map((d) => ({
      id: d._id,
      name: String(d.name),
      revision: d._rev,
    })),
    environment: connection(env).fixture ? "fixture" : "sanity",
  };
}
function text(value: unknown, max: number, required = false): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && value.trim().length < 2)
  )
    throw new ApiError(400, "יש לבדוק את שם המוצר והפרטים שהוזנו");
  return value.trim();
}
function list(value: unknown, maxItems: number, maxLength: number): string[] {
  if (
    !Array.isArray(value) ||
    value.length > maxItems ||
    value.some((x) => typeof x !== "string" || x.length > maxLength) ||
    new Set(value).size !== value.length
  )
    throw new ApiError(400, "רשימת פרטים לא תקינה");
  return value;
}
function fields(
  input: Record<string, unknown>,
  data: Catalog,
  base: Doc | undefined,
  publishing: boolean,
) {
  const name = text(input.name, 160, true),
    description = text(input.description, 10000);
  if (
    !Number.isSafeInteger(input.priceAgorot) ||
    Number(input.priceAgorot) < 0 ||
    Number(input.priceAgorot) > 999999999
  )
    throw new ApiError(400, "יש להזין מחיר תקין בשקלים");
  const categoryId = text(input.categoryId, 128);
  if (
    (publishing && !categoryId) ||
    (categoryId && !data.categories.some((c) => c._id === categoryId))
  )
    throw new ApiError(400, "יש לבחור קטגוריה קיימת");
  const sizes = list(input.sizes, 20, 40),
    colors = list(input.colors, 30, 80);
  if (
    !Array.isArray(input.images) ||
    input.images.length > 10 ||
    (publishing && !input.images.length)
  )
    throw new ApiError(400, "יש להוסיף בין תמונה אחת לעשר תמונות לפרסום");
  const keys = new Set<string>();
  const images = input.images.map((raw: ProductImage) => {
    if (!raw || typeof raw !== "object")
      throw new ApiError(400, "תמונה לא תקינה");
    const key = id(raw.id);
    if (keys.has(key)) throw new ApiError(400, "תמונה כפולה");
    keys.add(key);
    const asset = data.assets.find((a) => a._id === raw.assetId);
    if (!asset) throw new ApiError(400, "התמונה לא נמצאה בספריית התמונות");
    const original = ((base?.images as Image[]) ?? []).find(
      (i) => i?._key === key && i.asset?._ref === asset._id,
    );
    return {
      ...original,
      _type: "image",
      _key: key,
      asset: { _type: "reference", _ref: asset._id },
      alt: text(raw.alt || name, 300, true),
    };
  });
  return {
    name,
    description,
    priceAgorot: input.priceAgorot,
    sizes,
    colors,
    images,
    ...(categoryId
      ? { category: { _type: "reference", _ref: categoryId } }
      : {}),
  };
}
function clean(doc: Doc | undefined): Record<string, unknown> {
  const result = { ...doc };
  for (const key of ["_id", "_rev", "_createdAt", "_updatedAt"])
    delete result[key];
  return result;
}
function guard(doc: Doc) {
  return {
    patch: { id: doc._id, ifRevisionID: doc._rev, set: { _type: doc._type } },
  };
}
export async function saveProduct(
  env: SanityEnv,
  key: string,
  input: Record<string, unknown>,
  action: unknown,
) {
  connection(env, true);
  id(key);
  if (!input || typeof input !== "object" || input.id !== key)
    throw new ApiError(400, "פרטי מוצר לא תקינים");
  if (!["draft", "publish", "unpublish"].includes(String(action)))
    throw new ApiError(400, "פעולה לא תקינה");
  const data = await catalog(env);
  // A just-uploaded asset may precede the broad catalog query's visibility.
  // Resolve only missing image references with a targeted authenticated read;
  // never trust browser URLs or retry an upload/mutation automatically.
  if (
    action !== "unpublish" &&
    Array.isArray(input.images) &&
    input.images.length <= 10
  ) {
    const missing = [...new Set(input.images
      .map((image) => image && typeof image === "object" ? image.assetId : undefined)
      .filter((assetId): assetId is string =>
        typeof assetId === "string" &&
        /^image-[a-f0-9]{40}-\d+x\d+-(png|jpg|webp)$/.test(assetId) &&
        !data.assets.some((a) => a._id === assetId)))];
    if (missing.length)
      data.assets.push(...await query<Doc[]>(
        env, '*[_type=="sanity.imageAsset" && _id in $ids]', { ids: missing },
      ));
  }
  const { published, draft } = pair(data, key);
  const rev = input.revision as
    { published?: unknown; draft?: unknown } | undefined;
  if (
    (rev?.published ?? null) !== (published?._rev ?? null) ||
    (rev?.draft ?? null) !== (draft?._rev ?? null)
  )
    throw new ApiError(409, "המוצר השתנה מאז פתיחתו. רענני את הרשימה.");
  const allIds = await query<Doc[]>(env, "*[_id in $ids]", {
    ids: [key, "drafts." + key],
  });
  if (allIds.some((d) => d._type !== "product"))
    throw new ApiError(400, "מזהה הפריט כבר בשימוש");
  if (
    draft &&
    Object.hasOwn(draft, "atelierAdminBaseRevision") &&
    draft.atelierAdminBaseRevision !== (published?._rev ?? null)
  )
    throw new ApiError(
      409,
      "התוכן באתר השתנה מאז שמירת הטיוטה. פני למנהלת המערכת למיזוג השינויים.",
    );
  const mutations: unknown[] = [];
  if (action === "unpublish") {
    if (!published) throw new ApiError(409, "המוצר כבר אינו מפורסם");
    const refs = await query<Doc[]>(
      env,
      "*[_id != $draftId && _id != $id && references($id)][0...101]",
      { id: key, draftId: "drafts." + key },
    );
    const strong = (value: unknown): boolean =>
      !!value &&
      typeof value === "object" &&
      (((value as { _ref?: string; _weak?: boolean })._ref === key &&
        !(value as { _weak?: boolean })._weak) ||
        Object.values(value).some(strong));
    if (refs.length >= 101 || refs.some(strong))
      throw new ApiError(
        409,
        "לא ניתן להסיר: המוצר משויך לתוכן נוסף באתר. פני למנהלת המערכת.",
      );
    if (draft)
      mutations.push({
        patch: {
          id: draft._id,
          ifRevisionID: draft._rev,
          set: { atelierAdminBaseRevision: null },
        },
      });
    else
      mutations.push({
        create: {
          ...clean(published),
          _type: "product",
          _id: "drafts." + key,
          atelierAdminBaseRevision: null,
        },
      });
    mutations.push(guard(published), { delete: { id: key } });
  } else {
    const base = draft ?? published;
    const values = fields(input, data, base, action === "publish");
    const slug = published?.slug ??
      base?.slug ?? {
        _type: "slug",
        current: productSlugify(String(values.name)) + "-" + key.slice(-8),
      };
    const value: Record<string, unknown> = {
      ...(base
        ? clean(base)
        : { currency: "ILS", featured: false, isNew: false, sortOrder: 100 }),
      ...values,
      slug,
      _type: "product",
    };
    if (!("category" in values)) delete value.category;
    if (action === "draft") {
      value.atelierAdminBaseRevision =
        draft && Object.hasOwn(draft, "atelierAdminBaseRevision")
          ? draft.atelierAdminBaseRevision
          : (published?._rev ?? null);
      if (draft)
        mutations.push({
          patch: {
            id: draft._id,
            ifRevisionID: draft._rev,
            set: value,
            ...(!("category" in values) ? { unset: ["category"] } : {}),
          },
        });
      else mutations.push({ create: { ...value, _id: "drafts." + key } });
    } else {
      delete value.atelierAdminBaseRevision;
      if (draft) mutations.push(guard(draft));
      if (published)
        mutations.push({
          patch: { id: key, ifRevisionID: published._rev, set: value },
        });
      else mutations.push({ create: { ...value, _id: key } });
      if (draft) mutations.push({ delete: { id: draft._id } });
    }
  }
  await mutate(env, mutations);
  // A failed refresh after a committed mutation must not turn into a misleading
  // retryable save failure. The caller receives acceptance before refreshing.
  return { ok: true };
}
export async function saveCategories(env: SanityEnv, input: unknown) {
  connection(env, true);
  if (!Array.isArray(input) || input.length > 200)
    throw new ApiError(400, "רשימת קטגוריות לא תקינה");
  const current = await catalog(env);
  const ids = new Set<string>(),
    names = new Set<string>();
  const mutations: unknown[] = [];
  const preserveOrder = current.categories.every(
    (c, index) => input[index]?.id === c._id,
  );
  const ranks = current.categories.map((c) => c.sortOrder);
  const orderedSlots = ranks.every(
    (rank, index) =>
      typeof rank === "number" &&
      Number.isFinite(rank) &&
      (index === 0 || rank > Number(ranks[index - 1])),
  );
  const lastRank = Math.max(
    -1,
    ...ranks.filter(
      (rank): rank is number =>
        typeof rank === "number" && Number.isFinite(rank),
    ),
  );
  for (let index = 0; index < input.length; index++) {
    const c = input[index] as Category;
    if (!c || typeof c !== "object")
      throw new ApiError(400, "קטגוריה לא תקינה");
    const key = id(c.id),
      name = text(c.name, 80, true);
    if (ids.has(key) || names.has(name))
      throw new ApiError(400, "קטגוריה כפולה");
    ids.add(key);
    names.add(name);
    const old = current.categories.find((d) => d._id === key);
    if ((c.revision ?? null) !== (old?._rev ?? null))
      throw new ApiError(409, "הקטגוריות השתנו. רענני את הרשימה.");
    const sortOrder =
      preserveOrder && old
        ? old.sortOrder
        : orderedSlots && index < ranks.length
          ? ranks[index]
          : preserveOrder || orderedSlots
            ? lastRank + index - ranks.length + 1
            : index;
    if (old && (old.name !== name || old.sortOrder !== sortOrder))
      mutations.push({
        patch: {
          id: key,
          ifRevisionID: old._rev,
          set: { name, ...(sortOrder !== undefined ? { sortOrder } : {}) },
        },
      });
    else if (!old)
      mutations.push({
        create: {
          _id: key,
          _type: "category",
          name,
          sortOrder,
          slug: {
            _type: "slug",
            current: productSlugify(name) + "-" + key.slice(-8),
          },
        },
      });
  }
  if (current.categories.some((c) => !ids.has(c._id)))
    throw new ApiError(400, "לא ניתן למחוק קטגוריות דרך הממשק");
  if (mutations.length) await mutate(env, mutations);
  return { ok: true };
}
