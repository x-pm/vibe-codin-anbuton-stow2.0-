import type { ImageSourcePropType } from 'react-native';

/** 一级：房间类型（可增删改名，持久化在本地） */
export const DEFAULT_STORAGE_ROOMS = [
  '客厅',
  '餐厅',
  '主卧',
  '次卧',
  '儿童房',
  '厨房',
  '卫生间',
  '书房',
  '玄关',
  '阳台',
  '杂物间',
  '衣帽间',
  '保姆房',
  '车库',
] as const;

/** 二级：储物设备（固定选项） */
export const STORAGE_EQUIPMENT = [
  '大柜子',
  '小柜子',
  '收纳筐',
  '挂钩处',
  '架子',
  '地面',
] as const;

export type StorageEquipment = (typeof STORAGE_EQUIPMENT)[number];

/** 二级储物设备对应小图（素材图/二层级储物） */
export const STORAGE_EQUIPMENT_IMAGES: Record<StorageEquipment, ImageSourcePropType> = {
  大柜子: require('../../assets/storage-equipment/cabinet-large.png'),
  小柜子: require('../../assets/storage-equipment/cabinet-small.png'),
  收纳筐: require('../../assets/storage-equipment/basket.png'),
  挂钩处: require('../../assets/storage-equipment/hook.png'),
  架子: require('../../assets/storage-equipment/shelf.png'),
  地面: require('../../assets/storage-equipment/floor.png'),
};
