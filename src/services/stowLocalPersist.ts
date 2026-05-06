import AsyncStorage from '@react-native-async-storage/async-storage';
import type { InventoryItem, ItemPlan } from '../types/models';

const STORAGE_KEY = '@stow/local_snapshot_v1';

export type StowLocalSnapshot = {
  v: 1;
  items: InventoryItem[];
  plans: ItemPlan[];
  groups: string[];
  profileDisplayName: string;
  profileAvatarUri?: string;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

export async function loadStowLocalSnapshot(): Promise<StowLocalSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null || raw === '') return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.v !== 1) return null;
    if (!Array.isArray(parsed.items) || !Array.isArray(parsed.plans) || !Array.isArray(parsed.groups)) {
      return null;
    }
    return {
      v: 1,
      items: parsed.items as InventoryItem[],
      plans: parsed.plans as ItemPlan[],
      groups: parsed.groups as string[],
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

export async function saveStowLocalSnapshot(snapshot: StowLocalSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // 磁盘满等情况：静默失败，不影响本次会话内操作
  }
}

export async function clearStowLocalSnapshot(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
