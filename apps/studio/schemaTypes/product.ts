import {defineField, defineType} from "sanity";

export const product = defineType({
  name: "product",
  title: "מוצר",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "שם הפריט",
      type: "string",
      validation: (Rule) => Rule.required().min(2)
    }),
    defineField({
      name: "slug",
      title: "כתובת עמוד",
      type: "slug",
      options: {source: "name", maxLength: 96},
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "images",
      title: "תמונות",
      type: "array",
      of: [
        {
          type: "image",
          options: {hotspot: true},
          fields: [
            {
              name: "alt",
              title: "טקסט חלופי",
              type: "string",
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
      to: [{type: "category"}],
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "description",
      title: "תיאור",
      type: "text",
      rows: 4
    }),
    defineField({
      name: "priceAgorot",
      title: "מחיר באגורות",
      description: "לדוגמה: 12900 = ₪129",
      type: "number",
      validation: (Rule) => Rule.integer().min(0)
    }),
    defineField({
      name: "currency",
      title: "מטבע",
      type: "string",
      initialValue: "ILS",
      options: {
        list: [{title: "שקל חדש", value: "ILS"}]
      }
    }),
    defineField({
      name: "collections",
      title: "קולקציות",
      type: "array",
      of: [{type: "reference", to: [{type: "collection"}]}]
    }),
    defineField({
      name: "sizes",
      title: "מידות",
      type: "array",
      of: [{type: "string"}],
      options: {
        list: ["XS", "S", "M", "L", "XL", "36", "38", "40", "42", "One size"]
      }
    }),
    defineField({
      name: "colors",
      title: "צבעים",
      type: "array",
      of: [{type: "string"}]
    }),
    defineField({
      name: "featured",
      title: "מוצר נבחר",
      type: "boolean",
      initialValue: false
    }),
    defineField({
      name: "isNew",
      title: "חדש",
      type: "boolean",
      initialValue: false
    }),
    defineField({
      name: "sortOrder",
      title: "סדר תצוגה",
      type: "number",
      initialValue: 100
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
