import {readFile, readdir, rm} from "node:fs/promises";
import assert from "node:assert/strict";

// Optional catch-all's empty base path exists only to satisfy Next static export.
// Remove its 404 artifact so static hosting returns an actual 404, not HTTP 200.
const directory = new URL("../out/products/", import.meta.url);
try {
  const html = await readFile(new URL("index.html", directory), "utf8");
  assert.ok(html.includes('id="__next_error__"'), "Refusing to remove a non-404 product export");
  const entries = await readdir(directory, {withFileTypes: true});
  assert.ok(entries.every(entry => entry.isFile()), "Refusing to remove real product directories");
  await rm(directory, {recursive: true});
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
