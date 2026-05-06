import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import type { InventoryItem, ItemPlan } from '../types/models';

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
function applyWebHyperlinkColumn(ws: XLSX.WorkSheet, colIndex: number): void {
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

/** 生成 xlsx 并写入缓存目录，返回文件 URI */
export async function writeStowXlsxFile(
  selection: ExportSheetsSelection,
  data: { items: InventoryItem[]; plans: ItemPlan[] }
): Promise<string> {
  if (!selection.items && !selection.plans) {
    throw new Error('NO_SELECTION');
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
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error('NO_CACHE_DIR');

  const stamp = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fname = `Stow导出_${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}_${pad(stamp.getHours())}${pad(stamp.getMinutes())}.xlsx`;

  const uri = `${dir}${fname}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: 'base64' });
  return uri;
}
