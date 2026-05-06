import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { View } from 'react-native';
import type { InventoryItem, ItemPlan } from '../types/models';
import { deleteStowPlanCalendarEventIfAny } from '../services/planCalendarSync';
import {
  clearStowLocalSnapshot,
  loadStowLocalSnapshot,
  saveStowLocalSnapshot,
} from '../services/stowLocalPersist';
import { colors } from '../theme/colors';
import { assignInventoryNumbers } from '../utils/inventoryNumbers';
import { itemDisplayGroup } from '../utils/itemGroup';

export const DEFAULT_ITEM_GROUPS = ['电子产品', '衣物', '耗材', '文献', '工具'] as const;

export const DEFAULT_PROFILE_DISPLAY_NAME = '亚历克斯';
export const DEFAULT_PROFILE_AVATAR_URI = 'https://picsum.photos/seed/profile/200/200';

type DataContextValue = {
  items: InventoryItem[];
  /** 可选分组列表（录入页 chips + 新建分组） */
  groups: string[];
  addGroup: (name: string) => void;
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
  logoutClear: () => void;
};

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [groups, setGroups] = useState<string[]>(() => [...DEFAULT_ITEM_GROUPS]);
  const [plans, setPlans] = useState<ItemPlan[]>([]);
  const [profileDisplayName, setProfileDisplayName] = useState(DEFAULT_PROFILE_DISPLAY_NAME);
  const [profileAvatarUri, setProfileAvatarUri] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const snap = await loadStowLocalSnapshot();
      if (cancelled) return;
      if (snap) {
        setItems(assignInventoryNumbers(snap.items));
        setPlans(snap.plans);
        setGroups(snap.groups.length > 0 ? snap.groups : [...DEFAULT_ITEM_GROUPS]);
        const name = snap.profileDisplayName.trim();
        setProfileDisplayName(name.length > 0 ? name : DEFAULT_PROFILE_DISPLAY_NAME);
        setProfileAvatarUri(snap.profileAvatarUri);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      void saveStowLocalSnapshot({
        v: 1,
        items,
        plans,
        groups,
        profileDisplayName,
        profileAvatarUri,
      });
    }, 300);
    return () => clearTimeout(t);
  }, [hydrated, items, plans, groups, profileDisplayName, profileAvatarUri]);

  const addGroup = useCallback((name: string) => {
    const t = name.trim();
    if (!t) return;
    setGroups((prev) => (prev.includes(t) ? prev : [...prev, t]));
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
    setGroups((prev) => (prev.includes(g) ? prev : [...prev, g]));
    setItems((prev) =>
      prev.map((it) =>
        idSet.has(it.id) ? { ...it, group: g, category: g, tags: [g] } : it
      )
    );
  }, []);

  const removeGroupsByName = useCallback((groupNames: string[]) => {
    if (!groupNames.length) return;
    const nameSet = new Set(groupNames);
    setItems((prev) =>
      assignInventoryNumbers(
        prev.filter((it) => !nameSet.has(itemDisplayGroup(it)))
      )
    );
    setGroups((prev) => prev.filter((g) => !nameSet.has(g)));
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<Omit<InventoryItem, 'id'>>) => {
    const { codeLabel: _c, inventoryNumber: _n, ...rest } = updates;
    setItems((prev) =>
      prev.map((it) => (it.id === id ? ({ ...it, ...rest } as InventoryItem) : it))
    );
  }, []);

  const completePlan = useCallback((id: string) => {
    let ext: string | undefined;
    setPlans((prev) => {
      const t = prev.find((p) => p.id === id);
      ext = t?.externalCalendarEventId;
      return prev.map((p) => (p.id === id ? { ...p, completed: true } : p));
    });
    if (ext) void deleteStowPlanCalendarEventIfAny(ext);
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
    setPlans((prev) => {
      for (const p of prev) {
        if (idSet.has(p.id) && p.externalCalendarEventId) {
          void deleteStowPlanCalendarEventIfAny(p.externalCalendarEventId);
        }
      }
      return prev.filter((p) => !idSet.has(p.id));
    });
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
    setItems([]);
    setPlans([]);
    setGroups([...DEFAULT_ITEM_GROUPS]);
    setProfileDisplayName(DEFAULT_PROFILE_DISPLAY_NAME);
    setProfileAvatarUri(undefined);
    void clearStowLocalSnapshot();
  }, []);

  const value = useMemo(
    () => ({
      items,
      groups,
      addGroup,
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
    }),
    [
      items,
      groups,
      addGroup,
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
