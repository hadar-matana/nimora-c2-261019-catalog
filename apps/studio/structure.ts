import type {StructureResolver} from "sanity/structure";

export const structure: StructureResolver = (S) =>
  S.list()
    .title("ניהול האתר")
    .items([
      S.documentTypeListItem("product").title("מוצרים"),
      S.documentTypeListItem("galleryImage").title("גלריה"),
      S.documentTypeListItem("category").title("קטגוריות"),
      S.documentTypeListItem("collection").title("קולקציות"),
      S.divider(),
      S.listItem()
        .title("הגדרות האתר")
        .child(S.document().schemaType("siteSettings").documentId("siteSettings").title("הגדרות האתר"))
    ]);
