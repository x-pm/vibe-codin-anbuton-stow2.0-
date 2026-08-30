import { isHomeSunlitWindow } from '../components/HomeDayNightIcon';

/** 按本地时间切换问候；「下午好」与太阳时段一致（含 18:00 整分） */
export function getHomeGreeting(now = new Date()): string {
  const h = now.getHours();
  if (h >= 8 && h < 12) return '早安，馆藏家';
  if (h >= 12 && h < 14) return '中午好，馆藏家';
  if (h >= 14 && isHomeSunlitWindow(now)) return '下午好，馆藏家';
  return '晚安，馆藏家';
}

/** 预览页等展示用：句末加中文句号 */
export function greetingWithPeriod(greeting: string): string {
  return greeting.endsWith('。') ? greeting : `${greeting}。`;
}
