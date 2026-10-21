// Build-only provider double. Never referenced by application configuration.
function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

export function createClient(config) {
  requireValue(config.projectId === "unitcatalog", "Wrong client project");
  requireValue(config.dataset === "catalog", "Wrong dataset");
  requireValue(config.perspective === "published", "Drafts must never enter public builds");
  const count = {empty: 0, drafts: 0, one: 1, multiple: 3}[process.env.CATALOG_FIXTURE];
  requireValue(count !== undefined, "Unknown scenario");
  const published = Array.from({length: count}, (_, index) => ({
    _id: `published-${index}`, name: `Fictional garment ${index}`,
    slug: `garment-${index}`, description: "Synthetic regression fixture",
    priceAgorot: 12900, currency: "ILS", sizes: ["S", "M"], colors: ["כחול"],
    images: [{asset: {_id: `image-${"a".repeat(40)}-100x100-png`}, alt: "Synthetic garment"}]
  }));
  // These records exist in the provider fixture but not its published view.
  const drafts = process.env.CATALOG_FIXTURE === "empty" ? [] : [{_id: "drafts.hidden", slug: "draft-only-garment"}];
  const records = [
    ...[...published, ...drafts].map(document => ({projectId: "unitcatalog", document})),
    {projectId: "otherclient", document: {_id: "foreign", slug: "another-client-garment"}}
  ];
  const products = records.filter(record => record.projectId === config.projectId)
    .map(record => record.document).filter(document => !document._id.startsWith("drafts."));
  return {
    config: () => config,
    async fetch(query, params = {}) {
      if (query.includes('_type == "siteSettings"')) return {displayName: "Fixture Brand", description: "Fictional catalog", enableInquiries: false};
      if (query.includes('_type == "product"')) {
        if (query.includes("] .slug.current")) throw Error("Unexpected query");
        if (query.includes("].slug.current")) return products.map(p => p.slug);
        if (query.includes("slug.current == $slug")) return products.find(p => p.slug === params.slug) ?? null;
        if (query.includes("_id != $productId")) return products.filter(p => p._id !== params.productId);
        return products;
      }
      if (['_type == "category"', '_type == "collection"', '_type == "galleryImage"'].some(type => query.includes(type))) return [];
      throw Error("Unhandled fixture query");
    }
  };
}
