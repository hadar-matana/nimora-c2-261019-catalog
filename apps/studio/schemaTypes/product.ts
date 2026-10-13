import {defineField, defineType} from "sanity";
import {AutoSlugInput} from "../components/AutoSlugInput";
import {ProductImagesInput} from "../components/ProductImagesInput";
import {ShekelPriceInput} from "../components/ShekelPriceInput";
import {productSlugify} from "../lib/slug";

export const product = defineType({
  name: "product",
  title: "מוצר",
  type: "document",
  groups: [
    {name: "basic", title: "מידע בסיסי", default: true},
    {name: "details", title: "פרטי מוצר"},
    {name: "advanced", title: "הגדרות מתקדמות"}
  ],
  fields: [
    defineField({
      name: "name",
      title: "שם הפריט",
      type: "string",
      group: "basic",
      description: "שם ברור כפי שיופיע באתר.",
      validation: (Rule) => Rule.required().min(2)
    }),
    defineField({
      name: "images",
      title: "תמונות מוצר",
      type: "array",
      group: "basic",
      description: "התמונה הראשונה היא התמונה הראשית בקטלוג.",
      components: {input: ProductImagesInput},
      of: [
        {
          type: "image",
          options: {hotspot: true},
          fields: [
            {
              name: "alt",
              title: "טקסט חלופי",
              type: "string",
              description: "תיאור קצר של התמונה, למשל: שמלה שחורה מקדימה.",
              validation: (Rule) => Rule.required().min(2)
            }
          ]
        }
      ],
      validation: (Rule) => Rule.required().min(1)
    }),
    defineField({
      name: "category",
      title: "קטגוריה",
      type: "reference",
      group: "basic",
      to: [{type: "category"}],
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "priceAgorot",
      title: "מחיר (₪)",
      type: "number",
      group: "basic",
      components: {input: ShekelPriceInput},
      validation: (Rule) => Rule.integer().min(0)
    }),
    defineField({
      name: "description",
      title: "תיאור",
      type: "text",
      group: "details",
      description: "טקסט קצר שיעזור ללקוחה להבין את הבד, הגזרה והשימוש.",
      rows: 4
    }),
    defineField({
      name: "collections",
      title: "קולקציות",
      type: "array",
      group: "details",
      description: "שיוך לקולקציות עונתיות או עריכות מיוחדות.",
      of: [{type: "reference", to: [{type: "collection"}]}]
    }),
    defineField({
      name: "sizes",
      title: "מידות",
      type: "array",
      group: "details",
      of: [{type: "string"}],
      options: {
        list: ["XS", "S", "M", "L", "XL", "36", "38", "40", "42", "One size"]
      }
    }),
    defineField({
      name: "colors",
      title: "צבעים",
      type: "array",
      group: "details",
      of: [{type: "string"}]
    }),
    defineField({
      name: "featured",
      title: "מוצר נבחר",
      type: "boolean",
      group: "advanced",
      initialValue: false
    }),
    defineField({
      name: "isNew",
      title: "חדש",
      type: "boolean",
      group: "advanced",
      initialValue: false
    }),
    defineField({
      name: "sortOrder",
      title: "סדר תצוגה",
      type: "number",
      group: "advanced",
      description: "מספר נמוך יותר יופיע מוקדם יותר ברשימות.",
      initialValue: 100
    }),
    defineField({
      name: "currency",
      title: "מטבע",
      type: "string",
      group: "advanced",
      initialValue: "ILS",
      options: {
        list: [{title: "שקל חדש", value: "ILS"}]
      }
    }),
    defineField({
      name: "slug",
      title: "כתובת עמוד",
      type: "slug",
      group: "advanced",
      description: "נוצרת אוטומטית משם הפריט. אפשר לערוך ידנית במקרה הצורך.",
      components: {input: AutoSlugInput},
      options: {
        source: "name",
        maxLength: 96,
        slugify: (input) => productSlugify(input),
        isUnique: async (slug, context) => {
          const documentId = context.document?._id?.replace(/^drafts\./, "");
          return context.getClient({apiVersion: "2025-02-19"}).fetch(
            `!defined(*[
              _type == "product" &&
              slug.current == $slug &&
              !(_id in [$publishedId, $draftId])
            ][0]._id)`,
            {slug, publishedId: documentId, draftId: documentId ? `drafts.${documentId}` : undefined}
          );
        }
      },
      validation: (Rule) => Rule.required()
    })
  ],
  preview: {
    select: {
      title: "name",
      subtitle: "category.name",
      media: "images.0"
    }
  }
});
