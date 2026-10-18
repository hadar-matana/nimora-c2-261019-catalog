"use client";

import { useState, type ReactNode } from "react";
import { AdminContext } from "./AdminContext";
import { seedProducts, initialCategories } from "@/lib/mock-data";
import { acceptsMockCredentials } from "@/lib/mock-auth";
import { useToast } from "./ToastProvider";

import { defaultCatalogOptions, cleanOption, optionKey } from "@/lib/catalog-options";

// Deliberately in-memory only: no credentials, session or content persistence.
// Future auth/data adapters replace this provider; UI consumes plain view models.
export function MockProvider({ children }: { children: ReactNode }) {
  const [catalogOptions, setCatalogOptions] = useState(defaultCatalogOptions);
  const [signedIn, setSignedIn] = useState(false);
  const [products, setProducts] = useState(seedProducts);
  const [categories, setCategories] = useState(initialCategories);
  const { notify, dismissAll } = useToast();
  return (
    <AdminContext.Provider
      value={{
        catalogOptions,
        changeOption: async (kind, action, raw, previous) => {
          const value = cleanOption(raw);
          if(action === "rename") {
            if(catalogOptions[kind].some(v=>optionKey(v)===optionKey(value) && optionKey(v)!==optionKey(previous ?? ""))) throw new Error("כבר קיימת אפשרות בשם הזה");
            setCatalogOptions(current=>({...current,[kind]:current[kind].map(v=>optionKey(v)===optionKey(previous ?? "")?value:v)})); return value;
          }
          const existing = catalogOptions[kind].find(v => optionKey(v) === optionKey(value));
          setCatalogOptions(current => ({...current, [kind]:action === "remove" ? current[kind].filter(v => optionKey(v) !== optionKey(value)) : existing ? current[kind] : [...current[kind], value]}));
          return existing ?? value;
        },
        signedIn,
        products,
        categories,
        notify,
        setCategories,
        login: (username, password) => {
          const valid = acceptsMockCredentials(username, password);
          setSignedIn(valid);
          return valid;
        },
        logout: () => {
          setSignedIn(false);
          dismissAll();
        },
        saveProduct: (product) => {
          // Prepare the value before scheduling the update, so a failed mock
          // write can be reported by the caller without a premature success.
          const updated = structuredClone({
            ...product,
            updatedAt: new Date().toISOString(),
          });
          setProducts((current) => {
            return current.some((p) => p.id === updated.id)
              ? current.map((p) => (p.id === updated.id ? updated : p))
              : [updated, ...current];
          });
        },
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}
