import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { View } from 'react-native';
import { DEFAULT_STORAGE_ROOMS, STORAGE_EQUIPMENT } from '../constants/storageLocations';
import type { InventoryItem, ItemPlan } from '../types/models';
import {
  clearStowLocalSnapshot,
  clearStowLocalSnapshotForOwner,
  loadOrMigrateSnapshotForOwner,
  saveStowLocalSnapshotForOwner,
  storageOwnerKeyFromProfile,
  type StowLocalSnapshot,
} from '../services/stowLocalPersist';
import { isCloudUserLoggedIn } from '../services/cloudbase';
import { pushWorkspace, reconcileAndSync } from '../services/stowCloudSync';
import { colors } from '../theme/colors';
import { assignInventoryNumbers } from '../utils/inventoryNumbers';
import {
  DEFAULT_OTHER_GROUP,
  ensureOtherGroup,
  itemDisplayGroup,
} from '../utils/itemGroup';
import { useAuth } from './AuthContext';

export { DEFAULT_OTHER_GROUP };
export const DEFAULT_ITEM_GROUPS = [
  '电子产品',
  '衣物',
  '耗材',
  '文献',
  '工具',
  DEFAULT_OTHER_GROUP,
] as const;

export const DEFAULT_PROFILE_DISPLAY_NAME = '亚历克斯';

type DataContextValue = {
  items: InventoryItem[];
  /** 可选分组列表（录入页 chips + 新建分组） */
  groups: string[];
  addGroup: (name: string) => void;
  /** 一级存储位置：房间列表 */
  rooms: string[];
  addRoom: (name: string) => void;
  /** 重命名房间；同步更新已有物品的 location */
  renameRoom: (from: string, to: string) => void;
  /** 二级储物设备列表 */
  storageEquipment: string[];
  /** 储物设备自定义外观图（名称 → URI） */
  storageEquipmentImages: Record<string, string>;
  addStorageEquipment: (name: string, imageUri?: string) => void;
  /** 重命名储物设备；同步更新已有物品的 locationDetail */
  renameStorageEquipment: (from: string, to: string) => void;
  plans: ItemPlan[];
  totalCount: number;
  addItem: (item: Omit<InventoryItem, 'id'>) => void;
  updateItemQuantity: (id: string, quantity: number) => void;
  updateItem: (id: string, updates: Partial<Omit<InventoryItem, 'id'>>) => void;
  removeItem: (id: string) => void;
  /** 批量删除物品 */
  removeItemsByIds: (ids: string[]) => void;
  /** 批量将物品移入指定分组 */
  moveItemsToGroup: (ids: string[], groupName: string) => void;
  /** 删除指定分组名及其下全部物品，并从分组列表移除 */
  removeGroupsByName: (groupNames: string[]) => void;
  /** 将计划标为已完成（首页预览会滑出隐藏，计划页保留灰字+删除线） */
  completePlan: (id: string) => void;
  addPlan: (plan: Omit<ItemPlan, 'id'>) => string;
  updatePlan: (id: string, updates: Partial<ItemPlan>) => void;
  /** 批量删除计划 */
  removePlansByIds: (ids: string[]) => void;
  profileDisplayName: string;
  /** 自定义头像本地或远程 URI；未设置时用默认占位图 */
  profileAvatarUri: string | undefined;
  updateProfile: (updates: { displayName?: string; avatarUri?: string | null }) => void;
  /** 永久清除当前登录账号在本机保存的数据（退出登录不会调用） */
  logoutClear: () => void;
  /** 退出前推一次云端（失败抛错，调用方可决定是否仍退出） */
  flushCloudSync: () => Promise<void>;
};

const DataContext = createContext<DataContextValue | null>(null);

