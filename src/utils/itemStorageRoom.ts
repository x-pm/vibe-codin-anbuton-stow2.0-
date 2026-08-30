import type { InventoryItem } from '../types/models';

/** 未匹配到一级房间时的分组名 */
export const UNSET_STORAGE_ROOM = '未设置';

/** 未匹配到二级储物设备时的分组名 */
export const UNSET_STORAGE_EQUIPMENT = '未设置';

/**
 * 将物品 location 解析为一级存储位置（房间）。
 * 仅认房间列表中的名称；旧版自由文本若不匹配任一房间，归入「未设置」，
 * 不把历史杂项位置当作独立分组。
 */
export function resolveItemStorageRoom(
  item: Pick<InventoryItem, 'location'>,
  rooms: string[]
): string {
  const loc = item.location?.trim();
  if (!loc) return UNSET_STORAGE_ROOM;
  if (rooms.includes(loc)) return loc;

  // 兼容「厨房 · 大柜子」或含房间名的旧文案：取最长命中房间
  let best: string | undefined;
  for (const r of rooms) {
    if (!r) continue;
    if (loc.includes(r) || r.includes(loc)) {
      if (!best || r.length > best.length) best = r;
    }
  }
  return best ?? UNSET_STORAGE_ROOM;
}

/**
 * 将物品 locationDetail 解析为二级储物设备（大柜子、小柜子等）。
 */
export function resolveItemStorageEquipment(
  item: Pick<InventoryItem, 'locationDetail'>,
  storageEquipment: string[]
): string {
  const detail = item.locationDetail?.trim();
  if (!detail) return UNSET_STORAGE_EQUIPMENT;
  if (storageEquipment.includes(detail)) return detail;

  let best: string | undefined;
  for (const eq of storageEquipment) {
    if (!eq) continue;
    if (detail.includes(eq) || eq.includes(detail)) {
      if (!best || eq.length > best.length) best = eq;
    }
  }
  return best ?? UNSET_STORAGE_EQUIPMENT;
}
