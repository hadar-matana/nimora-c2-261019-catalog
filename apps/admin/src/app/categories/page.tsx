"use client";
import { useRef, useState, type FormEvent } from "react";
import {
  Plus,
  ChevronUp,
  ChevronDown,
  Pencil,
  Check,
  X,
  LayoutGrid,
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { useAdmin } from "@/components/AdminContext";
import { CatalogValues } from "@/components/CatalogValues";
export default function CategoriesPage() {
  const [tab, setTab] = useState<"categories" | "sizes" | "colors">("categories");
  const { categories, products, setCategories, notify } = useAdmin();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");
  function validate(value: string, id?: string) {
    if (value.trim().length < 2)
      return "יש להזין שם קטגוריה עם לפחות שני תווים";
    if (categories.some((c) => c.id !== id && c.name.trim() === value.trim()))
      return "כבר קיימת קטגוריה בשם הזה";
    return "";
  }
  const saving = useRef(false);
  async function applyCategories(next: typeof categories) {
    if (saving.current) return false;
    saving.current = true;
    try {
      await setCategories(next);
      return true;
    } catch (failure) {
      notify(
        failure instanceof Error ? failure.message : "שמירת הקטגוריות נכשלה",
        "error",
      );
      return false;
    } finally {
      saving.current = false;
    }
  }
  async function add(event: FormEvent) {
    event.preventDefault();
    const message = validate(name);
    setError(message);
    if (message) return;
    if (
      !(await applyCategories([
        ...categories,
        { id: crypto.randomUUID(), name: name.trim() },
      ]))
    )
      return;
    setName("");
    notify("הקטגוריה נוספה בהצלחה");
  }
  async function rename() {
    const message = validate(editName, editing ?? undefined);
    setError(message);
    if (message) return;
    if (
      !(await applyCategories(
        categories.map((c) =>
          c.id === editing ? { ...c, name: editName.trim() } : c,
        ),
      ))
    )
      return;
    setEditing(null);
    notify("שם הקטגוריה עודכן");
  }
  async function move(index: number, offset: number) {
    const next = [...categories];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    if (!(await applyCategories(next))) return;
    notify("סדר הקטגוריות עודכן");
  }
  return (
    <Shell>
      <div className="page-heading">
        <div>
          <span className="eyebrow">סדר בקולקציה</span>
          <h1>אפשרויות הקטלוג</h1>
          <p>עזרי ללקוחות למצוא בדיוק את מה שהן מחפשות.</p>
        </div>
        <LayoutGrid className="heading-icon" size={28} strokeWidth={1.1} />
      </div>
      <div className="catalog-tabs" role="group" aria-label="סוג אפשרויות הקטלוג">{([["categories","קטגוריות"],["sizes","מידות"],["colors","צבעים"]] as const).map(([key,label])=><button type="button" className={`button ${tab===key?"primary":"secondary"}`} aria-pressed={tab===key} key={key} onClick={()=>setTab(key)}>{label}</button>)}</div>
      {tab !== "categories" ? <CatalogValues key={tab} kind={tab}/> : <section className="category-panel">
        <form className="category-add" onSubmit={add} noValidate>
          <label htmlFor="category-name">הוספת קטגוריה</label>
          <div>
            <input
              id="category-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="למשל, אקססוריז"
            />
            <button className="button primary">
              <Plus size={17} />
              הוספה
            </button>
          </div>
        </form>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="category-table-heading">
          <span>שם הקטגוריה</span>
          <span>מוצרים</span>
          <span>סדר תצוגה</span>
        </div>
        {categories.map((category, index) => (
          <div className="category-row" key={category.id}>
            <div className="category-identity">
              <span className="category-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              {editing === category.id ? (
                <form
                  className="category-rename"
                  onSubmit={(event) => {
                    event.preventDefault();
                    rename();
                  }}
                >
                  <input
                    aria-label="שם קטגוריה חדש"
                    value={editName}
                    maxLength={80}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                  />
                  <button className="icon-button" aria-label="שמירת שם קטגוריה">
                    <Check size={18} />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="ביטול עריכת קטגוריה"
                    onClick={() => {
                      setEditing(null);
                      setError("");
                    }}
                  >
                    <X size={17} />
                  </button>
                </form>
              ) : (
                <>
                  <strong>{category.name}</strong>
                  <button
                    className="icon-button"
                    aria-label={`עריכת ${category.name}`}
                    onClick={() => {
                      setEditing(category.id);
                      setEditName(category.name);
                      setError("");
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                </>
              )}
            </div>
            <span className="category-count">
              {products.filter((p) => p.categoryId === category.id).length}
              <span> מוצרים</span>
            </span>
            <div className="category-order">
              <button
                className="icon-button"
                aria-label={`הקדמת ${category.name}`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ChevronUp size={19} />
              </button>
              <button
                className="icon-button"
                aria-label={`הורדת ${category.name}`}
                disabled={index === categories.length - 1}
                onClick={() => move(index, 1)}
              >
                <ChevronDown size={19} />
              </button>
            </div>
          </div>
        ))}
        <p className="field-help category-help">
          סדר הקטגוריות כאן הוא גם סדר ההצגה בקטלוג. השינויים נשמרים לאחר אישור
          השרת.
        </p>
      </section>}
    </Shell>
  );
}
