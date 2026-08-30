import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type InventoryBulkTabBarPayload = {
  summary: string;
  showMove: boolean;
  /** 多选底栏「新建」：仓库分组/位置 */
  showCreate?: boolean;
  allVisibleSelected: boolean;
  onSelectAll: () => void;
  onMoveToGroup: () => void;
  onCreate?: () => void;
  onDelete: () => void;
};

type Ctx = {
  payload: InventoryBulkTabBarPayload | null;
  setPayload: (p: InventoryBulkTabBarPayload | null) => void;
};

const InventoryBulkTabContext = createContext<Ctx | null>(null);

export function InventoryBulkTabProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<InventoryBulkTabBarPayload | null>(null);
  const value = useMemo(() => ({ payload, setPayload }), [payload]);
  return (
    <InventoryBulkTabContext.Provider value={value}>{children}</InventoryBulkTabContext.Provider>
  );
}

export function useInventoryBulkTab() {
  const ctx = useContext(InventoryBulkTabContext);
  if (!ctx) throw new Error('useInventoryBulkTab must be used within InventoryBulkTabProvider');
  return ctx;
}
