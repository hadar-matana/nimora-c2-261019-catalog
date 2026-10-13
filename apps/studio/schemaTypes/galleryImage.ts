import {defineField, defineType} from "sanity";

export const galleryImage = defineType({
  name: "galleryImage",
  title: "תמונת גלריה",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "כותרת",
      type: "string"
    }),
    defineField({
      name: "caption",
      title: "כיתוב",
      type: "text",
      rows: 2
    }),
    defineField({
      name: "image",
      title: "תמונה",
      type: "image",
      options: {hotspot: true},
      fields: [
        {
          name: "alt",
          title: "טקסט חלופי",
          type: "string",
          validation: (Rule) => Rule.required().min(2)
        }
      ],
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "category",
      title: "קטגוריה",
      type: "reference",
      to: [{type: "category"}]
    }),
    defineField({
      name: "collection",
      title: "קולקציה",
      type: "reference",
      to: [{type: "collection"}]
    }),
    defineField({
      name: "product",
      title: "פריט מקושר",
      type: "reference",
      to: [{type: "product"}]
    }),
    defineField({
      name: "featured",
      title: "מוצג בעמוד הראשי",
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
      title: "title",
      subtitle: "caption",
      media: "image"
    },
    prepare({title, subtitle, media}) {
      return {
        title: title || "תמונת גלריה",
        subtitle,
        media
      };
    }
  }
});
