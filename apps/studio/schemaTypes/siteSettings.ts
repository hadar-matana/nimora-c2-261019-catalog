import {defineField, defineType} from "sanity";

export const siteSettings = defineType({
  name: "siteSettings",
  title: "הגדרות האתר",
  type: "document",
  fields: [
    defineField({name: "aboutHeading", title: "אודות — כותרת", type: "string", validation: Rule => Rule.max(120)}),
    defineField({name: "aboutIntro", title: "אודות — פתיח", type: "text", rows: 3, validation: Rule => Rule.max(600)}),
    defineField({name: "aboutBody", title: "אודות — הסיפור שלנו", type: "text", rows: 12, description: "שורה ריקה מפרידה בין פסקאות", validation: Rule => Rule.max(12000)}),
    defineField({
      name: "displayName",
      title: "שם תצוגה",
      type: "string",
      initialValue: "ATELIER",
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
      title: "אינסטגרם",
      description: "שם משתמש כמו atelier.studio או קישור מלא לפרופיל, למשל https://www.instagram.com/atelier.studio/",
      type: "string",
      validation: (Rule) =>
        Rule.custom((value) => {
          if (!value) return true;
          const trimmed = value.trim();
          if (/^@?[a-zA-Z0-9._]{1,30}$/.test(trimmed)) return true;
          try {
            const url = new URL(trimmed);
            return /(^|\.)instagram\.com$/i.test(url.hostname) || "יש להזין שם משתמש באינסטגרם או קישור לפרופיל אינסטגרם.";
          } catch {
            return "יש להזין שם משתמש באינסטגרם או קישור לפרופיל אינסטגרם.";
          }
        })
    }),
    defineField({
      name: "whatsappNumber",
      title: "מספר WhatsApp",
      description: "מספר עסקי בפורמט בינלאומי. אפשר להזין לדוגמה 972501234567 או ‎+972 50 123 4567.",
      type: "string",
      validation: (Rule) =>
        Rule.custom((value) => {
          if (!value) return true;
          const digits = value.replace(/[^\d]/g, "");
          return (digits.length >= 8 && digits.length <= 15) || "יש להזין מספר WhatsApp תקין בפורמט בינלאומי.";
        })
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
