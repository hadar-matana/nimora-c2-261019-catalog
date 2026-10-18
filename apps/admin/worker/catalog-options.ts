import { ApiError, connection, mutate, query, type Doc, type SanityEnv } from './sanity';
import { cleanOption, defaultCatalogOptions, optionKey, type CatalogOptions } from '../src/lib/catalog-options';
const documentId = 'atelier-admin-catalog-options';
async function document(env: SanityEnv) {
  const rows = await query<Doc[]>(env, '*[_id==$id]', {id: documentId});
  if (!Array.isArray(rows) || rows.length > 1) throw new ApiError(502, "תשובת אפשרויות קטלוג לא תקינה");
  const doc = rows[0];
  if (doc && doc._type !== 'catalogOptions') throw new ApiError(409, 'מזהה אפשרויות הקטלוג נמצא בשימוש. פני למנהלת המערכת.');
  return doc;
}
function values(doc?: Doc): CatalogOptions {
  if (!doc) return defaultCatalogOptions();
  for (const kind of ['sizes', 'colors'] as const) {
    const list = doc[kind];
    if (!Array.isArray(list) || list.length > 100 || list.some(v => typeof v !== 'string' || !cleanOption(v) || v.length > (kind === 'sizes' ? 40 : 80)))
      throw new ApiError(502, 'אפשרויות הקטלוג אינן תקינות');
    if (new Set(list.map(optionKey)).size !== list.length) throw new ApiError(502, 'אפשרויות הקטלוג מכילות כפילויות');
  }
  return {sizes: doc.sizes as string[], colors: doc.colors as string[]};
}
export async function readOptions(env: SanityEnv) { return values(await document(env)); }
export async function changeOption(env: SanityEnv, input: Record<string, unknown>) {
  connection(env, true);
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ApiError(400, "אפשרות לא תקינה");
  if (!['sizes', 'colors'].includes(String(input.kind)) || !['add', 'remove', 'rename'].includes(String(input.action)) || typeof input.value !== 'string') throw new ApiError(400, 'אפשרות לא תקינה');
  const kind = input.kind as 'sizes' | 'colors', value = cleanOption(input.value);
  if (!value || value.length > (kind === 'sizes' ? 40 : 80) || /[\u0000-\u001f\u007f]/u.test(value)) throw new ApiError(400, 'יש להזין ערך תקין');
  const doc = await document(env), next = values(doc);
  const existing = next[kind].find(v => optionKey(v) === optionKey(value));
  if (input.action === 'add' && existing) return {value: existing}; // Idempotent duplicate addition.
  if (input.action === 'remove' && !existing) return {value};
  if (input.action === 'rename') {
    if (typeof input.previous !== 'string') throw new ApiError(400, 'אפשרות קודמת חסרה');
    const previous = next[kind].find(v => optionKey(v) === optionKey(input.previous as string));
    if (!previous) throw new ApiError(409, 'האפשרות השתנתה. רענני את הרשימה.');
    if (existing && optionKey(existing) !== optionKey(previous)) throw new ApiError(409, 'כבר קיימת אפשרות בשם הזה');
    next[kind] = next[kind].map(v => v === previous ? value : v);
  } else next[kind] = input.action === 'add' ? [...next[kind], value] : next[kind].filter(v => optionKey(v) !== optionKey(value));
  if (next[kind].length > 100) throw new ApiError(400, 'ניתן לשמור עד 100 אפשרויות מכל סוג');
  await mutate(env, doc ? [{patch:{id:documentId, ifRevisionID:doc._rev, set:{[kind]:next[kind]}}}] : [{create:{_id:documentId,_type:'catalogOptions',...next}}]);
  return {value};
}
