import * as FileSystem from 'expo-file-system/legacy';
import type { InventoryItem, ItemPlan } from '../types/models';
import type * as XLSXTypes from 'xlsx';

/**
 * 使用浏览器完整包，避免 Node 版 xlsx.js 在 RN/Metro 里 require('stream') / cpexcel 失败。
 * （community SheetJS 在 Expo Go 中的常见坑）
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx/dist/xlsx.full.min.js') as typeof XLSXTypes;

/** 我的物品：从左到右 — 编号、分组、名称、数量、位置、备注、图片 */
const ITEM_KEYS = ['编号', '分组', '名称', '数量', '位置', '备注', '图片'] as const;

/** 待办计划：从左到右 — 标签、标题、日期、创建时间、是否已完成 */
const PLAN_KEYS = ['标签', '标题', '日期', '创建时间', '是否已完成'] as const;

function itemDisplayCode(it: InventoryItem): string {
  const label = it.codeLabel?.trim();
  if (label) return label;
  return String(it.inventoryNumber ?? '');
}

function itemLocation(it: InventoryItem): string {
  return [it.location, it.locationDetail].filter(Boolean).join(' · ');
}

function itemRow(it: InventoryItem): Record<(typeof ITEM_KEYS)[number], string | number> {
  return {
    编号: itemDisplayCode(it),
    分组: it.group ?? it.category ?? '',
    名称: it.name,
    数量: it.quantity,
    位置: itemLocation(it),
    备注: it.notes ?? '',
    图片: (it.imageUri ?? '').trim(),
  };
}

function formatDateOnly(ms?: number): string {
  if (ms == null) return '';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function formatDateTime(ms?: number): string {
  if (ms == null) return '';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function planRow(p: ItemPlan): Record<(typeof PLAN_KEYS)[number], string> {
  return {
    标签: p.tag,
    标题: p.title,
    日期: formatDateOnly(p.createdAt),
    创建时间: formatDateTime(p.createdAt),
    是否已完成: p.completed ? '是' : '否',
  };
}

/** Excel 中对单元格写入 HYPERLINK，便于点击跳转（仅 http/https） */
function applyWebHyperlinkColumn(ws: XLSXTypes.WorkSheet, colIndex: number): void {
  const ref = ws['!ref'];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: colIndex });
    const cell = ws[addr];
    if (!cell || cell.v === undefined || cell.v === '') continue;
    const url = String(cell.v).trim();
    if (!/^https?:\/\//i.test(url)) continue;
    const escaped = url.replace(/"/g, '""');
    ws[addr] = { f: `HYPERLINK("${escaped}","${escaped}")` };
  }
}

export type ExportSheetsSelection = { items: boolean; plans: boolean };

function friendlyExportError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw === 'NO_SELECTION') return new Error('请至少选择一项导出内容');
  if (raw === 'NO_CACHE_DIR') return new Error('无法访问应用缓存目录，请重启应用后重试');
  if (/Unable to resolve|Cannot find module|xlsx|stream/i.test(raw)) {
    return new Error('表格组件加载失败，请重新打开应用后再试');
  }
  return err instanceof Error ? err : new Error(raw || '导出失败');
}

/** 生成 xlsx 并写入缓存目录，返回文件 URI */
export async function writeStowXlsxFile(
  selection: ExportSheetsSelection,
  data: { items: InventoryItem[]; plans: ItemPlan[] }
): Promise<string> {
  try {
    if (!selection.items && !selection.plans) {
      throw new Error('NO_SELECTION');
    }
    if (!XLSX?.utils?.book_new || typeof XLSX.write !== 'function') {
      throw new Error('xlsx');
    }

    const wb = XLSX.utils.book_new();

    if (selection.items) {
      const rows = data.items.map(itemRow);
      const ws =
        rows.length > 0
          ? XLSX.utils.json_to_sheet(rows)
          : XLSX.utils.aoa_to_sheet([[...ITEM_KEYS]]);
      if (rows.length > 0) {
        applyWebHyperlinkColumn(ws, ITEM_KEYS.indexOf('图片'));
      }
      XLSX.utils.book_append_sheet(wb, ws, '我的物品');
    }

    if (selection.plans) {
      const rows = data.plans.map(planRow);
      const ws =
        rows.length > 0
          ? XLSX.utils.json_to_sheet(rows)
          : XLSX.utils.aoa_to_sheet([[...PLAN_KEYS]]);
      XLSX.utils.book_append_sheet(wb, ws, '待办计划');
    }

    const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    if (typeof base64 !== 'string' || !base64.length) {
      throw new Error('表格生成结果为空');
    }

    const dir = FileSystem.cacheDirectory;
    if (!dir) throw new Error('NO_CACHE_DIR');

    // Android / 部分系统分享对中文文件名不稳定，使用 ASCII 文件名
    const stamp = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const fname = `stow-export-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}_${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}.xlsx`;

    const uri = `${dir}${fname}`;
    await FileSystem.writeAsStringAsync(uri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return uri;
  } catch (e) {
    throw friendlyExportError(e);
  }
}
