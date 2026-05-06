import type { InventoryItem } from '../types/models';

/** 按创建顺序比较 id（纯数字 id 按数值，否则按本地化数字序） */
export function compareItemIdForSort(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  const aIsNum = a !== '' && Number.isFinite(na) && String(na) === a;
  const bIsNum = b !== '' && Number.isFinite(nb) && String(nb) === b;
  if (aIsNum && bIsNum) return na - nb;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/** 展示用：连续整数从 1 起，至少三位左侧补零 */
export function formatInventoryCode(n: number): string {
  const k = Math.max(1, Math.floor(n));
  return String(k).padStart(3, '0');
}

/**
 * 按创建顺序（id）分配 1..n，并写回 inventoryNumber / codeLabel。
 * 不改变 items 数组顺序，仅更新编号字段（删除后自动补齐空位）。
 */
export function assignInventoryNumbers(items: InventoryItem[]): InventoryItem[] {
  if (items.length === 0) return items;
  const byCreation = [...items].sort((x, y) => compareItemIdForSort(x.id, y.id));
  const rank = new Map(byCreation.map((it, idx) => [it.id, idx + 1]));
  return items.map((it) => {
    const n = rank.get(it.id) ?? 1;
    return { ...it, inventoryNumber: n, codeLabel: formatInventoryCode(n) };
  });
}
