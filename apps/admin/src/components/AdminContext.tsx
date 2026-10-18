"use client";
import { createContext, useContext } from "react";
import type { AdminProduct, Category } from "@/lib/model";

export type AdminStore = {
  catalogOptions: import("@/lib/catalog-options").CatalogOptions;
  changeOption: (kind: import("@/lib/catalog-options").OptionKind, action: "add" | "remove" | "rename", value: string, previous?: string) => Promise<string>;
  ready?: boolean;
  environment?: "fixture" | "sanity";
  uploadImage?: (
    file: File,
    signal: AbortSignal,
  ) => Promise<import("@/lib/model").ProductImage>;
  unpublishProduct?: (product: AdminProduct) => Promise<void>;
  signedIn: boolean;
  login: (username: string, password: string) => boolean | Promise<boolean>;
  logout: () => void | Promise<void>;
  products: AdminProduct[];
  categories: Category[];
  saveProduct: (product: AdminProduct) => void | Promise<void>;
  setCategories: (categories: Category[]) => void | Promise<void>;
  notify: (message: string, kind?: "success" | "error") => void;
};
export const AdminContext = createContext<AdminStore | null>(null);

export function useAdmin() {
  const store = useContext(AdminContext);
  if (!store) throw new Error("An admin provider is required");
  return store;
}
