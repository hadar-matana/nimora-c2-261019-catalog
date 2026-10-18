import { sizes, colors } from './model';
export type OptionKind = 'sizes' | 'colors';
export type CatalogOptions = { sizes: string[]; colors: string[] };
export const defaultCatalogOptions = (): CatalogOptions => ({ sizes: [...sizes], colors: colors.map(c => c.name) });
export const cleanOption = (value: string) => value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
export const optionKey = (value: string) => cleanOption(value).toLowerCase();
// Prefer exact saved product labels over equivalent reusable labels. Never rewrite
// existing product values merely because an option was removed or normalized.
export function visibleOptions(reusable: string[], selected: string[]) {
  return [...selected, ...reusable].filter((value, index, all) => all.findIndex(v => optionKey(v) === optionKey(value)) === index);
}
