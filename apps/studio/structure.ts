import type {StructureResolver} from "sanity/structure";

export const structure: StructureResolver = (S) =>
  S.list()
    .id("admin-root")
    .title("ניהול האתר")
    .items([
      S.listItem()
        .id("products")
        .title("מוצרים")
        .schemaType("product")
        .child(S.documentTypeList("product").id("products-list").title("מוצרים")),
      S.listItem()
        .id("gallery")
        .title("גלריה")
        .schemaType("galleryImage")
        .child(S.documentTypeList("galleryImage").id("gallery-list").title("גלריה")),
      S.listItem()
        .id("categories")
        .title("קטגוריות")
        .schemaType("category")
        .child(S.documentTypeList("category").id("categories-list").title("קטגוריות")),
      S.listItem()
        .id("collections")
        .title("קולקציות")
        .schemaType("collection")
        .child(S.documentTypeList("collection").id("collections-list").title("קולקציות")),
      S.divider(),
      S.listItem()
        .id("site-settings")
        .title("הגדרות האתר")
        .child(S.document().schemaType("siteSettings").documentId("siteSettings").title("הגדרות האתר"))
    ]);
