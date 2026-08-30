import type { InventoryItem } from '../types/models';
import { itemDisplayGroup } from './itemGroup';
import { resolveItemStorageRoom } from './itemStorageRoom';

/** 物品自身字段（名称 / 编号 / 货号等） */
export function itemMatchesItemKeyword(item: InventoryItem, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return (
    item.name.toLowerCase().includes(t) ||
    (item.codeLabel ? item.codeLabel.toLowerCase().includes(t) : false) ||
    (item.sku ? item.sku.toLowerCase().includes(t) : false) ||
    (item.notes ? item.notes.toLowerCase().includes(t) : false)
  );
}

/** 默认检索：物品 / 分组 / 一级存储位置 */
export function itemMatchesBroadKeyword(
  item: InventoryItem,
  q: string,
  rooms: string[]
): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  if (itemMatchesItemKeyword(item, t)) return true;
  if (itemDisplayGroup(item).toLowerCase().includes(t)) return true;
  if (item.category.toLowerCase().includes(t)) return true;
  if (resolveItemStorageRoom(item, rooms).toLowerCase().includes(t)) return true;
  if (item.location?.toLowerCase().includes(t)) return true;
  return false;
}

export function filterItemsByBroadSearch(
  items: InventoryItem[],
  query: string,
  rooms: string[]
): InventoryItem[] {
  const t = query.trim();
  if (!t) return [...items];
  return items.filter((i) => itemMatchesBroadKeyword(i, t, rooms));
}

export function filterItemsByItemKeyword(
  items: InventoryItem[],
  query: string
): InventoryItem[] {
  const t = query.trim();
  if (!t) return [...items];
  return items.filter((i) => itemMatchesItemKeyword(i, t));
}
