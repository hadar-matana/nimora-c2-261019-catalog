"use client";
import { useEffect, useState, type ReactNode } from "react";
import { AdminContext } from "./AdminContext";
import { useToast } from "./ToastProvider";
import type { AdminProduct, Category, ProductImage } from "@/lib/model";

import { defaultCatalogOptions, type CatalogOptions } from "@/lib/catalog-options";

// Same-origin authenticated data adapter. Fixture vs live is decided solely on
// the server; the browser never receives a Sanity token or writes to Sanity.
export function ApiProofProvider({ children }: { children: ReactNode }) {
  const [catalogOptions, setCatalogOptions] = useState(defaultCatalogOptions);
  const [ready, setReady] = useState(false),
    [signedIn, setSignedIn] = useState(false),
    [csrf, setCsrf] = useState("");
  const [products, setProducts] = useState<AdminProduct[]>([]),
    [categories, setCategories] = useState<Category[]>([]);
  const [environment, setEnvironment] = useState<"fixture" | "sanity">(
    "fixture",
  );
  const { notify, dismissAll } = useToast();
  const [loadError, setLoadError] = useState(false);
  async function request(path: string, options?: RequestInit) {
    const response = await fetch(path, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("לא ניתן להשלים את הבקשה. נסי שוב.");
    }
    if (response.status === 401) {
      setSignedIn(false);
      setCsrf("");
      setProducts([]);
      setCategories([]);
      setCatalogOptions(defaultCatalogOptions());
    }
    if (!response.ok) throw new Error(result.error ?? "הפעולה נכשלה. נסי שוב.");
    return result;
  }
  async function loadCatalog() {
    const data: {
      products: AdminProduct[];
      categories: Category[];
      environment: "fixture" | "sanity";
    } = await request("/api/catalog");
    const options = await request("/api/catalog-options") as CatalogOptions;
    setCatalogOptions(options);
    setLoadError(false);
    setProducts(data.products);
    setCategories(data.categories);
    setEnvironment(data.environment);
  }
  async function commit(path: string, data: unknown) {
    await request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
      body: JSON.stringify(data),
    });
    try {
      await loadCatalog();
    } catch {
      throw new Error(
        "השינוי נשמר אך הרשימה לא עודכנה. רענני את הדף לפני שינוי נוסף.",
      );
    }
  }
  useEffect(() => {
    let active = true;
    fetch("/api/session", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Session unavailable");
        const session = await response.json();
        if (!active) return;
        setCsrf(session.csrf);
        setSignedIn(true);
        try {
          await loadCatalog();
        } catch {
          setLoadError(true);
          notify("לא ניתן לטעון את הקטלוג. רענני את הדף.", "error");
        }
      })
      .catch(() => {
        if (active) setSignedIn(false);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
    // A single initial session check; the provider remains mounted on navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <AdminContext.Provider
      value={{
        catalogOptions,
        changeOption: async (kind, action, value, previous) => {
          const result = await request("/api/catalog-options", {method: "POST", headers: {"Content-Type":"application/json", "X-CSRF-Token":csrf}, body:JSON.stringify({kind,action,value,previous})});
          try { setCatalogOptions(await request("/api/catalog-options")); } catch { throw new Error("האפשרות נשמרה אך הרשימה לא עודכנה. רענני את הדף."); }
          return result.value;
        },
        ready,
        signedIn,
        products,
        categories,
        environment,
        notify,
        saveProduct: async (product) =>
          commit("/api/products/" + encodeURIComponent(product.id), {
            action: product.status === "published" ? "publish" : "draft",
            product,
          }),
        unpublishProduct: async (product) =>
          commit("/api/products/" + encodeURIComponent(product.id), {
            action: "unpublish",
            product,
          }),
        setCategories: async (categories) =>
          commit("/api/categories", { categories }),
        uploadImage: async (file, signal) =>
          (await request("/api/uploads", {
            method: "POST",
            headers: { "Content-Type": file.type, "X-CSRF-Token": csrf },
            body: file,
            signal,
          })) as ProductImage,
        login: async (username, password) => {
          const session = await request("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          });
          setCsrf(session.csrf);
          setSignedIn(true);
          setReady(false);
          try {
            await loadCatalog();
          } catch {
            setLoadError(true);
            notify("לא ניתן לטעון את הקטלוג. רענני את הדף.", "error");
          } finally {
            setReady(true);
          }
          return true;
        },
        logout: async () => {
          await request("/api/logout", {
            method: "POST",
            headers: { "X-CSRF-Token": csrf },
          });
          setSignedIn(false);
          setCsrf("");
          setProducts([]);
          setCategories([]);
      setCatalogOptions(defaultCatalogOptions());
          dismissAll();
        },
      }}
    >
      {signedIn && loadError ? (
        <main className="loading-screen" role="alert">
          לא ניתן לטעון את הקטלוג. רענני את הדף ונסי שוב.
        </main>
      ) : (
        children
      )}
    </AdminContext.Provider>
  );
}
