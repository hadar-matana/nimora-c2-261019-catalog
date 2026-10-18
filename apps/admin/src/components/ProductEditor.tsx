"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ImagePlus,
  Plus,
  X,
  Eye,
  ChevronRight,
  ChevronLeft,
  GripVertical,
  Check,
  LoaderCircle,
} from "lucide-react";
import { useAdmin } from "./AdminContext";
import { AddCatalogValue } from "./CatalogValues";
import { visibleOptions, optionKey } from "@/lib/catalog-options";
import { Dialog } from "./Dialog";
import { ProductPreview } from "./ProductPreview";
import { Status } from "./ProductList";
import {
  emptyProduct,
  colors,
  shekels,
  validateProduct,
  type AdminProduct,
  type ProductImage,
  type Publication,
} from "@/lib/model";

export function ProductEditor({ existing }: { existing?: AdminProduct }) {
  const store = useAdmin();
  const router = useRouter();
  const [product, setProduct] = useState<AdminProduct>(() =>
    structuredClone(existing ?? emptyProduct()),
  );
  const [priceInput, setPriceInput] = useState(
    existing ? String(existing.priceAgorot / 100) : "",
  );
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [upload, setUpload] = useState({ busy: false, percent: 0, error: "" });
  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState<"leave" | "unpublish" | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const pendingHref = useRef("/products");
  const saveLock = useRef(false);
  const uploadLock = useRef(false);
  const uploadAbort = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      uploadAbort.current?.abort();
    },
    [],
  );
  // Unsaved fields stay local. Uploaded files receive server-validated asset
  // references; no form data or credentials are placed in browser storage.
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    const linkClick = (event: MouseEvent) => {
      const logout = (event.target as HTMLElement).closest("[data-logout]");
      if (dirty && logout) {
        event.preventDefault();
        event.stopPropagation();
        pendingHref.current = "/login";
        setConfirm("leave");
        return;
      }
      const link = (event.target as HTMLElement).closest(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !dirty ||
        !link ||
        link.origin !== location.origin ||
        event.defaultPrevented
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      pendingHref.current = link.pathname + link.search;
      setConfirm("leave");
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", linkClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", linkClick, true);
    };
  }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    const editorUrl = location.href;
    const editorHistory = { ...history.state };
    // One same-page history entry lets browser Back present the same discard
    // confirmation as in-app navigation without unmounting the edited form.
    history.pushState(editorHistory, "", editorUrl);
    const back = (event: PopStateEvent) => {
      event.stopImmediatePropagation();
      history.pushState(editorHistory, "", editorUrl);
      pendingHref.current = "/products";
      setConfirm("leave");
    };
    window.addEventListener("popstate", back, true);
    return () => window.removeEventListener("popstate", back, true);
  }, [dirty]);
  function change<K extends keyof AdminProduct>(
    key: K,
    value: AdminProduct[K],
  ) {
    setProduct((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }
  function selectAdded(kind: "sizes" | "colors", value: string) {
    setProduct(current => current[kind].some(v => optionKey(v) === optionKey(value)) ? current : {...current, [kind]: [...current[kind], value]});
    setDirty(true);
  }
  function toggle(key: "sizes" | "colors", value: string) {
    change(
      key,
      product[key].includes(value)
        ? product[key].filter((v) => v !== value)
        : [...product[key], value],
    );
  }
  function leave() {
    if (dirty) {
      pendingHref.current = "/products";
      setConfirm("leave");
    } else router.push("/products");
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= product.images.length || from === to) return;
    const images = [...product.images];
    const [item] = images.splice(from, 1);
    images.splice(to, 0, item);
    change("images", images);
  }
  async function readFiles(files: File[]) {
    if (uploadLock.current || !files.length) return;
    if (files.length + product.images.length > 10) {
      setUpload({
        busy: false,
        percent: 0,
        error: "אפשר להוסיף עד 10 תמונות למוצר",
      });
      store.notify("אפשר להוסיף עד 10 תמונות למוצר", "error");
      return;
    }
    uploadLock.current = true;
    const controller = new AbortController();
    uploadAbort.current = controller;
    setUpload({ busy: true, percent: 0, error: "" });
    const added: ProductImage[] = [];
    const failures: string[] = [];
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      try {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
          throw new Error(`${file.name}: יש לבחור תמונת JPG, PNG או WebP`);
        if (file.size > 2 * 1024 * 1024)
          throw new Error(`${file.name}: התמונה גדולה מ־2MB`);
        const src = store.uploadImage
          ? URL.createObjectURL(file)
          : await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () =>
                reject(new Error("לא ניתן לקרוא את התמונה"));
              reader.readAsDataURL(file);
            });
        try {
          await new Promise<void>((resolve, reject) => {
            const image = new Image();
            image.onload = () =>
              image.naturalWidth * image.naturalHeight > 40_000_000
                ? reject(new Error("רזולוציית התמונה גבוהה מדי"))
                : resolve();
            image.onerror = () =>
              reject(new Error(`${file.name}: הקובץ אינו תמונה תקינה`));
            image.src = src;
          });
        } finally {
          if (store.uploadImage) URL.revokeObjectURL(src);
        }
        if (controller.signal.aborted) break;
        const uploaded = store.uploadImage
          ? await store.uploadImage(file, controller.signal)
          : { id: crypto.randomUUID(), src, alt: "" };
        added.push({ ...uploaded, alt: product.name || "תמונת מוצר" });
      } catch (error) {
        if (controller.signal.aborted) break;
        failures.push(
          error instanceof Error ? error.message : "לא ניתן להוסיף את התמונה",
        );
      }
      setUpload({
        busy: true,
        percent: Math.round(((index + 1) / files.length) * 100),
        error: "",
      });
    }
    if (controller.signal.aborted) {
      uploadLock.current = false;
      return;
    }
    if (added.length) {
      setProduct((current) => ({
        ...current,
        images: [...current.images, ...added],
      }));
      setDirty(true);
    }
    setUpload({ busy: false, percent: 100, error: failures.join(". ") });
    if (failures.length) store.notify(failures.join(". "), "error");
    uploadLock.current = false;
  }
  function selected(event: ChangeEvent<HTMLInputElement>) {
    void readFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }
  function dropped(event: DragEvent) {
    event.preventDefault();
    setDropActive(false);
    if (event.dataTransfer.files.length)
      void readFiles(Array.from(event.dataTransfer.files));
  }
  async function save(status: Publication) {
    if (saveLock.current || upload.busy) return;
    const validation = validateProduct(
      product,
      priceInput,
      status === "published",
    );
    setErrors(validation);
    if (Object.keys(validation).length) {
      store.notify("לא ניתן לשמור את המוצר. בדקי את הפרטים המסומנים.", "error");
      requestAnimationFrame(() =>
        form.current
          ?.querySelector<HTMLElement>(
            "[aria-invalid='true'], [data-invalid='true']",
          )
          ?.focus(),
      );
      return;
    }
    saveLock.current = true;
    setBusy(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 350));
      const saved = {
        ...product,
        name: product.name.trim(),
        priceAgorot: shekels(priceInput) ?? 0,
        status,
      };
      await store.saveProduct(saved);
      setProduct(saved);
      setDirty(false);
      store.notify(
        status === "draft"
          ? "הטיוטה נשמרה בהצלחה"
          : existing?.status === "published"
            ? "השינויים נשמרו בהצלחה"
            : "המוצר פורסם בהצלחה",
      );
      router.push("/products");
    } catch (failure) {
      store.notify(
        process.env.NEXT_PUBLIC_ADMIN_LOCAL_PROOF === "1" &&
          failure instanceof Error
          ? failure.message
          : "לא ניתן לשמור את המוצר. הפרטים נשארו בטופס, נסי שוב.",
        "error",
      );
    } finally {
      setBusy(false);
      saveLock.current = false;
    }
  }
  async function unpublish() {
    if (saveLock.current || upload.busy) return;
    saveLock.current = true;
    setBusy(true);
    // Keep saved content. Unsaved edits never replace the last saved published version.
    const saved = store.products.find((p) => p.id === product.id);
    if (!saved) {
      setConfirm(null);
      saveLock.current = false;
      setBusy(false);
      store.notify("לא ניתן להסיר את המוצר. המוצר השמור לא נמצא.", "error");
      return;
    }
    try {
      if (store.unpublishProduct) await store.unpublishProduct(saved);
      else await store.saveProduct({ ...saved, status: "draft" });
      setConfirm(null);
      setDirty(false);
      store.notify("המוצר הוסר מהאתר");
      router.push("/products");
    } catch (error) {
      setConfirm(null);
      store.notify(
        error instanceof Error
          ? error.message
          : "לא ניתן להסיר את המוצר מהאתר. נסי שוב.",
        "error",
      );
    } finally {
      saveLock.current = false;
      setBusy(false);
    }
  }
  const published = existing?.status === "published";
  const previewProduct = { ...product, priceAgorot: shekels(priceInput) ?? 0 };
  return (
    <>
      <div className="editor-heading">
        <div>
          <button className="back-link" onClick={leave}>
            <ArrowRight size={16} />
            חזרה למוצרים
          </button>
          <h1>{existing ? "עריכת מוצר" : "הוספת מוצר"}</h1>
        </div>
        {existing && <Status product={existing} />}
      </div>
      <form
        ref={form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save("published");
        }}
      >
        <section className="image-section">
          <div className="form-section-heading">
            <h2>תמונות</h2>
            <span>{product.images.length}/10</span>
          </div>
          <p className="primary-image-help">
            התמונה הראשונה תופיע כתמונה הראשית באתר
          </p>
          <input
            className="visually-hidden"
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            aria-label="בחירת תמונות מוצר"
            onChange={selected}
            disabled={upload.busy}
          />
          <div className="images-layout">
            <button
              type="button"
              className={`upload-zone ${dropActive ? "drag-active" : ""}`}
              onClick={() => input.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDropActive(true);
              }}
              onDragLeave={() => setDropActive(false)}
              onDrop={dropped}
              disabled={upload.busy || product.images.length >= 10}
              data-invalid={!!errors.images}
              aria-describedby={errors.images ? "images-error" : undefined}
            >
              {upload.busy ? (
                <LoaderCircle className="spin" size={29} />
              ) : (
                <ImagePlus size={30} strokeWidth={1.2} />
              )}
              <strong>
                {upload.busy
                  ? `מוסיפים תמונות… ${upload.percent}%`
                  : "העלאת תמונות"}
              </strong>
              <span>בחרי תמונות מהמחשב או מהטלפון</span>
              <span className="upload-button">
                {upload.busy ? "מעבדים את התמונות" : "בחירת תמונות"}
              </span>
              <small>JPG, PNG, WebP · עד 2MB לתמונה</small>
            </button>
            <div className="image-thumbnails">
              {product.images.map((image, index) => (
                <div
                  className={`image-tile${index === 0 ? " is-primary" : ""}`}
                  draggable={!upload.busy}
                  key={image.id}
                  onDragStart={(event) => {
                    setDragging(index);
                    event.dataTransfer.setData("text/plain", String(index));
                  }}
                  onDragEnd={() => setDragging(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragging !== null) move(dragging, index);
                    setDragging(null);
                  }}
                >
                  <img src={image.src} alt={image.alt} />
                  <button
                    className="remove-image"
                    type="button"
                    aria-label={`הסרת תמונה ${index + 1}`}
                    onClick={() =>
                      change(
                        "images",
                        product.images.filter((p) => p.id !== image.id),
                      )
                    }
                  >
                    <X size={14} />
                  </button>
                  {index === 0 && (
                    <span className="primary-image">
                      <Check size={11} aria-hidden="true" />
                      תמונה ראשית
                    </span>
                  )}
                  <div className="reorder-controls">
                    <button
                      type="button"
                      aria-label={`הקדמת תמונה ${index + 1}`}
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                    >
                      <ChevronRight size={15} />
                    </button>
                    <GripVertical size={13} />
                    <button
                      type="button"
                      aria-label={`העברת תמונה ${index + 1} לסוף`}
                      disabled={index === product.images.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      <ChevronLeft size={15} />
                    </button>
                  </div>
                </div>
              ))}
              {product.images.length > 0 && product.images.length < 10 && (
                <button
                  type="button"
                  className="add-image"
                  aria-label="הוספת תמונות נוספות"
                  onClick={() => input.current?.click()}
                  disabled={upload.busy}
                >
                  <Plus size={24} />
                </button>
              )}
            </div>
          </div>
          <p className="field-help">גררי תמונות לשינוי הסדר או השתמשי בחצים.</p>
          {errors.images && (
            <p className="field-error" id="images-error">
              {errors.images}
            </p>
          )}
          {upload.error && (
            <p className="field-error" role="alert">
              {upload.error}
            </p>
          )}
        </section>
        <div className="details-grid">
          <section className="basic-details">
            <div className="form-section-heading">
              <h2>פרטים בסיסיים</h2>
              <span>* שדות חובה לפרסום</span>
            </div>
            <div className="field">
              <label htmlFor="product-name">
                שם המוצר <span>*</span>
              </label>
              <input
                id="product-name"
                value={product.name}
                maxLength={120}
                onChange={(e) => change("name", e.target.value)}
                placeholder="למשל, שמלת מקסי שחורה"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "name-error" : undefined}
              />
              {errors.name && (
                <p className="field-error" id="name-error">
                  {errors.name}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="product-price">
                מחיר (₪) <span>*</span>
              </label>
              <input
                id="product-price"
                inputMode="decimal"
                dir="ltr"
                value={priceInput}
                onChange={(e) => {
                  setPriceInput(e.target.value);
                  setDirty(true);
                }}
                placeholder="249"
                aria-invalid={!!errors.price}
                aria-describedby={errors.price ? "price-error" : undefined}
              />
              {errors.price && (
                <p className="field-error" id="price-error">
                  {errors.price}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="product-category">
                קטגוריה <span>*</span>
              </label>
              <select
                id="product-category"
                value={product.categoryId}
                onChange={(e) => change("categoryId", e.target.value)}
                aria-invalid={!!errors.category}
                aria-describedby={
                  errors.category ? "category-error" : undefined
                }
              >
                <option value="">בחירת קטגוריה</option>
                {store.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="field-error" id="category-error">
                  {errors.category}
                </p>
              )}
            </div>
          </section>
          <section className="optional-details">
            <div className="form-section-heading">
              <h2>עוד קצת על הפריט</h2>
              <span>לא חובה</span>
            </div>
            <div className="field">
              <label htmlFor="product-description">תיאור המוצר</label>
              <textarea
                id="product-description"
                rows={4}
                value={product.description}
                maxLength={2000}
                onChange={(e) => change("description", e.target.value)}
                placeholder="כמה מילים על הבד, הגזרה או מה שהופך אותו למיוחד…"
              />
            </div>
            <fieldset>
              <legend>
                מידות <span>(לא חובה)</span>
              </legend>
              <div className="size-options" dir="ltr">
                {visibleOptions(store.catalogOptions.sizes, product.sizes).map((size) => (
                  <button
                    key={size}
                    type="button"
                    aria-pressed={product.sizes.includes(size)}
                    className={product.sizes.includes(size) ? "chosen" : ""}
                    onClick={() => toggle("sizes", size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <AddCatalogValue kind="sizes" onAdded={value=>selectAdded("sizes",value)}/>
              <p className="field-help">אפשרות חדשה נשמרת ברשימה מיד. הבחירה במוצר נשמרת רק בשמירת המוצר.</p>
            </fieldset>
            <fieldset>
              <legend>
                צבעים <span>(לא חובה)</span>
              </legend>
              <div className="color-options">
                {visibleOptions(store.catalogOptions.colors, product.colors).map((name) => ({name, hex: colors.find(c=>optionKey(c.name)===optionKey(name))?.hex ?? "#b9b1a7"})).map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    aria-pressed={product.colors.includes(color.name)}
                    className={`color-choice ${product.colors.includes(color.name) ? "chosen" : ""}`}
                    onClick={() => toggle("colors", color.name)}
                  >
                    <span
                      className="swatch"
                      style={{ background: color.hex }}
                    />
                    {color.name}
                  </button>
                ))}
              </div>
              <AddCatalogValue kind="colors" onAdded={value=>selectAdded("colors",value)}/>
            </fieldset>
          </section>
        </div>
        <div className="editor-actions">
          <button
            type="submit"
            className="button primary"
            disabled={busy || upload.busy}
          >
            {busy ? (
              <>
                <LoaderCircle className="spin" size={17} />
                שומרים…
              </>
            ) : published ? (
              "שמירת שינויים"
            ) : (
              "פרסום מוצר"
            )}
          </button>
          <button
            type="button"
            className="button"
            onClick={() => setPreview(true)}
            disabled={upload.busy}
          >
            <Eye size={18} />
            תצוגה מקדימה
          </button>
          {!published && (
            <button
              type="button"
              className="button draft-button"
              disabled={busy || upload.busy}
              onClick={() => void save("draft")}
            >
              שמירת טיוטה
            </button>
          )}
        </div>
      </form>
      {published && (
        <div className="unpublish-section">
          <div>
            <strong>הסרת המוצר מהאתר</strong>
            <p>המוצר יישאר שמור כטיוטה, ותוכלי לפרסם אותו שוב.</p>
          </div>
          <button
            className="text-danger"
            onClick={() => setConfirm("unpublish")}
          >
            הסרה מהאתר
          </button>
        </div>
      )}
      {preview && (
        <ProductPreview
          product={previewProduct}
          onClose={() => setPreview(false)}
        />
      )}
      {confirm === "leave" && (
        <Dialog title="לצאת בלי לשמור?" onClose={() => setConfirm(null)}>
          <p>יש שינויים שעדיין לא נשמרו. אם תצאי עכשיו, הם לא יישמרו.</p>
          <div className="dialog-actions">
            <button className="button primary" onClick={() => setConfirm(null)}>
              המשך עריכה
            </button>
            <button
              className="button"
              onClick={async () => {
                try {
                  if (pendingHref.current === "/login") await store.logout();
                  uploadAbort.current?.abort();
                  setDirty(false);
                  setConfirm(null);
                  router.push(pendingHref.current);
                } catch {
                  store.notify("היציאה נכשלה. נסי שוב.", "error");
                }
              }}
            >
              יציאה ללא שמירה
            </button>
          </div>
        </Dialog>
      )}
      {confirm === "unpublish" && (
        <Dialog
          title="האם להסיר את המוצר מהאתר?"
          onClose={() => setConfirm(null)}
        >
          <p>
            המוצר יישאר שמור כטיוטה וניתן יהיה לפרסם אותו שוב. שינויים שלא נשמרו
            לא ייכללו בטיוטה.
          </p>
          <p className="field-help">
            {store.environment === "sanity"
              ? "הקטלוג באתר יתעדכן לאחר האישור."
              : "פעולה זו משפיעה רק על סביבת הבדיקה המקומית."}
          </p>
          <div className="dialog-actions">
            <button className="button primary" onClick={unpublish}>
              כן, הסרת המוצר
            </button>
            <button className="button" onClick={() => setConfirm(null)}>
              ביטול
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
