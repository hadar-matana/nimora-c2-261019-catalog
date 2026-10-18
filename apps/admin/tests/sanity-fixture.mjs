// Isolated, in-memory Sanity HTTP contract fixture. Never contacts Sanity.
import { createServer } from "node:http";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import bcrypt from "bcryptjs";
const require = createRequire(import.meta.url);
const studioRequire = createRequire(
  new URL("../../studio/package.json", import.meta.url),
);
const { parse, evaluate } = createRequire(studioRequire.resolve("sanity"))(
  "groq-js",
);
const sharp = createRequire(require.resolve("next"))("sharp");
const account = {
  username: "atelier-owner",
  password: randomBytes(24).toString("base64url"),
  version: randomUUID(),
};
await writeFile(
  "/private/tmp/atelier-integration-account.json",
  JSON.stringify(account),
  { mode: 0o600 },
);
await writeFile(
  process.env.ATELIER_FIXTURE_VARS_PATH || new URL("../worker/.dev.vars", import.meta.url),
  `OWNER_USERNAME=${account.username}\nOWNER_PASSWORD_HASH=${await bcrypt.hash(account.password, 12)}\nCREDENTIAL_VERSION=${account.version}\nSANITY_MODE=fixture\nSANITY_FIXTURE_ORIGIN=http://127.0.0.1:3003\n`,
  { mode: 0o600 },
);
let docs = new Map(),
  files = new Map(),
  events = [],
  failNext,
  assetResponse;
const stamp = (d) => ({
  ...d,
  _rev: randomUUID(),
  _updatedAt: new Date().toISOString(),
  _createdAt: d._createdAt ?? new Date().toISOString(),
});
const strong = (obj, id) =>
  obj &&
  typeof obj === "object" &&
  ((obj._ref === id && !obj._weak) ||
    Object.values(obj).some((v) => strong(v, id)));
