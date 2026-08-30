import type { ItemFormPreset } from '../types/models';

/** 餐具 / 食物等明显厨房向关键词 */
const KITCHEN_MARKERS = [
  '餐具',
  '碗',
  '盘',
  '碟',
  '筷',
  '勺子',
  '汤勺',
  '叉子',
  '锅',
  '铲',
  '砧板',
  '菜刀',
  '厨刀',
  '砂锅',
  '炒锅',
  '高压锅',
  '电饭煲',
  '电饭锅',
  '微波炉',
  '烤箱',
  '空气炸锅',
  '调料',
  '调味',
  '酱油',
  '醋',
  '料酒',
  '食用油',
  '橄榄油',
  '大米',
  '面粉',
  '挂面',
  '方便面',
  '零食',
  '食品',
  '食材',
  '罐头',
  '饮料',
  '果汁',
  '牛奶',
  '酸奶',
  '咖啡',
  '茶叶',
  '茶包',
  '饼干',
  '面包',
  '糕点',
  '糖果',
  '巧克力',
  '水果',
  '蔬菜',
  '肉类',
  '海鲜',
  '冷冻',
  '保鲜盒',
  '饭盒',
  '保温壶',
  '水壶',
  '茶杯',
  '咖啡杯',
  '马克杯',
  '酒杯',
  '开瓶器',
  '削皮',
  '沥水篮',
  '洗碗布',
  '洗碗',
  '洗洁精',
  '厨房纸',
  '保鲜膜',
  '保鲜袋',
  '密封袋',
  '案板',
] as const;

/** 洗浴用品等明显卫生间向关键词 */
const BATHROOM_MARKERS = [
  '洗发',
  '护发',
  '护发素',
  '沐浴露',
  '沐浴乳',
  '香皂',
  '肥皂',
  '洗手液',
  '牙膏',
  '牙刷',
  '漱口水',
  '牙线',
  '洗面奶',
  '洁面',
  '卸妆',
  '浴盐',
  '浴球',
  '浴巾',
  '毛巾',
  '面巾',
  '洗脸巾',
  '剃须刀',
  '剃须膏',
  '须后水',
  '棉签',
  '化妆棉',
  '卫生纸',
  '卷纸',
  '洗衣液',
  '柔顺剂',
  '洗衣凝珠',
  '洗衣粉',
  '漂白剂',
  '马桶',
  '洁厕',
  '浴室',
  '浴缸',
  '花洒',
  '浴帘',
  '漱口杯',
  '牙杯',
] as const;

function countMarkerHits(haystack: string, markers: readonly string[]): number {
  let n = 0;
  for (const m of markers) {
    if (haystack.includes(m)) n += 1;
  }
  return n;
}

/**
 * 根据名称/分类/备注推断一级存放房间。
 * 餐具、食物等 → 厨房；洗浴用品等 → 卫生间；无明显信号 → 主卧。
 */
export function estimateStorageRoom(parts: {
  name?: string;
  category?: string;
  remarks?: string;
}): '厨房' | '卫生间' | '主卧' {
  const haystack = [parts.name, parts.category, parts.remarks]
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .join(' ')
    .toLowerCase();

  if (!haystack.trim()) return '主卧';

  const kitchenHits = countMarkerHits(haystack, KITCHEN_MARKERS);
  const bathHits = countMarkerHits(haystack, BATHROOM_MARKERS);

  if (kitchenHits === 0 && bathHits === 0) return '主卧';
  if (bathHits > kitchenHits) return '卫生间';
  if (kitchenHits > bathHits) return '厨房';
  // 平局：洗浴词通常更专一，优先卫生间；否则厨房
  return bathHits > 0 ? '卫生间' : '厨房';
}

/**
 * 识别结果补一层房间预估：餐具/食物→厨房，洗浴→卫生间，其余→主卧。
 * 有明确规则命中（含默认主卧）时覆盖模型给出的 location。
 */
export function enrichPresetWithEstimatedLocation(preset: ItemFormPreset): ItemFormPreset {
  const estimated = estimateStorageRoom({
    name: preset.name,
    category: preset.category,
    remarks: preset.remarks,
  });
  return { ...preset, location: estimated };
}
