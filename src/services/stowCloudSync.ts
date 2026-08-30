import {
  callStowSync,
  deleteCloudAuthUser,
  getCloudStorageUserId,
  isCloudbaseConfigured,
  isCloudUserLoggedIn,
  uploadStowObject,
} from './cloudbase';
import type { StowLocalSnapshot } from './stowLocalPersist';

function isLocalFileUri(uri: string | undefined): boolean {
  if (!uri?.trim()) return false;
  const u = uri.trim();
  return (
    u.startsWith('file:') ||
    u.startsWith('content:') ||
    u.startsWith('ph://') ||
    u.startsWith('assets-library:')
  );
}

function isRemoteUri(uri: string | undefined): boolean {
  if (!uri?.trim()) return false;
  const u = uri.trim();
  return u.startsWith('http://') || u.startsWith('https://') || u.startsWith('cloud://');
}

function parseSnapshot(raw: unknown): StowLocalSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (s.v !== 1) return null;
  if (!Array.isArray(s.items) || !Array.isArray(s.plans) || !Array.isArray(s.groups)) {
    return null;
  }
  return {
    v: 1,
    updatedAt: typeof s.updatedAt === 'number' ? s.updatedAt : undefined,
    items: s.items as StowLocalSnapshot['items'],
    plans: s.plans as StowLocalSnapshot['plans'],
    groups: s.groups as string[],
    rooms: Array.isArray(s.rooms) ? (s.rooms as string[]) : undefined,
    storageEquipment: Array.isArray(s.storageEquipment)
      ? (s.storageEquipment as string[])
      : undefined,
    storageEquipmentImages:
      s.storageEquipmentImages && typeof s.storageEquipmentImages === 'object'
        ? (s.storageEquipmentImages as Record<string, string>)
        : undefined,
    profileDisplayName:
      typeof s.profileDisplayName === 'string' ? s.profileDisplayName : '',
    profileAvatarUri:
      s.profileAvatarUri == null ? undefined : String(s.profileAvatarUri),
  };
}

/** 把 snapshot 里的本地图片上传到云存储，返回可远端访问的新 snapshot */
export async function uploadLocalImagesInSnapshot(
  snapshot: StowLocalSnapshot
): Promise<StowLocalSnapshot> {
  const uid = await getCloudStorageUserId();
  const items = [...snapshot.items];
  let changed = false;

  for (let i = 0; i < items.length; i++) {
    const uri = items[i].imageUri;
    if (!isLocalFileUri(uri) || isRemoteUri(uri)) continue;
    try {
      const uploaded = await uploadStowObject({
        objectId: `stow/${uid}/items/${items[i].id}.jpg`,
        localUri: uri!,
      });
      items[i] = { ...items[i], imageUri: uploaded.downloadUrl };
      changed = true;
    } catch (e) {
      console.warn('[stowCloudSync] item image upload failed', items[i].id, e);
    }
  }

  let profileAvatarUri = snapshot.profileAvatarUri;
  if (isLocalFileUri(profileAvatarUri) && !isRemoteUri(profileAvatarUri)) {
    try {
      const uploaded = await uploadStowObject({
        objectId: `stow/${uid}/avatar.jpg`,
        localUri: profileAvatarUri!,
      });
      profileAvatarUri = uploaded.downloadUrl;
      changed = true;
    } catch (e) {
      console.warn('[stowCloudSync] avatar upload failed', e);
    }
  }

  const equipmentImages = { ...(snapshot.storageEquipmentImages ?? {}) };
  for (const [name, uri] of Object.entries(equipmentImages)) {
    if (!isLocalFileUri(uri) || isRemoteUri(uri)) continue;
    try {
      const uploaded = await uploadStowObject({
        objectId: `stow/${uid}/equipment/${encodeURIComponent(name)}.jpg`,
        localUri: uri,
      });
      equipmentImages[name] = uploaded.downloadUrl;
      changed = true;
    } catch (e) {
      console.warn('[stowCloudSync] equipment image upload failed', name, e);
    }
  }

  if (!changed) return snapshot;
  return {
    ...snapshot,
    items,
    profileAvatarUri,
    storageEquipmentImages: Object.keys(equipmentImages).length > 0 ? equipmentImages : snapshot.storageEquipmentImages,
    updatedAt: Date.now(),
  };
}