function emptyWorkspaceState() {
  return {
    items: [] as InventoryItem[],
    plans: [] as ItemPlan[],
    groups: ensureOtherGroup([...DEFAULT_ITEM_GROUPS]),
    rooms: [...DEFAULT_STORAGE_ROOMS],
    storageEquipment: [...STORAGE_EQUIPMENT],
    storageEquipmentImages: {} as Record<string, string>,
    profileDisplayName: DEFAULT_PROFILE_DISPLAY_NAME,
    profileAvatarUri: undefined as string | undefined,
  };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { ready: authReady, cloudUser } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [groups, setGroups] = useState<string[]>(() => ensureOtherGroup([...DEFAULT_ITEM_GROUPS]));
  const [rooms, setRooms] = useState<string[]>(() => [...DEFAULT_STORAGE_ROOMS]);
  const [storageEquipment, setStorageEquipment] = useState<string[]>(() => [
    ...STORAGE_EQUIPMENT,
  ]);
  const [storageEquipmentImages, setStorageEquipmentImages] = useState<Record<string, string>>(
    {}
  );
  const [plans, setPlans] = useState<ItemPlan[]>([]);
  const [profileDisplayName, setProfileDisplayName] = useState(DEFAULT_PROFILE_DISPLAY_NAME);
  const [profileAvatarUri, setProfileAvatarUri] = useState<string | undefined>(undefined);
  const [workspaceUpdatedAt, setWorkspaceUpdatedAt] = useState(() => Date.now());

  const ownerKeyRef = useRef<string | null>(null);
  const switchingRef = useRef(false);
  const cloudSyncingRef = useRef(false);
  const reconciledOwnerRef = useRef<string | null>(null);
  const snapshotRef = useRef<StowLocalSnapshot>({
    v: 1,
    updatedAt: Date.now(),
    ...emptyWorkspaceState(),
  });

  useEffect(() => {
    snapshotRef.current = {
      v: 1,
      updatedAt: workspaceUpdatedAt,
      items,
      plans,
      groups,
      rooms,
      storageEquipment,
      storageEquipmentImages,
      profileDisplayName,
      profileAvatarUri,
    };
  }, [
    items,
    plans,
    groups,
    rooms,
    storageEquipment,
    storageEquipmentImages,
    profileDisplayName,
    profileAvatarUri,
    workspaceUpdatedAt,
  ]);

  const applySnapshot = useCallback((snap: StowLocalSnapshot | null) => {
    if (!snap) {
      const empty = emptyWorkspaceState();
      setItems(empty.items);
      setPlans(empty.plans);
      setGroups(empty.groups);
      setRooms(empty.rooms);
      setStorageEquipment(empty.storageEquipment);
      setStorageEquipmentImages(empty.storageEquipmentImages);
      setProfileDisplayName(empty.profileDisplayName);
      setProfileAvatarUri(empty.profileAvatarUri);
      setWorkspaceUpdatedAt(Date.now());
      return;
    }
    setItems(assignInventoryNumbers(snap.items));
    setPlans(snap.plans);
    setGroups(ensureOtherGroup(snap.groups.length > 0 ? snap.groups : [...DEFAULT_ITEM_GROUPS]));
    setRooms(snap.rooms && snap.rooms.length > 0 ? snap.rooms : [...DEFAULT_STORAGE_ROOMS]);
    setStorageEquipment(
      snap.storageEquipment && snap.storageEquipment.length > 0
        ? snap.storageEquipment
        : [...STORAGE_EQUIPMENT]
    );
    setStorageEquipmentImages(snap.storageEquipmentImages ?? {});
    const name = snap.profileDisplayName.trim();
    setProfileDisplayName(name.length > 0 ? name : DEFAULT_PROFILE_DISPLAY_NAME);
    setProfileAvatarUri(snap.profileAvatarUri);
    setWorkspaceUpdatedAt(snap.updatedAt && snap.updatedAt > 0 ? snap.updatedAt : Date.now());
  }, []);

  const ownerKey = cloudUser ? storageOwnerKeyFromProfile(cloudUser) : null;

  /** 登录/退出时切换本机分区：退出先落盘再清空界面；登录加载该账号分区 */
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    void (async () => {
      switchingRef.current = true;
      const prev = ownerKeyRef.current;
      const next = ownerKey;

      if (prev && prev !== next) {
        const toSave: StowLocalSnapshot = {
          ...snapshotRef.current,
          updatedAt: Date.now(),
        };
        await saveStowLocalSnapshotForOwner(prev, toSave);
      }

      if (cancelled) {
        switchingRef.current = false;
        return;
      }

      if (next) {
        const snap = await loadOrMigrateSnapshotForOwner(next);
        if (!cancelled) {
          const label = cloudUser?.label?.trim() ?? '';
          const accountName =
            label && label !== '匿名会话' && label !== '已登录云账号' ? label : '';
          const existingName = snap?.profileDisplayName?.trim() ?? '';
          const needsInitialName =
            !existingName || existingName === DEFAULT_PROFILE_DISPLAY_NAME;
          if (needsInitialName && accountName) {
            applySnapshot({
              v: 1,
              updatedAt: snap?.updatedAt && snap.updatedAt > 0 ? snap.updatedAt : Date.now(),
              items: snap?.items ?? [],
              plans: snap?.plans ?? [],
              groups: snap?.groups ?? ensureOtherGroup([...DEFAULT_ITEM_GROUPS]),
              rooms: snap?.rooms,
              storageEquipment: snap?.storageEquipment,
              storageEquipmentImages: snap?.storageEquipmentImages,
              profileDisplayName: accountName,
              profileAvatarUri: snap?.profileAvatarUri,
            });
          } else {
            applySnapshot(snap);
          }
        }
        if (prev !== next) reconciledOwnerRef.current = null;
      } else {
        if (!cancelled) applySnapshot(null);
        reconciledOwnerRef.current = null;
      }

      ownerKeyRef.current = next;
      if (!cancelled) {
        setHydrated(true);
        switchingRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
      switchingRef.current = false;
    };
  }, [authReady, ownerKey, cloudUser, applySnapshot]);

  /** 本机用户编辑时推进 updatedAt（对账完成前 / 切账号 / 同步中不推进） */
  useEffect(() => {
    if (!hydrated || switchingRef.current || cloudSyncingRef.current) return;
    if (ownerKey && reconciledOwnerRef.current !== ownerKey) return;
    setWorkspaceUpdatedAt(Date.now());
  }, [
    hydrated,
    ownerKey,
    items,
    plans,
    groups,
    rooms,
    storageEquipment,
    storageEquipmentImages,
    profileDisplayName,
    profileAvatarUri,
  ]);

  /** 本机落盘 */
  useEffect(() => {
    if (!hydrated || switchingRef.current) return;
    const key = ownerKeyRef.current;
    if (!key) return;
    const t = setTimeout(() => {
      const snap: StowLocalSnapshot = {
        ...snapshotRef.current,
        updatedAt: Date.now(),
      };
      snapshotRef.current = snap;
      void saveStowLocalSnapshotForOwner(key, snap);
    }, 300);
    return () => clearTimeout(t);
  }, [
    hydrated,
    ownerKey,
    items,
    plans,
    groups,
    rooms,
    storageEquipment,
    storageEquipmentImages,
    profileDisplayName,
    profileAvatarUri,
  ]);

  /** 登录后与云端对账一次 */
  useEffect(() => {
    if (!hydrated || !ownerKey || !cloudUser || switchingRef.current) return;
    if (reconciledOwnerRef.current === ownerKey) return;
    let cancelled = false;
    void (async () => {
      if (!(await isCloudUserLoggedIn())) {
        reconciledOwnerRef.current = ownerKey;
        return;
      }
      cloudSyncingRef.current = true;
      try {
        const result = await reconcileAndSync(snapshotRef.current);
        if (cancelled) return;
        reconciledOwnerRef.current = ownerKey;
        if (result.applyLocal) {
          applySnapshot(result.applyLocal);
        }
        snapshotRef.current = result.finalSnapshot;
        await saveStowLocalSnapshotForOwner(ownerKey, result.finalSnapshot);
      } catch (e) {
        console.warn('[stow] cloud reconcile failed', e);
        reconciledOwnerRef.current = ownerKey;
      } finally {
        cloudSyncingRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, ownerKey, cloudUser, applySnapshot]);

  /** 本机变更后防抖推云 */
  useEffect(() => {
    if (!hydrated || !ownerKey || !cloudUser) return;
    if (switchingRef.current || cloudSyncingRef.current) return;
    if (reconciledOwnerRef.current !== ownerKey) return;
    const t = setTimeout(() => {
      void (async () => {
        if (!(await isCloudUserLoggedIn())) return;
        if (cloudSyncingRef.current || switchingRef.current) return;
        cloudSyncingRef.current = true;
        try {
          const snap: StowLocalSnapshot = {
            ...snapshotRef.current,
            updatedAt: Date.now(),
          };
          const pushed = await pushWorkspace(snap);
          snapshotRef.current = pushed.snapshot;
          await saveStowLocalSnapshotForOwner(ownerKey, pushed.snapshot);
          // 本地图已换成 https 时刷新界面
          const before = snap.items.map((i) => i.imageUri).join('|');
          const after = pushed.snapshot.items.map((i) => i.imageUri).join('|');
          const eqBefore = JSON.stringify(snap.storageEquipmentImages ?? {});
          const eqAfter = JSON.stringify(pushed.snapshot.storageEquipmentImages ?? {});
          if (
            before !== after ||
            snap.profileAvatarUri !== pushed.snapshot.profileAvatarUri ||
            eqBefore !== eqAfter
          ) {
            applySnapshot(pushed.snapshot);
          }
        } catch (e) {
          console.warn('[stow] cloud push failed', e);
        } finally {
          cloudSyncingRef.current = false;
        }
      })();
    }, 1500);
    return () => clearTimeout(t);
  }, [
    hydrated,
    ownerKey,
    cloudUser,
    items,
    plans,
    groups,
    rooms,
    storageEquipment,
    storageEquipmentImages,
    profileDisplayName,
    profileAvatarUri,
    applySnapshot,
  ]);
  const addGroup = useCallback((name: string) => {
    const t = name.trim();
    if (!t) return;
    setGroups((prev) => ensureOtherGroup(prev.includes(t) ? prev : [...prev, t]));
  }, []);

  const addRoom = useCallback((name: string) => {
    const t = name.trim();
    if (!t) return;
    setRooms((prev) => (prev.includes(t) ? prev : [...prev, t]));
  }, []);

  const renameRoom = useCallback((from: string, to: string) => {
    const next = to.trim();
    if (!from || !next || from === next) return;
    setRooms((prev) => {
      if (prev.includes(next)) {
        return prev.filter((r) => r !== from);
      }
      return prev.map((r) => (r === from ? next : r));
    });
    setItems((prev) =>
      prev.map((it) => (it.location === from ? { ...it, location: next } : it))
    );
  }, []);

  const addStorageEquipment = useCallback((name: string, imageUri?: string) => {
    const t = name.trim();
    if (!t) return;
    setStorageEquipment((prev) => (prev.includes(t) ? prev : [...prev, t]));
    const img = imageUri?.trim();
    if (img) {
      setStorageEquipmentImages((prev) => ({ ...prev, [t]: img }));
    }
  }, []);

  const renameStorageEquipment = useCallback((from: string, to: string) => {
    const next = to.trim();
    if (!from || !next || from === next) return;
    setStorageEquipment((prev) => {
      if (prev.includes(next)) {
        return prev.filter((r) => r !== from);
      }
      return prev.map((r) => (r === from ? next : r));
    });
    setStorageEquipmentImages((prev) => {
      if (!(from in prev)) return prev;
      const nextMap = { ...prev };
      if (!(next in nextMap)) nextMap[next] = nextMap[from];
      delete nextMap[from];
      return nextMap;
    });
    setItems((prev) =>
      prev.map((it) =>
        it.locationDetail === from ? { ...it, locationDetail: next } : it
      )
    );
  }, []);

  const totalCount = useMemo(
    () => items.reduce((s, i) => s + (i.quantity > 0 ? i.quantity : 1), 0),
    [items]
  );

  const addItem = useCallback((item: Omit<InventoryItem, 'id'>) => {
    const id = `${Date.now()}`;
    setItems((prev) =>
      assignInventoryNumbers([
        {
          ...item,
          id,
          inventoryNumber: 0,
          codeLabel: '',
        },
        ...prev,
      ])
    );
  }, []);

  const updateItemQuantity = useCallback((id: string, quantity: number) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, quantity: Math.max(1, quantity) } : it))
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => assignInventoryNumbers(prev.filter((it) => it.id !== id)));
  }, []);

  const removeItemsByIds = useCallback((ids: string[]) => {
    if (!ids.length) return;
    const idSet = new Set(ids);
    setItems((prev) => assignInventoryNumbers(prev.filter((it) => !idSet.has(it.id))));
  }, []);

  const moveItemsToGroup = useCallback((ids: string[], groupName: string) => {
    const g = groupName.trim();
    if (!g || !ids.length) return;
    const idSet = new Set(ids);
    setGroups((prev) => ensureOtherGroup(prev.includes(g) ? prev : [...prev, g]));
    setItems((prev) =>
      prev.map((it) =>
        idSet.has(it.id) ? { ...it, group: g, category: g, tags: [g] } : it
      )
    );
  }, []);

  const removeGroupsByName = useCallback((groupNames: string[]) => {
    if (!groupNames.length) return;
    // 系统默认「其他」不可删除
    const nameSet = new Set(groupNames.filter((g) => g !== DEFAULT_OTHER_GROUP));
    if (!nameSet.size) return;
    setItems((prev) =>
      assignInventoryNumbers(
        prev.filter((it) => !nameSet.has(itemDisplayGroup(it)))
      )
    );
    setGroups((prev) => ensureOtherGroup(prev.filter((g) => !nameSet.has(g))));
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<Omit<InventoryItem, 'id'>>) => {
    const { codeLabel: _c, inventoryNumber: _n, ...rest } = updates;
    const nextGroup = rest.group?.trim() || rest.category?.trim();
    if (nextGroup) {
      setGroups((prev) => ensureOtherGroup(prev.includes(nextGroup) ? prev : [...prev, nextGroup]));
    }
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const merged = { ...it, ...rest } as InventoryItem;
        // 改分组后同步 category/tags，物品会出现在目标分组下
        if (nextGroup) {
          merged.group = nextGroup;
          merged.category = nextGroup;
          merged.tags = [nextGroup];
        }
        return merged;
      })
    );
  }, []);

  const completePlan = useCallback((id: string) => {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, completed: true } : p)));
  }, []);

  const addPlan = useCallback((plan: Omit<ItemPlan, 'id'>) => {
    const id = `p${Date.now()}`;
    const createdAt = plan.createdAt ?? Date.now();
    setPlans((prev) => [{ ...plan, id, createdAt }, ...prev]);
    return id;
  }, []);

  const updatePlan = useCallback((id: string, updates: Partial<ItemPlan>) => {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  }, []);

  const removePlansByIds = useCallback((ids: string[]) => {
    if (!ids.length) return;
    const idSet = new Set(ids);
    setPlans((prev) => prev.filter((p) => !idSet.has(p.id)));
  }, []);

  const updateProfile = useCallback((updates: { displayName?: string; avatarUri?: string | null }) => {
    if (updates.displayName !== undefined) {
      const t = updates.displayName.trim();
      if (t) setProfileDisplayName(t);
    }
    if (updates.avatarUri !== undefined) {
      setProfileAvatarUri(updates.avatarUri === null ? undefined : updates.avatarUri);
    }
  }, []);

  const logoutClear = useCallback(() => {
    const key = ownerKeyRef.current;
    const empty = emptyWorkspaceState();
    setItems(empty.items);
    setPlans(empty.plans);
    setGroups(empty.groups);
    setRooms(empty.rooms);
    setStorageEquipment(empty.storageEquipment);
    setStorageEquipmentImages(empty.storageEquipmentImages);
    setProfileDisplayName(empty.profileDisplayName);
    setProfileAvatarUri(empty.profileAvatarUri);
    if (key) {
      void clearStowLocalSnapshotForOwner(key);
    } else {
      void clearStowLocalSnapshot();
    }
  }, []);

  const flushCloudSync = useCallback(async () => {
    const key = ownerKeyRef.current;
    if (!key) return;
    if (!(await isCloudUserLoggedIn())) return;
    const snap: StowLocalSnapshot = {
      ...snapshotRef.current,
      updatedAt: Date.now(),
    };
    const pushed = await pushWorkspace(snap);
    snapshotRef.current = pushed.snapshot;
    await saveStowLocalSnapshotForOwner(key, pushed.snapshot);
  }, []);

  const value = useMemo(
    () => ({
      items,
      groups,
      addGroup,
      rooms,
      addRoom,
      renameRoom,
      storageEquipment,
      storageEquipmentImages,
      addStorageEquipment,
      renameStorageEquipment,
      plans,
      totalCount,
      addItem,
      updateItemQuantity,
      updateItem,
      removeItem,
      removeItemsByIds,
      moveItemsToGroup,
      removeGroupsByName,
      completePlan,
      addPlan,
      updatePlan,
      removePlansByIds,
      profileDisplayName,
      profileAvatarUri,
      updateProfile,
      logoutClear,
      flushCloudSync,
    }),
    [
      items,
      groups,
      addGroup,
      rooms,
      addRoom,
      renameRoom,
      storageEquipment,
      storageEquipmentImages,
      addStorageEquipment,
      renameStorageEquipment,
      plans,
      totalCount,
      addItem,
      updateItemQuantity,
      updateItem,
      removeItem,
      removeItemsByIds,
      moveItemsToGroup,
      removeGroupsByName,
      completePlan,
      addPlan,
      updatePlan,
      removePlansByIds,
      profileDisplayName,
      profileAvatarUri,
      updateProfile,
      logoutClear,
      flushCloudSync,
    ]
  );

  if (!hydrated) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useAppData must be used within DataProvider');
  return ctx;
}
