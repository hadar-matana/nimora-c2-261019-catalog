import {target} from "../deployment";
import {getCliClient} from "sanity/cli";

const client = getCliClient({apiVersion: target.apiVersion});

const galleryCaptions = [
  "מראה רך ונקי לשילוב יומיומי.",
  "שכבות קלילות עם נוכחות שקטה.",
  "פריט מרכזי ללוק ערב מינימלי.",
  "גזרה מחויטת שמתאימה לעונות מעבר.",
  "בסיס נוח לבנייה של כמה לוקים.",
  "הדפס עדין למראה קייצי ורענן.",
  "קו מידי נקי עם תחושה אלגנטית.",
  "חולצה משוחררת ליום עבודה או סוף שבוע.",
  "סט תואם למראה קליל ומסודר.",
  "פריט יומיומי שקל לשלב עם קולקציות שונות."
];

async function stabilizePublicContent() {
  await client
    .patch("siteSettings")
    .set({
      description: "קטלוג אופנה להמחשת גלריה, מוצרים ופניות לקוחות. הפריטים והתמונות להמחשה בלבד.",
      demoMode: false
    })
    .commit();

  for (const [index, caption] of galleryCaptions.entries()) {
    const id = `gallery-look-${index + 1}`;
    await client.patch(id).set({caption}).commit();
  }

  console.log("Updated site settings and gallery captions to remove prominent public demo/technical copy.");
}

stabilizePublicContent().catch((error) => {
  console.error(error);
  process.exit(1);
});
