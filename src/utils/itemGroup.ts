import type { InventoryItem } from '../types/models';

/** 展示用分组名：优先 item.group，否则 category，否则「未分组」 */
export function itemDisplayGroup(item: Pick<InventoryItem, 'group' | 'category'>): string {
  const g = item.group?.trim();
  if (g) return g;
  const c = item.category?.trim();
  if (c) return c;
  return '未分组';
}
