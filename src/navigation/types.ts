import type { ItemFormPreset } from '../types/models';

export type RootStackParamList = {
  MainTabs: undefined;
  InventoryGroup: { groupName: string };
  ItemDetail: {
    itemId: string;
    openInEditMode?: boolean;
    /** 从「录入页相似物品」点「是」进入：提示用户在本页填写/调整本次数量 */
    suggestQuantityEdit?: boolean;
  };
  AddItem: { preset?: ItemFormPreset } | undefined;
  ScanEntry: { entryHint?: string } | undefined;
  LinkEntry: undefined;
  AccountSettings: undefined;
  DataExport: undefined;
  About: undefined;
  Help: undefined;
  EditProfile: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  InventoryTab: undefined;
  PlansTab: undefined;
  ProfileTab: undefined;
};
