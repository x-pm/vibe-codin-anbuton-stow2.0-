import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { colors } from '../theme/colors';
import { parseISODate } from './planDates';
import type { ItemPlan } from '../types/models';

export type PlanThumbIconName = ComponentProps<typeof Ionicons>['name'];

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function planDateForSort(p: ItemPlan): Date | null {
  const fromFooter = parseISODate(p.footer.trim());
  if (fromFooter) return fromFooter;
  if (p.reminderAt != null) {
    const r = new Date(p.reminderAt);
    return new Date(r.getFullYear(), r.getMonth(), r.getDate());
  }
  return null;
}

/**
 * 未完成计划排序（首页预览与待办列表共用）：
 * 1. 有「预计时间」`footer` 中日期，或仅设「提醒」时，按与 reference 的日历日距离升序；同距离则按日期先后。
 * 2. 无日期的在后，按 `createdAt` 升序（先创建的在前）。
 * reference 一般为「当前查看日」，用于替代未接入的「登录日」。
 */
export function sortPendingPlansForPreview(list: ItemPlan[], reference: Date): ItemPlan[] {
  return [...list].sort((a, b) => {
    const da = planDateForSort(a);
    const db = planDateForSort(b);
    const ha = !!da;
    const hb = !!db;
    if (ha && hb) {
      const distA = Math.abs(startOfLocalDay(da!) - startOfLocalDay(reference));
      const distB = Math.abs(startOfLocalDay(db!) - startOfLocalDay(reference));
      if (distA !== distB) return distA - distB;
      return da!.getTime() - db!.getTime();
    }
    if (ha && !hb) return -1;
    if (!ha && hb) return 1;
    return (a.createdAt ?? 0) - (b.createdAt ?? 0);
  });
}

/** 计划卡片 / 首页预览左侧：购物→购物车；过期类→红色闹铃；其余→中性日历 */
export function getPlanThumbIcon(plan: ItemPlan): {
  name: PlanThumbIconName;
  color: string;
  boxBg: string;
} {
  const isExpiry = plan.accent === 'danger' || plan.tag.includes('过期');
  if (isExpiry) {
    return { name: 'notifications', color: colors.danger, boxBg: '#FFE8E8' };
  }
  if (plan.tag === '购物') {
    return { name: 'cart-outline', color: colors.text, boxBg: '#F5F0DC' };
  }
  return { name: 'calendar-outline', color: colors.textMuted, boxBg: '#EFEFEF' };
}
