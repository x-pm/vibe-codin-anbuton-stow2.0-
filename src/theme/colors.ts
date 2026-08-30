/**
 * 莫兰迪色板（建筑玻璃幕墙）：
 * 浅蓝 = 天空，深蓝 = 幕墙，暖黄 = 窗光（提亮）。
 * 正文字色以白系为主，压在底图 / 深蓝按钮上更清晰。
 */
export const colors = {
  /** 页面兜底色：深钢蓝，底图未露出时白字仍可读 */
  bg: '#3A4A5A',
  bgDeep: '#2A3848',
  /** 半透明表面：浅蓝偏白（更透，透底图） */
  surface: 'rgba(232, 240, 248, 0.14)',
  /** 玻璃边（默认不用在按钮上） */
  borderGlass: 'transparent',
  /** 正文：白系为主（压在底图上） */
  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.78)',
  textLight: 'rgba(255, 255, 255, 0.55)',
  /** 毛玻璃按钮上的字（浅蓝白底上用深色） */
  textOnGlass: '#3A4A5A',
  textOnGlassMuted: 'rgba(58, 74, 90, 0.72)',
  border: 'rgba(255, 255, 255, 0.55)',
  /** 主色：深蓝（幕墙）——主按钮 / FAB / 选中态 */
  primary: '#526D82',
  onPrimary: '#FFFFFF',
  /** 强调色：低饱和蛋黄（窗光）——次 CTA / 高亮 */
  accent: '#D9C992',
  onAccent: '#3A4A5A',
  danger: '#B86B6B',
  gold: '#D9C992',
  tagShopping: '#E6D9B0',
  tagExpire: '#E0C4C4',
  tagMaintain: '#D0D8E0',
  blueLight: '#B8C6D9',
  blueDeep: '#526D82',
  warmYellow: '#D9C992',
  /**
   * 二级页蒙层：浅蓝半透明（配合 FormSheetBackground 的 BlurView）
   */
  formSheetBg: 'rgba(184, 198, 217, 0.72)',
  /**
   * 弹窗卡片底：略实于全屏底，仍带一点透
   */
  modalCardBg: 'rgba(184, 198, 217, 0.88)',
  modalCardText: '#3A4A5A',
  modalCardMuted: 'rgba(58, 74, 90, 0.72)',
};
