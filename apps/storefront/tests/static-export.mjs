import assert from "node:assert/strict";
import {mkdtemp, mkdir, cp, readFile, writeFile, readdir, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";

// Real Next.js builds, fully isolated from CMS, credentials and tracked sources.
// Run: node apps/storefront/tests/static-export.mjs
const root = fileURLToPath(new URL("../../..", import.meta.url));
const dir = await mkdtemp(path.join(tmpdir(), "catalog-export-test-"));
const app = path.join(dir, "apps/storefront");
await mkdir(app, {recursive: true});
await cp(path.join(root, "apps/storefront"), app, {
  recursive: true,
  filter: source => !["node_modules", ".next", "out"].includes(path.basename(source)) && !/^\.env(?!\.example$)/.test(path.basename(source))
});
await cp(path.join(root, "packages"), path.join(dir, "packages"), {recursive: true});
// Reuse locked dependencies; only build inputs/outputs live in the temporary tree.
const {symlink} = await import("node:fs/promises");
await symlink(path.join(root, "node_modules"), path.join(dir, "node_modules"));
await symlink(path.join(root, "apps/storefront/node_modules"), path.join(app, "node_modules"));
await writeFile(path.join(dir, "package.json"), '{"private":true}');
const config = path.join(app, "next.config.ts");
const fixture = path.join(app, "tests/fixtures/sanity-client.mjs");
const fixtureSource = await readFile(fixture, "utf8");
await writeFile(config, (await readFile(config, "utf8")).replace('output: "export",', `output: "export",\n  webpack(config) { config.resolve.alias["@sanity/client"] = ${JSON.stringify(fixture)}; return config; },`));
async function htmlFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await htmlFiles(file));
    else if (entry.name.endsWith(".html")) result.push(file);
  }
  return result;
}
try {
  for (const [scenario, count] of [["empty", 0], ["drafts", 0], ["one", 1], ["multiple", 3]]) {
    await writeFile(fixture, fixtureSource.replaceAll("process.env.CATALOG_FIXTURE", JSON.stringify(scenario)));
    await rm(path.join(app, ".next"), {recursive: true, force: true});
    await rm(path.join(app, "out"), {recursive: true, force: true});
    const build = spawnSync("pnpm", ["build"], {
      cwd: app, encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
      env: {PATH: process.env.PATH, HOME: process.env.HOME, CI: "1", NEXT_TELEMETRY_DISABLED: "1",
        CATALOG_FIXTURE: scenario, NEXT_PUBLIC_DEPLOYMENT_KIND: "client",
        NEXT_PUBLIC_SANITY_PROJECT_ID: "unitcatalog", NEXT_PUBLIC_SANITY_DATASET: "catalog",
        NEXT_PUBLIC_SANITY_API_VERSION: "2025-02-19", NEXT_PUBLIC_SITE_URL: "https://fixture.example"}
    });
    assert.equal(build.status, 0, `${scenario}: ${build.stdout}\n${build.stderr}`);
    const files = await htmlFiles(path.join(app, "out"));
    const productFiles = files.filter(file => file.includes(`${path.sep}products${path.sep}`));
    assert.equal(productFiles.length, count, `${scenario}: only real product detail HTML is exported`);
    for (let i = 0; i < count; i++) {
      const html = await readFile(path.join(app, `out/products/garment-${i}/index.html`), "utf8");
      assert.ok(html.includes(`Fictional garment ${i}`));
    }
    for (const file of files) {
      const html = await readFile(file, "utf8");
      assert.ok(!html.includes("draft-only-garment"));
      assert.ok(!html.includes("another-client-garment"));
    }
    for (const page of ["index.html", "catalog/index.html"]) {
      const html = await readFile(path.join(app, "out", page), "utf8");
      assert.equal(html.includes("הקולקציה תעלה בקרוב"), count === 0);
      assert.equal((html.match(/class="catalog-card /g) ?? []).length, count);
      if (!count) assert.ok(!/href="\/products\//.test(html));
    }
    assert.ok((await readFile(path.join(app, "out/404.html"), "utf8")).includes("404"));
    console.log(`PASS ${scenario}: Next static export, ${count} real product routes, no draft/foreign routes, homepage/catalog and 404`);
  }
} finally {
  await rm(dir, {recursive: true, force: true});
}
