import { chromium } from "playwright";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next"))("sharp");
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const shots = process.env.ADMIN_TEST_SHOTS || path.join(root, "docs/phase-a/admin-screenshots");
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
});
const base = process.env.ADMIN_TEST_URL || "http://127.0.0.1:3001";
const errors = [];
const external = new Set();
let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks++;
}
function button(page, name) {
  return page.getByRole("button", { name, exact: true });
}
async function shot(page, name) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
  });
  await page.screenshot({
    path: path.join(shots, name + ".png"),
    fullPage: !name.startsWith("preview-") && !name.startsWith("card-"),
    animations: "disabled",
  });
}
async function login(page) {
  await page.goto(base + "/login");
  await page.locator("#username").fill("atelier");
  await page.locator("#password").fill("demo123");
  await button(page, "כניסה לחנות").click();
  await page.getByRole("heading", { name: "שלום, טוב שאת כאן.", exact: true }).waitFor();
}
async function nav(page, name) {
  if (await page.getByRole("button", { name: "פתיחת תפריט", exact: true }).isVisible())
    await button(page, "פתיחת תפריט").click();
  await page.locator("nav").getByRole("link", { name, exact: true }).click();
}
async function noOverflow(page) {
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    "Horizontal overflow at " + (await page.viewportSize()).width,
  );
}
function observe(page) {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (request) => {
    if (!request.url().startsWith(base) && !request.url().startsWith("data:"))
      external.add(request.url());
  });
}