async function seed() {
  docs = new Map();
  files = new Map();
  events = [];
  failNext = undefined;
  assetResponse = undefined;
  for (const [name, file] of [
    ["שמלת מקסי שחורה", "dress.png"],
    ["בלייזר מחויט", "blazer.png"],
  ]) {
    const bytes = await readFile(
      new URL("../public/demo/" + file, import.meta.url),
    );
    const asset = await assetDoc(bytes, "image/png");
    docs.set(asset._id, stamp(asset));
  }
  const assets = [...docs.values()];
  docs.set(
    "category-dresses",
    stamp({
      _id: "category-dresses",
      _type: "category",
      name: "שמלות",
      slug: { current: "original-category" },
      sortOrder: 0,
      coverImage: { asset: { _ref: assets[0]._id } },
      custom: "retain-category",
    }),
  );
  docs.set(
    "category-jackets",
    stamp({
      _id: "category-jackets",
      _type: "category",
      name: "ז׳קטים",
      slug: { current: "jackets" },
      sortOrder: 1,
    }),
  );
  const base = {
    _type: "product",
    name: "שמלת מקסי שחורה",
    priceAgorot: 24900,
    category: { _type: "reference", _ref: "category-dresses" },
    description: "שמלת מקסי אלגנטית מבד רך ונעים.",
    sizes: ["XS", "S", "M"],
    colors: ["שחור"],
    slug: { _type: "slug", current: "original-black-dress" },
    featured: true,
    collections: [
      { _key: "c1", _type: "reference", _ref: "collection-summer" },
    ],
    custom: { preserve: "yes" },
    images: [
      {
        _key: "original-image",
        _type: "image",
        alt: "שמלה שחורה",
        asset: { _type: "reference", _ref: assets[0]._id },
        crop: { top: 0.1, bottom: 0, left: 0, right: 0 },
        hotspot: { x: 0.5, y: 0.4, width: 1, height: 0.8 },
      },
    ],
  };
  docs.set(
    "collection-summer",
    stamp({ _id: "collection-summer", _type: "collection", name: "קיץ" }),
  );
  docs.set("product-original", stamp({ ...base, _id: "product-original" }));
  docs.set(
    "product-referenced",
    stamp({
      ...base,
      _id: "product-referenced",
      name: "בלייזר מחויט",
      slug: { current: "original-blazer" },
      images: [
        {
          _key: "blazer",
          _type: "image",
          asset: { _type: "reference", _ref: assets[1]._id },
          alt: "בלייזר",
        },
      ],
    }),
  );
  docs.set(
    "gallery-original",
    stamp({
      _id: "gallery-original",
      _type: "galleryImage",
      product: { _type: "reference", _ref: "product-referenced" },
    }),
  );
  docs.set(
    "drafts.product-draft",
    stamp({
      ...base,
      _id: "drafts.product-draft",
      name: "שמלת סאטן בז׳",
      slug: { current: "draft-satin" },
    }),
  );
}
async function assetDoc(bytes, type) {
  const meta = await sharp(bytes).metadata();
  const ext =
    type === "image/jpeg" ? "jpg" : type === "image/webp" ? "webp" : "png";
  const hash = createHash("sha1").update(bytes).digest("hex");
  const id = `image-${hash}-${meta.width}x${meta.height}-${ext}`;
  files.set(id, { bytes, type });
  return {
    _id: id,
    _type: "sanity.imageAsset",
    url: "http://127.0.0.1:3003/images/" + id.replace(/^image-/, "").replace(/-(png|jpg|webp)$/, ".$1"),
    size: bytes.length,
    mimeType: type,
    metadata: { dimensions: { width: meta.width, height: meta.height } },
  };
}
await seed();
function send(res, status, value) {
  res
    .writeHead(status, { "Content-Type": "application/json" })
    .end(JSON.stringify(value));
}
async function bytes(req) {
  const parts = [];
  for await (const chunk of req) parts.push(chunk);
  return Buffer.concat(parts);
}
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1:3003");
    if (url.pathname.startsWith("/images/")) {
      const image = files.get("image-" + url.pathname.slice(8).replace(/\.(png|jpg|webp)$/, "-$1"));
      if (!image) return send(res, 404, {});
      res.writeHead(200, { "Content-Type": image.type }).end(image.bytes);
      return;
    }
    if (url.pathname === "/__control") {
      const control = JSON.parse((await bytes(req)).toString());
      if (control.reset) await seed();
      if (control.failNext) failNext = control.failNext;
      if (control.assetResponse) assetResponse = control.assetResponse;
      if (control.patch) {
        const old = docs.get(control.patch.id);
        docs.set(old._id, stamp({ ...old, ...control.patch.set }));
      }
      return send(res, 200, { ok: true });
    }
    if (url.pathname === "/__state")
      return send(res, 200, { documents: [...docs.values()], events });
    if (req.headers.authorization !== "Bearer isolated-sanity-fixture")
      return send(res, 401, { error: "fixture-token-required" });
    if (url.pathname.includes("/data/query/")) {
      const params = Object.fromEntries(
        [...url.searchParams]
          .filter(([k]) => k.startsWith("$"))
          .map(([k, v]) => [k.slice(1), JSON.parse(v)]),
      );
      const dataset =
        url.searchParams.get("perspective") === "published"
          ? [...docs.values()].filter((d) => !d._id.startsWith("drafts."))
          : [...docs.values()];
      const result = await (
        await evaluate(parse(url.searchParams.get("query")), {
          dataset,
          params,
        })
      ).get();
      return send(res, 200, { result });
    }
    if (url.pathname.includes("/data/mutate/")) {
      if (failNext?.operation === "mutate") {
        const value = failNext;
        failNext = undefined;
        return send(res, value.status, {
          error: "private-fixture-mutation-detail",
        });
      }
      const { mutations } = JSON.parse((await bytes(req)).toString());
      const next = new Map(structuredClone([...docs]));
      for (const mutation of mutations) {
        if (mutation.create) {
          const d = mutation.create;
          if (next.has(d._id)) return send(res, 409, { error: "duplicate" });
          next.set(d._id, stamp(d));
        } else if (mutation.patch) {
          const p = mutation.patch;
          const d = next.get(p.id);
          if (!d || d._rev !== p.ifRevisionID)
            return send(res, 409, { error: "revision" });
          const changed = { ...d, ...p.set };
          for (const key of p.unset ?? []) delete changed[key];
          next.set(p.id, stamp(changed));
        } else if (mutation.delete) next.delete(mutation.delete.id);
        else return send(res, 400, { error: "unsupported-fixture-mutation" });
      }
      for (const old of docs.values())
        if (
          !next.has(old._id) &&
          [...next.values()].some((d) => strong(d, old._id))
        )
          return send(res, 409, { error: "strong-reference" });
      docs = next;
      events.push({
        type: "mutation",
        ids: mutations.map((m) => m.create?._id ?? m.patch?.id ?? m.delete?.id),
      });
      return send(res, 200, { transactionId: randomUUID(), results: [] });
    }
    if (url.pathname.includes("/assets/images/")) {
      const mode = assetResponse;
      assetResponse = undefined;
      if (mode === "early") return send(res, 200, { document: {} });
      if (failNext?.operation === "upload") {
        const value = failNext;
        failNext = undefined;
        await bytes(req);
        return send(res, value.status, {
          error: "private-fixture-upload-detail",
        });
      }
      let count = 0;
      const start = Date.now();
      const parts = [];
      try {
        for await (const chunk of req) {
          if (!count)
            events.push({ type: "upload-first-chunk", at: Date.now() });
          count += chunk.length;
          parts.push(chunk);
        }
      } catch {
        events.push({ type: "upload-aborted", bytes: count });
        return;
      }
      const buffer = Buffer.concat(parts);
      let document;
      try {
        document = await assetDoc(buffer, req.headers["content-type"]);
      } catch {
        return send(res, 400, { error: "invalid-image-decoding" });
      }
      if (mode === "invalid")
        return send(res, 200, {
          document: {
            ...document,
            url: "https://other.invalid/image",
            size: 1,
          },
        });
      docs.set(document._id, stamp(document));
      events.push({
        type: "upload-complete",
        bytes: count,
        elapsedMs: Date.now() - start,
      });
      return send(res, 200, { document });
    }
    send(res, 404, {});
  } catch {
    if (!res.headersSent) send(res, 400, { error: "fixture-error" });
  }
});
server.listen(3003, "127.0.0.1", () =>
  console.log(
    "Isolated authenticated Sanity contract fixture ready on loopback; no remote writes.",
  ),
);
