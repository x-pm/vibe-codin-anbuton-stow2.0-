import { Platform } from 'react-native';
import * as Calendar from 'expo-calendar';
import type { Alarm } from 'expo-calendar';

const EVENT_DURATION_MIN = 30;
const STOW_CALENDAR_TITLE = 'STOW 计划';

async function getWritableEventCalendars(): Promise<Calendar.Calendar[]> {
  const eventType = Calendar.EntityTypes.EVENT;
  return Calendar.getCalendarsAsync(eventType);
}

/**
 * 仅使用 `allowsModifications === true` 的日历；iOS 上勿退回只读订阅日历，否则保存事件会失败。
 */
async function getWritableEventCalendarId(): Promise<string | null> {
  if (Platform.OS === 'ios') {
    try {
      const def = await Calendar.getDefaultCalendarAsync();
      if (def?.id && def.allowsModifications) return def.id;
    } catch {
      // 无默认日历或权限未就绪时继续枚举
    }
  }

  const cals = await getWritableEventCalendars();
  const writable = cals.filter((c) => c.allowsModifications);
  if (writable.length > 0) return writable[0].id;

  if (Platform.OS === 'ios') {
    return createIosStowCalendarIfPossible();
  }

  /** Android：部分机型仅返回主日历且 allowsModifications 字段异常，保留末位兜底 */
  const fallback = cals[0];
  return fallback?.allowsModifications ? fallback.id : null;
}

/**
 * 在本地账户下创建专用日历，避免用户只有「只读订阅」导致无法写入。
 */
async function createIosStowCalendarIfPossible(): Promise<string | null> {
  try {
    const sources = await Calendar.getSourcesAsync();
    if (!sources.length) return null;

    const preferred =
      sources.find((s) => String(s.type).toLowerCase() === 'local') ??
      sources.find((s) => s.isLocalAccount) ??
      sources[0];

    const existing = await getWritableEventCalendars();
    const named = existing.find((c) => c.title === STOW_CALENDAR_TITLE && c.allowsModifications);
    if (named?.id) return named.id;

    return await Calendar.createCalendarAsync({
      title: STOW_CALENDAR_TITLE,
      entityType: Calendar.EntityTypes.EVENT,
      color: '#2c2c2c',
      source: {
        name: preferred.name,
        type: preferred.type as Calendar.SourceType,
        isLocalAccount: preferred.isLocalAccount ?? false,
      },
    });
  } catch {
    return null;
  }
}

/**
 * 请求权限并在可写日历中创建带「事件开始时」提醒的日程。失败返回 null。
 *
 * iOS：须在系统设置 / 弹窗中允许日历；iOS 17+ 若系统区分「完全访问」与「仅添加」，写入日程一般需要完全访问。
 * Info.plist 已含 `NSCalendarsUsageDescription` 与 `NSCalendarsFullAccessUsageDescription`（见 app.json）。
 */
export async function createStowPlanCalendarEvent(input: {
  title: string;
  notes?: string;
  start: Date;
}): Promise<string | null> {
  try {
    const ok = await Calendar.isAvailableAsync();
    if (!ok) return null;

    const perm = await Calendar.requestCalendarPermissionsAsync();
    if (perm.status !== 'granted') return null;

    /** iOS：权限刚写入后偶发尚未同步到 EventKit，短延迟再取日历更稳 */
    if (Platform.OS === 'ios') {
      await new Promise((r) => setTimeout(r, 80));
    }

    const calendarId = await getWritableEventCalendarId();
    if (!calendarId) return null;

    const start = input.start;
    const end = new Date(start.getTime() + EVENT_DURATION_MIN * 60 * 1000);
    /** 分钟：0 表示事件开始时提醒（与 EventKit `EKAlarm` 相对偏移一致） */
    const alarms: Alarm[] = [{ relativeOffset: 0 }];

    const eventId = await Calendar.createEventAsync(calendarId, {
      title: input.title,
      notes: input.notes,
      startDate: start,
      endDate: end,
      allDay: false,
      alarms,
    });
    return eventId;
  } catch (e) {
    if (__DEV__) {
      console.warn('[planCalendarSync] createStowPlanCalendarEvent failed:', e);
    }
    return null;
  }
}

export async function deleteStowPlanCalendarEventIfAny(eventId: string | undefined): Promise<void> {
  if (!eventId) return;
  const ok = await Calendar.isAvailableAsync();
  if (!ok) return;
  const { status } = await Calendar.getCalendarPermissionsAsync();
  if (status !== 'granted') {
    const req = await Calendar.requestCalendarPermissionsAsync();
    if (req.status !== 'granted') return;
  }
  try {
    await Calendar.deleteEventAsync(eventId);
  } catch {
    // 可能已被用户手动删除
  }
}
