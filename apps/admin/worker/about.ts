import { ApiError, connection, mutate, query, type Doc, type SanityEnv } from './sanity';

// Match the storefront's deterministic published-settings selection. Never create
// a second settings document or publish unrelated pending Studio draft fields.
async function document(env: SanityEnv) {
  const rows = await query<Doc[]>(env, '*[_type=="siteSettings" && !(_id in path("drafts.**")) && !(_id in path("versions.**"))] | order(_id asc)[0...2]');
  if (!Array.isArray(rows)) throw new ApiError(502, 'לא ניתן לטעון את אודות');
  if (rows.length > 1) throw new ApiError(409, 'קיימות כמה הגדרות אתר. פני למנהלת המערכת לפני עריכה.');
  return rows[0];
}
function view(doc?: Doc) {
  return {
    revision: doc?._rev ?? null,
    heading: typeof doc?.aboutHeading === 'string' ? doc.aboutHeading : '',
    intro: typeof doc?.aboutIntro === 'string' ? doc.aboutIntro : '',
    body: typeof doc?.aboutBody === 'string' ? doc.aboutBody : '',
    editable: Boolean(doc),
  };
}
export async function readAbout(env: SanityEnv) { return view(await document(env)); }
export async function saveAbout(env: SanityEnv, input: Record<string, unknown>) {
  connection(env, true);
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ApiError(400, "בקשה לא תקינה");
  const limits = {heading: 120, intro: 600, body: 12000} as const;
  if (Object.keys(input).some(k => !['heading', 'intro', 'body', 'revision'].includes(k))) throw new ApiError(400, 'שדות לא מורשים');
  const fields: Record<string, string> = {};
  for (const [key, max] of Object.entries(limits)) {
    const value = input[key];
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) throw new ApiError(400, 'יש להזין טקסט תקין באורך המותר');
    fields[key] = value.trim();
  }
  const doc = await document(env);
  if (!doc) throw new ApiError(409, 'טרם הוגדרו הגדרות האתר. פני למנהלת המערכת.');
  if (typeof input.revision !== 'string' || input.revision !== doc._rev) throw new ApiError(409, 'התוכן השתנה. רענני את הדף לפני שמירה.');
  await mutate(env, [{patch: {id: doc._id, ifRevisionID: input.revision, set: {
    aboutHeading: fields.heading, aboutIntro: fields.intro, aboutBody: fields.body,
  }}}]);
  // Return a fresh revision only if it still belongs to the submitted content.
  const saved = await readAbout(env);
  if (saved.heading !== fields.heading || saved.intro !== fields.intro || saved.body !== fields.body) throw new ApiError(409, 'התוכן השתנה לאחר השמירה. רענני לפני שינוי נוסף.');
  return saved;
}
