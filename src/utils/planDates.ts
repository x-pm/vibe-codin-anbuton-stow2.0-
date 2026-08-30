function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function formatISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 解析 `YYYY-MM-DD`（本地日历日），非法则 null */
export function parseISODate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = +m[1];
  const mo = +m[2] - 1;
  const day = +m[3];
  const d = new Date(y, mo, day);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== day) return null;
  return d;
}

function formatLocalDay(d: Date): string {
  const nowY = new Date().getFullYear();
  if (d.getFullYear() === nowY) return `${d.getMonth() + 1}月${d.getDate()}日`;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 计划卡片日期：预计时间 footer，或旧 reminderAt */
export function formatPlanCardDate(plan: {
  footer?: string;
  reminderAt?: number;
}): string | null {
  const raw = plan.footer?.trim() ?? '';
  if (raw) {
    const iso = parseISODate(raw);
    if (iso) return formatLocalDay(iso);
    const slash = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/.exec(raw);
    if (slash) {
      const d = new Date(+slash[1], +slash[2] - 1, +slash[3]);
      if (!Number.isNaN(d.getTime())) return formatLocalDay(d);
    }
    return raw;
  }
  if (typeof plan.reminderAt === 'number' && plan.reminderAt > 0) {
    const r = new Date(plan.reminderAt);
    return formatLocalDay(new Date(r.getFullYear(), r.getMonth(), r.getDate()));
  }
  return null;
}
