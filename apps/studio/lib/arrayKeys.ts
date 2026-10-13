import {createHash} from "node:crypto";

type KeyableItem = {
  _key?: string;
  _type?: string;
  _ref?: string;
  asset?: {_ref?: string};
  alt?: string;
};

export function stableArrayKey(documentId: string, fieldName: string, index: number, item: KeyableItem | string) {
  const source =
    typeof item === "string"
      ? item
      : [item._ref, item.asset?._ref, item.alt, JSON.stringify(item)].filter(Boolean).join("|");

  return createHash("sha1")
    .update(`${documentId}:${fieldName}:${index}:${source}`)
    .digest("hex")
    .slice(0, 12);
}

export function withStableArrayKeys<T extends KeyableItem>(documentId: string, fieldName: string, items: T[] | undefined) {
  let changed = false;
  const keyedItems = (items ?? []).map((item, index) => {
    if (item._key) return item;
    changed = true;
    return {...item, _key: stableArrayKey(documentId, fieldName, index, item)};
  });

  return {changed, items: keyedItems};
}
