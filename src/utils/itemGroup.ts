import type { InventoryItem } from '../types/models';

/** 系统默认分组：未勾选分组时落入此处 */
export const DEFAULT_OTHER_GROUP = '其他';

/** 展示用分组名：优先 item.group，否则 category，否则「其他」 */
export function itemDisplayGroup(item: Pick<InventoryItem, 'group' | 'category'>): string {
  const g = item.group?.trim();
  if (g) return g;
  const c = item.category?.trim();
  if (c) return c;
  return DEFAULT_OTHER_GROUP;
}

/** 保证分组列表含系统默认「其他」（置于末尾） */
export function ensureOtherGroup(groups: string[]): string[] {
  const cleaned = groups.map((g) => g.trim()).filter(Boolean);
  const without = cleaned.filter((g) => g !== DEFAULT_OTHER_GROUP);
  return [...without, DEFAULT_OTHER_GROUP];
}
