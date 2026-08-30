import AsyncStorage from '@react-native-async-storage/async-storage';
import type { InventoryItem, ItemPlan } from '../types/models';
import type { CloudAuthProfile } from './cloudbase';
import { normalizeChinaPhone } from './cloudbase';

/** 旧版单机一份快照（升级后迁移到对应用户） */
const LEGACY_STORAGE_KEY = '@stow/local_snapshot_v1';

export type StowLocalSnapshot = {
  v: 1;
  /** 本机/云端对账用的修改时间（ms） */
  updatedAt?: number;
  items: InventoryItem[];
  plans: ItemPlan[];
  groups: string[];
  /** 一级存储位置（房间）；缺省时由 DataContext 回填默认列表 */
  rooms?: string[];
  /** 二级储物设备；缺省时由 DataContext 回填默认列表 */
  storageEquipment?: string[];
  /** 用户为储物设备上传的外观图（名称 → 本地或云端 URI） */
  storageEquipmentImages?: Record<string, string>;
  profileDisplayName: string;
  profileAvatarUri?: string;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function parseStringRecord(raw: unknown): Record<string, string> | undefined {
  if (!isRecord(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.trim() && typeof v === 'string' && v.trim()) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseSnapshot(raw: string | null): StowLocalSnapshot | null {
  if (raw == null || raw === '') return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.v !== 1) return null;
    if (!Array.isArray(parsed.items) || !Array.isArray(parsed.plans) || !Array.isArray(parsed.groups)) {
      return null;
    }
    const roomsRaw = parsed.rooms;
    const rooms =
      Array.isArray(roomsRaw) && roomsRaw.every((r) => typeof r === 'string')
        ? (roomsRaw as string[])
        : undefined;
    const equipmentRaw = parsed.storageEquipment;
    const storageEquipment =
      Array.isArray(equipmentRaw) && equipmentRaw.every((r) => typeof r === 'string')
        ? (equipmentRaw as string[])
        : undefined;
    const storageEquipmentImages = parseStringRecord(parsed.storageEquipmentImages);

    return {
      v: 1,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : undefined,
      items: parsed.items as InventoryItem[],
      plans: parsed.plans as ItemPlan[],
      groups: parsed.groups as string[],
      rooms,
      storageEquipment,
      storageEquipmentImages,
      profileDisplayName:
        typeof parsed.profileDisplayName === 'string' ? parsed.profileDisplayName : '',
      profileAvatarUri:
        parsed.profileAvatarUri === undefined || parsed.profileAvatarUri === null
          ? undefined
          : String(parsed.profileAvatarUri),
    };
  } catch {
    return null;
  }
}

/** 云账号 → 本机数据分区键（同账号稳定，不同账号隔离） */
export function storageOwnerKeyFromProfile(profile: CloudAuthProfile): string {
  if (profile.sub?.trim()) return `sub:${profile.sub.trim()}`;
  if (profile.phone?.trim()) {
    return `phone:${normalizeChinaPhone(profile.phone).replace(/\s+/g, '')}`;
  }
  if (profile.email?.trim()) return `email:${profile.email.trim().toLowerCase()}`;
  if (profile.username?.trim()) return `user:${profile.username.trim().toLowerCase()}`;
  return `label:${profile.label.trim() || 'unknown'}`;
}

function userStorageKey(ownerKey: string): string {
  return `${LEGACY_STORAGE_KEY}/u/${encodeURIComponent(ownerKey)}`;
}

export async function loadStowLocalSnapshotForOwner(
  ownerKey: string
): Promise<StowLocalSnapshot | null> {
  try {
    return parseSnapshot(await AsyncStorage.getItem(userStorageKey(ownerKey)));
  } catch {
    return null;
  }
}

export async function saveStowLocalSnapshotForOwner(
  ownerKey: string,
  snapshot: StowLocalSnapshot
): Promise<void> {
  try {
    await AsyncStorage.setItem(userStorageKey(ownerKey), JSON.stringify(snapshot));
  } catch {
    // 磁盘满等：静默失败
  }
}

export async function clearStowLocalSnapshotForOwner(ownerKey: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(userStorageKey(ownerKey));
  } catch {
    /* ignore */
  }
}

/** @deprecated 仅用于迁移旧数据 */
export async function loadStowLocalSnapshot(): Promise<StowLocalSnapshot | null> {
  try {
    return parseSnapshot(await AsyncStorage.getItem(LEGACY_STORAGE_KEY));
  } catch {
    return null;
  }
}

export async function saveStowLocalSnapshot(snapshot: StowLocalSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

export async function clearStowLocalSnapshot(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * 读取某账号快照；若该账号尚无数据且存在旧版全局快照，则迁移过去（只迁一次）。
 */
export async function loadOrMigrateSnapshotForOwner(
  ownerKey: string
): Promise<StowLocalSnapshot | null> {
  const existing = await loadStowLocalSnapshotForOwner(ownerKey);
  if (existing) return existing;
  const legacy = await loadStowLocalSnapshot();
  if (!legacy) return null;
  await saveStowLocalSnapshotForOwner(ownerKey, legacy);
  await clearStowLocalSnapshot();
  return legacy;
}
