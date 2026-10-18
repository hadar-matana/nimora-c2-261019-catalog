import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const base = "http://127.0.0.1:3002",
  fixture = "http://127.0.0.1:3003";
const account = JSON.parse(
  await readFile("/private/tmp/atelier-integration-account.json", "utf8"),
);
const results = [];
let cookie, csrf;
async function check(name, fn) {
  await fn();
  results.push(name);
  console.log("PASS", name);
}
async function request(path, body, status = 200, extra = {}) {
  const response = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Cookie: cookie ?? "",
      Origin: base,
      "X-CSRF-Token": csrf ?? "",
      "Content-Type": "application/json",
      "CF-Connecting-IP": "integration-suite-final",
      ...extra,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  assert.equal(response.status, status, JSON.stringify({ path, data }));
  return data;
}
const catalog = () => request("/api/catalog");
async function control(body) {
  await fetch(fixture + "/__control", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
const state = async () => await (await fetch(fixture + "/__state")).json();
const product = async (id) =>
  (await catalog()).products.find((p) => p.id === id);
const save = async (p, action, status = 200) =>
  request("/api/products/" + p.id, { product: p, action }, status);
await control({ reset: true });
await check(
  "All private reads/mutations require server authentication",
  async () => {
    await request("/api/catalog", undefined, 401);
    await request("/api/products/product-draft/preview", undefined, 401);
    await request("/api/products/x", { action: "draft" }, 401);
  },
);
await check(
  "Exact credentials, generic invalid-login error and secure session",
  async () => {
    await request(
      "/api/login",
      { username: account.username, password: account.password + " " },
      401,
    );
    const r = await fetch(base + "/api/login", {
      method: "POST",
      headers: {
        Origin: base,
        "Content-Type": "application/json",
        "CF-Connecting-IP": "integration-suite-final",
      },
      body: JSON.stringify(account),
    });
    assert.equal(r.status, 200);
    cookie = r.headers.get("set-cookie").split(";")[0];
    assert.match(r.headers.get("set-cookie"), /HttpOnly/);
    assert.match(r.headers.get("set-cookie"), /Secure/);
    csrf = (await r.json()).csrf;
    await writeFile(
      "/private/tmp/atelier-integration-session.json",
      JSON.stringify({ cookie, csrf }),
      { mode: 0o600 },
    );
  },
);
await check("All write tests refuse a non-fixture backend", async () => {
  assert.equal((await catalog()).environment, "fixture");
});
let asset;
await check(
  "Streaming real PNG upload returns only validated asset reference",
  async () => {
    const bytes = await readFile(
      new URL("../public/demo/dress.png", import.meta.url),
    );
    const r = await fetch(base + "/api/uploads", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: base,
        "X-CSRF-Token": csrf,
        "Content-Type": "image/png",
      },
      body: bytes,
    });
    assert.equal(r.status, 200);
    asset = await r.json();
    assert.equal(asset.bytes, bytes.length);
    assert.match(asset.assetId, /^image-[a-f0-9]{40}/);
    assert.ok(!JSON.stringify(asset).includes("isolated-sanity-fixture"));
  },
);
await check(
  "Native drafts are listed privately, never in public perspective",
  async () => {
    const data = await catalog();
    assert.equal(data.environment, "fixture");
    assert.equal(data.products.length, 3);
    assert.equal(data.products.filter((p) => p.status === "draft").length, 1);
    const url = new URL(fixture + "/v2025-02-19/data/query/production");
    url.searchParams.set("query", '*[_type=="product"]');
    url.searchParams.set("perspective", "published");
    const publicDocs = (
      await (
        await fetch(url, {
          headers: { Authorization: "Bearer isolated-sanity-fixture" },
        })
      ).json()
    ).result;
    assert.ok(publicDocs.every((p) => !p._id.startsWith("drafts.")));
    const preview = await request("/api/products/product-draft/preview");
    assert.equal(preview.name, "שמלת סאטן בז׳");
  },
);
let p = {
  id: randomUUID(),
  name: "מוצר בדיקה חדש",
  priceAgorot: 0,
  categoryId: "",
  description: "",
  sizes: [],
  colors: [],
  images: [],
  status: "draft",
  updatedAt: new Date().toISOString(),
};
await check(
  "Draft creation accepts incomplete details and creates drafts.ID only",
  async () => {
    await save(p, "draft");
    p = await product(p.id);
    const docs = (await state()).documents;
    assert.ok(docs.some((d) => d._id === "drafts." + p.id));
    assert.ok(!docs.some((d) => d._id === p.id));
  },
);
await check("Validation and CSRF failures never publish", async () => {
  await save(p, "publish", 400);
  await request("/api/products/" + p.id, { action: "draft", product: p }, 403, {
    "X-CSRF-Token": "wrong",
  });
  await save({ ...p, priceAgorot: 1.25 }, "draft", 400);
  await save(
    {
      ...p,
      images: [
        { id: randomUUID(), src: "https://invalid.example/test", alt: "תמונה" },
      ],
    },
    "draft",
    400,
  );
});
await check(
  "Publish creates stable public ID, retains slug and removes native draft atomically",
  async () => {
    const slug = (await state()).documents.find(
      (d) => d._id === "drafts." + p.id,
    ).slug;
    p = {
      ...p,
      priceAgorot: 19990,
      categoryId: "category-dresses",
      images: [{ ...asset, alt: "תמונת מוצר" }],
    };
    await save(p, "publish");
    p = await product(p.id);
    const docs = (await state()).documents;
    assert.equal(p.status, "published");
    assert.deepEqual(docs.find((d) => d._id === p.id).slug, slug);
    assert.ok(!docs.some((d) => d._id === "drafts." + p.id));
  },
);
await check(
  "Published edits persist only after save; existing technical fields and image crops survive",
  async () => {
    const original = await product("product-original"),
      before = (await state()).documents.find((d) => d._id === original.id);
    const changed = { ...original, name: "שם חדש לשמלה" };
    assert.equal((await product(original.id)).name, original.name);
    await save(changed, "publish");
    const after = (await state()).documents.find((d) => d._id === original.id);
    for (const key of ["slug", "featured", "collections", "custom"])
      assert.deepEqual(after[key], before[key]);
    assert.deepEqual(after.images[0].crop, before.images[0].crop);
    assert.deepEqual(after.images[0].hotspot, before.images[0].hotspot);
    assert.equal(after.images[0]._key, before.images[0]._key);
  },
);
await check(
  "Staged native draft does not change published content; stale revisions conflict",
  async () => {
    const fresh = await product(p.id);
    const originalRevision = (await state()).documents.find(
      (d) => d._id === p.id,
    )._rev;
    await save({ ...fresh, name: "גרסה פרטית שמורה" }, "draft");
    assert.equal(
      (await state()).documents.find((d) => d._id === p.id)._rev,
      originalRevision,
    );
    await save({ ...fresh, name: "עריכה ישנה" }, "publish", 409);
    const docs = (await state()).documents;
    assert.equal(docs.find((d) => d._id === p.id).name, "מוצר בדיקה חדש");
    assert.equal(
      docs.find((d) => d._id === "drafts." + p.id).name,
      "גרסה פרטית שמורה",
    );
    p = await product(p.id);
  },
);
await check(
  "Unpublish preserves saved native draft, ignores unsaved input and allows republishing",
  async () => {
    await save({ ...p, name: "לא לשמור את הטקסט הזה" }, "unpublish");
    p = await product(p.id);
    assert.equal(p.status, "draft");
    assert.equal(p.name, "גרסה פרטית שמורה");
    await save(p, "publish");
    p = await product(p.id);
    assert.equal(p.status, "published");
  },
);
await check(
  "Strong-reference unpublish blocked without data loss",
  async () => {
    const p = await product("product-referenced");
    const before = (await state()).documents;
    await save(p, "unpublish", 409);
    assert.deepEqual((await state()).documents, before);
  },
);
await check(
  "Image ordering and primary image persist through draft and publish",
  async () => {
    p = {
      ...p,
      images: [
        { ...asset, id: randomUUID(), alt: "שנייה" },
        { ...asset, id: randomUUID(), alt: "ראשונה" },
      ],
    };
    await save(p, "publish");
    p = await product(p.id);
    const first = p.images[0].id;
    p = { ...p, images: [...p.images].reverse() };
    await save(p, "publish");
    p = await product(p.id);
    assert.equal(p.images[1].id, first);
    const preview = await request("/api/products/" + p.id + "/preview");
    assert.equal(preview.images[0].id, p.images[0].id);
  },
);
await check(
  "Category create/rename/reorder preserve IDs, slugs, cover and references",
  async () => {
    let categories = (await catalog()).categories;
    const baseline = (await state()).documents.find(
      (d) => d._id === "category-dresses",
    );
    await request("/api/categories", {
      categories: [...categories, { id: randomUUID(), name: "קטגוריה חדשה" }],
    });
    const afterAppend = (await state()).documents.find(
      (d) => d._id === "category-dresses",
    );
    assert.equal(afterAppend._rev, baseline._rev);
    assert.equal(afterAppend.sortOrder, baseline.sortOrder);
    categories = (await catalog()).categories;
    categories = categories
      .reverse()
      .map((c) =>
        c.id === "category-dresses" ? { ...c, name: "שמלות ערב" } : c,
      );
    await request("/api/categories", { categories });
    const after = (await state()).documents.find(
      (d) => d._id === "category-dresses",
    );
    assert.deepEqual(after.slug, baseline.slug);
    assert.deepEqual(after.coverImage, baseline.coverImage);
    assert.equal(after.custom, baseline.custom);
    assert.equal(after.name, "שמלות ערב");
    await request("/api/categories", { categories: [] }, 400);
    await request("/api/categories", { categories }, 409);
  },
);
await check(
  "Mutation failures do not show success or alter fixture documents",
  async () => {
    const before = (await state()).documents;
    await control({ failNext: { operation: "mutate", status: 500 } });
    await save({ ...p, name: "שם שלא יישמר" }, "publish", 502);
    assert.deepEqual((await state()).documents, before);
  },
);
await check("Owners cannot permanently delete products", async () => {
  const r = await fetch(base + "/api/products/" + p.id, {
    method: "DELETE",
    headers: { Cookie: cookie, Origin: base, "X-CSRF-Token": csrf },
  });
  assert.equal(r.status, 405);
  assert.ok(await product(p.id));
});
await check('Reusable options: defaults, normalized additions, duplicate idempotence and isolated removal', async () => {
  let options = await request('/api/catalog-options');
  assert.ok(options.sizes.includes('XS'));
  const before = await state();
  await request('/api/catalog-options', {kind:'sizes',action:'add',value:'  xXL  '});
  await request('/api/catalog-options', {kind:'sizes',action:'add',value:'XXL'});
  await request('/api/catalog-options', {kind:'colors',action:'add',value:'כחול   ים'});
  options=await request('/api/catalog-options');
  assert.equal(options.sizes.filter(v=>v.toLowerCase()==='xxl').length,1);
  assert.ok(options.colors.includes('כחול ים'));
  await request('/api/catalog-options', {kind:'sizes',action:'rename',value:'XXL tall',previous:'xxl'});
  await request('/api/catalog-options', {kind:'sizes',action:'rename',value:'XS',previous:'XXL tall'},409);
  await request('/api/catalog-options', {kind:'sizes',action:'rename',value:'xXL',previous:'XXL tall'});
  const p=(await catalog()).products[0];
  p.sizes=['xXL','Vintage custom'];p.colors=['כחול ים'];
  await save(p,'draft');
  await request('/api/catalog-options', {kind:'sizes',action:'remove',value:'XXL'});
  await request('/api/catalog-options', {kind:'colors',action:'remove',value:'כחול ים'});
  const saved=await product(p.id);
  assert.deepEqual(saved.sizes,['xXL','Vintage custom']);assert.deepEqual(saved.colors,['כחול ים']);
  assert.ok(!(await request('/api/catalog-options')).sizes.includes('xXL'));
  const after=await state();
  assert.deepEqual(after.documents.filter(d=>d._type==='category'),before.documents.filter(d=>d._type==='category'));
});
await check('Option writes enforce session, CSRF, field bounds and document type', async()=>{
 await request('/api/catalog-options',{kind:'colors',action:'add',value:'probe'},403,{'X-CSRF-Token':'invalid'});
 for(const data of [{kind:'siteSettings',action:'add',value:'x'},{kind:'sizes',action:'replace',value:'x'},{kind:'sizes',action:'add',value:' '},{kind:'sizes',action:'add',value:'a'.repeat(41)}]) await request('/api/catalog-options',data,400);
 const r=await fetch(base+'/api/catalog-options',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,401);
 await control({patch:{id:'atelier-admin-catalog-options',set:{_type:'siteSettings'}}});
 await request('/api/catalog-options',{kind:'colors',action:'add',value:'blocked'},409);
 await control({patch:{id:'atelier-admin-catalog-options',set:{_type:'catalogOptions'}}});
});

await check('Empty reusable lists stay empty; option failures leave data intact', async()=>{
 const sizes=(await request('/api/catalog-options')).sizes;
 for(const value of sizes) await request('/api/catalog-options',{kind:'sizes',action:'remove',value});
 assert.deepEqual((await request('/api/catalog-options')).sizes,[]);
 const before=(await state()).documents;
 await control({failNext:{operation:'mutate',status:500}});
 await request('/api/catalog-options',{kind:'colors',action:'add',value:'fail-only'},502);
 assert.deepEqual((await state()).documents,before);
});
await writeFile(
  new URL(
    "../../../docs/admin-screenshots/integration-lifecycle.json",
    import.meta.url,
  ),
  JSON.stringify(
    {
      checks: results,
      environment:
        "local workerd + isolated GROQ/mutation fixture; no real Sanity mutations",
    },
    null,
    2,
  ) + "\n",
);

