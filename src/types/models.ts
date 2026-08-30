export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  /** 仓库分组（录入时与 category 通常一致；可按组浏览） */
  group?: string;
  subCategory?: string;
  /** 仓库内连续编号（按创建顺序 1 起）；与 codeLabel 同步 */
  inventoryNumber: number;
  /** 编号展示，如 001（由系统维护） */
  codeLabel: string;
  imageUri?: string;
  location?: string;
  locationDetail?: string;
  quantity: number;
  notes?: string;
  tags?: string[];
  sku?: string;
};

export type ItemPlan = {
  id: string;
  title: string;
  detail: string;
  footer: string;
  tag: string;
  tagBg: string;
  accent?: 'none' | 'danger';
  /** 已完成：首页预览隐去，在「物品计划」页以删除线+灰色展示 */
  completed?: boolean;
  /** 创建时间戳（ms），无日期排序时按此升序 */
  createdAt?: number;
  /** 旧数据兼容：曾用于系统日历提醒，现已不再写入 */
  reminderAt?: number;
  /** 旧数据兼容：曾用于系统日历事件 id */
  externalCalendarEventId?: string;
};

export type ItemFormPreset = {
  name?: string;
  sku?: string;
  location?: string;
  category?: string;
  group?: string;
  remarks?: string;
  quantity?: number;
  /** 来自链接 og:image 等，录入页可预览；需为 http(s) 可访问地址 */
  imageUrl?: string;
  /** 扫描/相册选择的本地文件 URI（file:// / content://），保存物品时用作用户照片 */
  localImageUri?: string;
};
