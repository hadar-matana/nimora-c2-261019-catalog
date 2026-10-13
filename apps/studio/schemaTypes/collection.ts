import {defineField, defineType} from "sanity";

export const collection = defineType({
  name: "collection",
  title: "קולקציה",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "שם",
      type: "string",
      validation: (Rule) => Rule.required().min(2)
    }),
    defineField({
      name: "slug",
      title: "כתובת",
      type: "slug",
      options: {source: "name", maxLength: 96},
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "description",
      title: "תיאור קצר",
      type: "text",
      rows: 3
    }),
    defineField({
      name: "coverImage",
      title: "תמונת כיסוי",
      type: "image",
      options: {hotspot: true},
      fields: [{name: "alt", title: "טקסט חלופי", type: "string"}]
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
      subtitle: "description",
      media: "coverImage"
    }
  }
});
