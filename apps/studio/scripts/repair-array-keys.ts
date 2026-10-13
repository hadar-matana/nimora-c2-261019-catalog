import {getCliClient} from "sanity/cli";
import {withStableArrayKeys} from "../lib/arrayKeys";

const client = getCliClient({apiVersion: "2025-02-19"}).withConfig({perspective: "raw"});
const dryRun = process.argv.includes("--dry-run");

type ArrayItem = {
  _key?: string;
  _ref?: string;
  asset?: {_ref?: string};
  alt?: string;
};

type ProductDocument = {
  _id: string;
  name?: string;
  images?: ArrayItem[];
  collections?: ArrayItem[];
};

async function repairArrayKeys() {
  const products = await client.fetch<ProductDocument[]>(
    `*[_type == "product"]{
      _id,
      name,
      images,
      collections
    } | order(_id asc)`
  );

  let patched = 0;
  let inspected = 0;

  for (const product of products) {
    inspected += 1;
    const images = withStableArrayKeys(product._id, "images", product.images);
    const collections = withStableArrayKeys(product._id, "collections", product.collections);
    const patch: Partial<Pick<ProductDocument, "images" | "collections">> = {};

    if (images.changed) patch.images = images.items;
    if (collections.changed) patch.collections = collections.items;

    if (!Object.keys(patch).length) continue;

    patched += 1;
    console.log(`${dryRun ? "Would repair" : "Repairing"} ${product._id} (${product.name ?? "unnamed product"})`);

    if (!dryRun) {
      await client.patch(product._id).set(patch).commit({autoGenerateArrayKeys: false});
    }
  }

  console.log(`${dryRun ? "Dry run inspected" : "Inspected"} ${inspected} products; ${patched} product documents ${dryRun ? "need" : "received"} array key repairs.`);
}

repairArrayKeys().catch((error) => {
  console.error(error);
  process.exit(1);
});