export async function pullWorkspace(): Promise<{
  empty: boolean;
  snapshot: StowLocalSnapshot | null;
  updatedAt: number;
}> {
  const res = await callStowSync({ action: 'pull' });
  if (!res.ok) {
    throw new Error(res.message || res.error || '拉取云端数据失败');
  }
  if (res.empty) {
    return { empty: true, snapshot: null, updatedAt: 0 };
  }
  const snapshot = parseSnapshot(res.snapshot);
  if (!snapshot) {
    throw new Error('云端快照格式无效');
  }
  return {
    empty: false,
    snapshot,
    updatedAt: typeof res.updatedAt === 'number' ? res.updatedAt : snapshot.updatedAt || 0,
  };
}

/** 删除云端业务快照并尝试注销登录账号。须在 signOut 之前调用。 */
export async function deleteCloudWorkspace(): Promise<void> {
  const res = await callStowSync({ action: 'deleteAccount' });
  if (!res.ok) {
    throw new Error(res.message || res.error || '删除云端数据失败');
  }
  try {
    await deleteCloudAuthUser();
  } catch {
    /* 快照已删；登录账号若仍存在，用户可用同一凭据注册空账号 */
  }
}

export async function pushWorkspace(
  snapshot: StowLocalSnapshot
): Promise<{ snapshot: StowLocalSnapshot; updatedAt: number }> {
  const withRemoteImages = await uploadLocalImagesInSnapshot(snapshot);
  const updatedAt = Math.max(withRemoteImages.updatedAt || 0, Date.now());
  const toPush: StowLocalSnapshot = { ...withRemoteImages, updatedAt };
  const res = await callStowSync({
    action: 'push',
    snapshot: toPush,
    updatedAt,
  });
  if (!res.ok) {
    throw new Error(res.message || res.error || '推送云端数据失败');
  }
  return {
    snapshot: toPush,
    updatedAt: typeof res.updatedAt === 'number' ? res.updatedAt : updatedAt,
  };
}

export type ReconcileResult = {
  /** 应用到本机 UI 的快照；null 表示沿用当前本机、无需改 UI */
  applyLocal: StowLocalSnapshot | null;
  /** 对账后应保存到本机的最终快照 */
  finalSnapshot: StowLocalSnapshot;
  source: 'cloud' | 'local' | 'local_pushed' | 'skipped';
};

/**
 * 登录后对账：两边都有则取 updatedAt 较新；云空则推本机；本机空则拉云。
 */
export async function reconcileAndSync(
  local: StowLocalSnapshot
): Promise<ReconcileResult> {
  if (!isCloudbaseConfigured() || !(await isCloudUserLoggedIn())) {
    return { applyLocal: null, finalSnapshot: local, source: 'skipped' };
  }

  const pulled = await pullWorkspace();
  const localAt = local.updatedAt || 0;
  const localEmpty =
    local.items.length === 0 &&
    local.plans.length === 0 &&
    !(local.profileAvatarUri && isLocalFileUri(local.profileAvatarUri));

  if (pulled.empty) {
    const pushed = await pushWorkspace(local);
    return {
      applyLocal: pushed.snapshot,
      finalSnapshot: pushed.snapshot,
      source: 'local_pushed',
    };
  }

  const cloud = pulled.snapshot!;
  const cloudAt = pulled.updatedAt || cloud.updatedAt || 0;

  if (localEmpty && cloud.items.length + cloud.plans.length > 0) {
    return { applyLocal: cloud, finalSnapshot: { ...cloud, updatedAt: cloudAt }, source: 'cloud' };
  }

  if (cloudAt > localAt) {
    return { applyLocal: cloud, finalSnapshot: { ...cloud, updatedAt: cloudAt }, source: 'cloud' };
  }

  // 本机更新或相等：推本机
  const pushed = await pushWorkspace({ ...local, updatedAt: Math.max(localAt, Date.now()) });
  return {
    applyLocal: pushed.snapshot !== local ? pushed.snapshot : null,
    finalSnapshot: pushed.snapshot,
    source: 'local',
  };
}
