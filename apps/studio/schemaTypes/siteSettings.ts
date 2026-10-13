import {defineField, defineType} from "sanity";

export const siteSettings = defineType({
  name: "siteSettings",
  title: "הגדרות האתר",
  type: "document",
  fields: [
    defineField({
      name: "displayName",
      title: "שם תצוגה",
      type: "string",
      initialValue: "גלריית אופנה",
      validation: (Rule) => Rule.required()
    }),
    defineField({
      name: "description",
      title: "תיאור קצר",
      type: "text",
      rows: 3
    }),
    defineField({
      name: "logo",
      title: "לוגו",
      type: "image",
      options: {hotspot: true},
      fields: [{name: "alt", title: "טקסט חלופי", type: "string"}]
    }),
    defineField({
      name: "accentColor",
      title: "צבע הדגשה",
      type: "string",
      description: "ערך HEX, לדוגמה #5D654E"
    }),
    defineField({
      name: "instagramUrl",
      title: "קישור אינסטגרם",
      type: "url"
    }),
    defineField({
      name: "whatsappNumber",
      title: "מספר WhatsApp",
      description: "בפורמט בינלאומי, לדוגמה 972501234567",
      type: "string"
    }),
    defineField({
      name: "contactEmail",
      title: "אימייל",
      type: "email"
    }),
    defineField({
      name: "showPrices",
      title: "להציג מחירים",
      type: "boolean",
      initialValue: true
    }),
    defineField({
      name: "enableInquiries",
      title: "להציג כפתורי בירור",
      type: "boolean",
      initialValue: true
    }),
    defineField({
      name: "demoMode",
      title: "מצב הדגמה",
      type: "boolean",
      initialValue: true
    })
  ],
  preview: {
    prepare() {
      return {
        title: "הגדרות האתר"
      };
    }
  }
});