try {
  // Layout and touch-navigation checks at every requested breakpoint.
  for (const width of [375, 390, 768, 1280, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: width < 800 ? 844 : 1000 },
    });
    const page = await context.newPage();
    observe(page);
    await page.goto(base + "/products");
    await page.waitForURL("**/login");
    check((await page.locator("html").getAttribute("dir")) === "rtl", "RTL root");
    await shot(page, `login-${width}`);
    await noOverflow(page);
    await login(page);
    await shot(page, `dashboard-${width}`);
    await noOverflow(page);
    await nav(page, "המוצרים שלי");
    await page.getByRole("heading", { name: "המוצרים שלי", exact: true }).waitFor();
    check((await page.locator(".product-row").count()) === 5, "Seed products");
    await shot(page, `products-${width}`);
    await noOverflow(page);
    await page.getByRole("link", { name: "עריכת שמלת מקסי שחורה", exact: true }).click();
    await page.locator("#product-name").waitFor();
    await shot(page, `editor-${width}`);
    await noOverflow(page);
    await button(page, "תצוגה מקדימה").click();
    await shot(page, `preview-${width}`);
    await noOverflow(page);
    await button(page, "כרטיס בקטלוג").click();
    await shot(page, `card-${width}`);
    await button(page, "חזרה לעריכה").click();
    await button(page, "חזרה למוצרים").click();
    await nav(page, "אפשרויות הקטלוג");
    await page.getByRole("heading", { name: "אפשרויות הקטלוג", exact: true }).waitFor();
    await shot(page, `categories-${width}`);
    await noOverflow(page);
    await context.close();
    console.log(`PASS layouts and navigation: ${width}px`);
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  observe(page);
  await page.goto(base + "/login");
  await button(page, "כניסה לחנות").click();
  await page.getByRole("alert").filter({ hasText: "יש למלא" }).waitFor();
  await page.locator("#username").fill("unknown");
  await page.locator("#password").fill("wrong");
  await button(page, "הצגת סיסמה").click();
  check((await page.locator("#password").getAttribute("type")) === "text", "Show password");
  await button(page, "הסתרת סיסמה").click();
  await button(page, "כניסה לחנות").click();
  await page.getByRole("alert").filter({ hasText: "אינם נכונים" }).waitFor();
  await login(page);
  await nav(page, "המוצרים שלי");
  await page.getByRole("textbox", { name: "חיפוש לפי שם מוצר" }).fill("פשתן");
  check((await page.locator(".product-row").count()) === 1, "Search");
  await button(page, "ניקוי חיפוש").click();
  await page.getByRole("button", { name: /^טיוטות/ }).click();
  check((await page.locator(".product-row").count()) === 2, "Draft filter");
  await page.getByRole("button", { name: /^הכול/ }).click();
  await page.getByRole("combobox", { name: "סינון לפי קטגוריה" }).selectOption("jackets");
  check((await page.locator(".product-row").count()) === 1, "Category filter");
  await page.getByRole("textbox", { name: "חיפוש לפי שם מוצר" }).fill("אין כזה פריט");
  await page.getByRole("heading", { name: "לא נמצאו מוצרים", exact: true }).waitFor();
  await button(page, "ניקוי הסינון").click();
  check((await page.locator(".product-row").count()) === 5, "Reset filters");

  await page.getByRole("link", { name: "עריכת שמלת מקסי שחורה", exact: true }).click();
  await page.locator("#product-price").fill("777");
  await button(page, "חזרה למוצרים").click();
  await page.getByRole("dialog").waitFor();
  await button(page, "המשך עריכה").click();
  check(
    (await page.locator("#product-price").inputValue()) === "777",
    "Cancel discard preserves editor",
  );
  await page.goBack();
  await page.getByRole("dialog").waitFor();
  await button(page, "המשך עריכה").click();
  await button(page, "חזרה למוצרים").click();
  await button(page, "יציאה ללא שמירה").click();
  await page.getByRole("link", { name: "עריכת שמלת מקסי שחורה", exact: true }).click();
  check(
    (await page.locator("#product-price").inputValue()) === "249",
    "Published edits do not apply before Save Changes",
  );
  await page.locator("#product-price").fill("249.90");
  await button(page, "שמירת שינויים").click();
  await page.getByRole("heading", { name: "המוצרים שלי", exact: true }).waitFor();
  await page.getByRole("link", { name: "עריכת שמלת מקסי שחורה", exact: true }).click();
  check((await page.locator("#product-price").inputValue()) === "249.9", "Shekel decimal save");
  await button(page, "הסרה מהאתר").click();
  await button(page, "ביטול").click();
  check(await button(page, "שמירת שינויים").isVisible(), "Cancel unpublish");
  await button(page, "הסרה מהאתר").click();
  await button(page, "כן, הסרת המוצר").click();
  await page.getByRole("heading", { name: "המוצרים שלי", exact: true }).waitFor();
  check(
    (
      await page.getByRole("link", { name: "עריכת שמלת מקסי שחורה", exact: true }).textContent()
    ).includes("טיוטה"),
    "Unpublish retains draft",
  );
  check(
    (await page.getByRole("button", { name: "הסרה מהאתר", exact: true }).count()) === 0,
    "No row unpublish",
  );
  await page.getByRole("link", { name: "עריכת שמלת מקסי שחורה", exact: true }).click();
  await button(page, "פרסום מוצר").click();
  await page.getByRole("heading", { name: "המוצרים שלי", exact: true }).waitFor();
  check(
    (
      await page.getByRole("link", { name: "עריכת שמלת מקסי שחורה", exact: true }).textContent()
    ).includes("מפורסם באתר"),
    "Republish",
  );

  await nav(page, "הוספת מוצר");
  await button(page, "פרסום מוצר").click();
  check((await page.locator(".field-error").count()) === 4, "Required publication validation");
  await page.locator("#product-name").fill("פריט בדיקה חדש");
  await page.locator("#product-price").fill("12.345");
  await button(page, "שמירת טיוטה").click();
  check((await page.locator("#price-error").textContent()).includes("מחיר תקין"), "Invalid price");
  await page.locator("#product-price").fill("129.90");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "wrong.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an image"),
    });
  await page.locator(".field-error[role=alert]").filter({ hasText: "יש לבחור תמונת" }).waitFor();
  await page
    .locator("input[type=file]")
    .setInputFiles([
      {name: "dress.png", mimeType: "image/png", buffer: await sharp(path.join(root, "apps/admin/public/demo/dress.png")).resize(800).png().toBuffer()},
      {name: "blazer.png", mimeType: "image/png", buffer: await sharp(path.join(root, "apps/admin/public/demo/blazer.png")).resize(800).png().toBuffer()},
    ]);
  await page.locator(".image-tile").nth(1).waitFor();
  const before = await page.locator(".image-tile img").first().getAttribute("src");
  await button(page, "הקדמת תמונה 2").click();
  check(
    (await page.locator(".image-tile img").first().getAttribute("src")) !== before,
    "Accessible image reorder",
  );
  await page.locator(".image-tile").first().dragTo(page.locator(".image-tile").nth(1));
  check(
    (await page.locator(".image-tile img").first().getAttribute("src")) === before,
    "Drag image reorder",
  );
  await button(page, "הסרת תמונה 2").click();
  check((await page.locator(".image-tile").count()) === 1, "Remove image");
  await page
    .locator("input[type=file]")
    .setInputFiles({name: "blazer.png", mimeType: "image/png", buffer: await sharp(path.join(root, "apps/admin/public/demo/blazer.png")).resize(800).png().toBuffer()});
  await page.locator(".image-tile").nth(1).waitFor();
  await page.locator("#product-description").fill("תיאור לבדיקה לפני פרסום");
  await button(page, "תצוגה מקדימה").click();
  await page.getByRole("heading", { name: "פריט בדיקה חדש", exact: true }).waitFor();
  await button(page, "התמונה הבאה").click();
  await button(page, "כרטיס בקטלוג").click();
  check(await page.locator(".preview-card").isVisible(), "Catalog preview");
  await button(page, "חזרה לעריכה").click();
  check(
    (await page.locator("#product-description").inputValue()) === "תיאור לבדיקה לפני פרסום",
    "Preview preserves unsaved values",
  );
  await button(page, "שמירת טיוטה").click();
  await page.getByRole("heading", { name: "המוצרים שלי", exact: true }).waitFor();
  check(
    (
      await page.getByRole("link", { name: "עריכת פריט בדיקה חדש", exact: true }).textContent()
    ).includes("טיוטה"),
    "New draft",
  );
  await page.getByRole("link", { name: "עריכת פריט בדיקה חדש", exact: true }).click();
  await page.locator("#product-category").selectOption("dresses");
  await button(page, "פרסום מוצר").click();
  await page.getByRole("heading", { name: "המוצרים שלי", exact: true }).waitFor();
  check(
    (
      await page.getByRole("link", { name: "עריכת פריט בדיקה חדש", exact: true }).textContent()
    ).includes("מפורסם באתר"),
    "Publish with optional sizes/colors absent",
  );

  await nav(page, "אפשרויות הקטלוג");
  await page.locator("#category-name").fill("אקססוריז");
  await button(page, "הוספה").click();
  check((await page.locator(".category-row").count()) === 5, "Add category");
  await page.locator("#category-name").fill("אקססוריז");
  await button(page, "הוספה").click();
  await page.getByRole("alert").filter({ hasText: "כבר קיימת" }).waitFor();
  await button(page, "עריכת אקססוריז").click();
  await page.getByRole("textbox", { name: "שם קטגוריה חדש", exact: true }).fill("אביזרים");
  await button(page, "שמירת שם קטגוריה").click();
  check(
    (await page.locator(".category-row").last().textContent()).includes("אביזרים"),
    "Rename category",
  );
  await button(page, "הקדמת אביזרים").click();
  check(
    (await page.locator(".category-row").nth(3).textContent()).includes("אביזרים"),
    "Reorder categories",
  );
  check((await page.getByRole("button", { name: /מחיקה/ }).count()) === 0, "No permanent deletion");

  // Incremental loading after exceeding one page.
  for (let i = 0; i < 6; i++) {
    await nav(page, "הוספת מוצר");
    await page.locator("#product-name").fill("טיוטת עמוד " + i);
    await button(page, "שמירת טיוטה").click();
    await page.getByRole("heading", { name: "המוצרים שלי", exact: true }).waitFor();
  }
  check((await page.locator(".product-row").count()) === 10, "Initial page size");
  await button(page, "הצגת מוצרים נוספים").click();
  check((await page.locator(".product-row").count()) === 12, "Incremental loading");
  await button(page, "יציאה מהמערכת").click();
  await page.waitForURL("**/login");
  await page.goto(base + "/categories");
  await page.waitForURL("**/login");
  await page.reload();
  await login(page);
  await nav(page, "המוצרים שלי");
  await page.getByRole("heading", { name: "המוצרים שלי", exact: true }).waitFor();
  check((await page.locator(".product-row").count()) === 5, "Refresh resets mock data");
  check(
    await page.evaluate(() => localStorage.length === 0),
    "No localStorage credentials/content",
  );
  await context.close();
  check(errors.length === 0, "No browser errors: " + errors.join("; "));
  check(external.size === 0, "No external browser requests: " + [...external].join("; "));
  console.log(
    `PASS full mock lifecycle, uploads, categories, validation, auth simulation and pagination (${checks} assertions).`,
  );
} finally {
  await browser.close();
}
