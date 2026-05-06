import type { InventoryItem } from '../types/models';

/** 综合相似度（余弦 / LCS / Jaccard / 子串等取 max）≥ 此值则判定为相似。0.82：偏少误报（与较严子串规则搭配）。 */
export const ITEM_SIMILARITY_THRESHOLD = 0.82;

/** 子串强匹配分：较短名为较长名的连续子串时给出，须 ≥ 此长度才触发，避免「皇帝」⊂「我是皇帝」等 2 字误报 */
const SUBSTRING_STRONG_SCORE = 0.92;
const SUBSTRING_MIN_SHORT_LENGTH = 3;

const CN_STOP = new Set([
  '的',
  '了',
  '和',
  '与',
  '在',
  '是',
  '有',
  '为',
  '但',
  '及',
  '或',
  '等',
  '款',
  '型',
  '号',
  '个',
  '中',
  '其',
  '对',
  '以',
  '把',
  '将',
  '被',
  '所',
  '从',
  '到',
  '也',
  '就',
  '都',
  '而',
]);

const EN_STOP = new Set([
  'the',
  'a',
  'an',
  'of',
  'and',
  'or',
  'to',
  'in',
  'for',
  'on',
  'with',
  'by',
  'from',
  'at',
  'as',
  'is',
  'are',
]);

/** 文档「同义词合并」简表（键归一为值侧词形） */
const SYNONYM_PAIRS: [string, string][] = [
  ['裙子', '连衣裙'],
  ['短裙', '连衣裙'],
  ['长裙', '连衣裙'],
];

function normalizeFullWidthAscii(s: string): string {
  return s.replace(/[\uFF01-\uFF5E]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  ).replace(/\u3000/g, ' ');
}

function applySynonyms(s: string): string {
  let t = s;
  for (const [a, b] of SYNONYM_PAIRS) {
    if (a !== b) t = t.split(a).join(b);
  }
  return t;
}

function normalizeForExact(s: string): string {
  return normalizeFullWidthAscii(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

/**
 * 关键词袋：英文词 + 汉字单字与双字（停用词剔除），近似文档「分词 + 去重归一化」。
 */
export function tokenizeItemNameForSimilarity(raw: string): Set<string> {
  let s = applySynonyms(normalizeFullWidthAscii(raw.trim()));
  s = s.replace(/[^\w\u4e00-\u9fff]+/gi, ' ').toLowerCase();
  const tokens = new Set<string>();
  const add = (w: string) => {
    const t = w.trim();
    if (t.length === 0) return;
    if (EN_STOP.has(t) || CN_STOP.has(t)) return;
    tokens.add(t);
  };

  for (const m of s.match(/[a-z0-9]+/gi) ?? []) add(m);

  const hanOnly = s.replace(/[^\u4e00-\u9fff]/g, '');
  for (let i = 0; i < hanOnly.length; i++) {
    const u = hanOnly[i];
    if (!CN_STOP.has(u)) add(u);
    if (i + 1 < hanOnly.length) {
      add(u + hanOnly[i + 1]);
    }
  }

  return tokens;
}

/** 二值向量余弦：|A∩B| / (√|A|·√|B|) */
export function cosineSimilarityTokenSets(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) {
    if (b.has(t)) inter += 1;
  }
  return inter / (Math.sqrt(a.size) * Math.sqrt(b.size));
}

/** 最长公共子串长度 / min(两串长度)，对部分重叠的中文名更敏感 */
function longestCommonSubstringRatio(na: string, nb: string): number {
  if (!na || !nb) return 0;
  let best = 0;
  const cap = 48;
  const a = na.length > cap ? na.slice(0, cap) : na;
  const b = nb.length > cap ? nb.slice(0, cap) : nb;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
      if (k > best) best = k;
    }
  }
  const denom = Math.max(Math.min(na.length, nb.length), 1);
  return best / denom;
}

/** 归一化后汉字字符 Jaccard */
function hanCharJaccard(na: string, nb: string): number {
  const ha = na.replace(/[^\u4e00-\u9fff]/g, '');
  const hb = nb.replace(/[^\u4e00-\u9fff]/g, '');
  if (!ha || !hb) return 0;
  const sa = new Set(Array.from(ha));
  const sb = new Set(Array.from(hb));
  let inter = 0;
  for (const c of sa) {
    if (sb.has(c)) inter += 1;
  }
  const u = sa.size + sb.size - inter;
  return u === 0 ? 0 : inter / u;
}

export function nameSimilarityScore(inputName: string, candidateName: string): number {
  const na = normalizeForExact(inputName);
  const nb = normalizeForExact(candidateName);
  if (na.length > 0 && na === nb) return 1;

  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (shorter.length >= SUBSTRING_MIN_SHORT_LENGTH && longer.includes(shorter)) {
    return SUBSTRING_STRONG_SCORE;
  }

  const ta = tokenizeItemNameForSimilarity(inputName);
  const tb = tokenizeItemNameForSimilarity(candidateName);
  const cos = cosineSimilarityTokenSets(ta, tb);
  const lcs = longestCommonSubstringRatio(na, nb);
  const jac = hanCharJaccard(na, nb);
  return Math.max(cos, lcs, jac);
}

export function findBestSimilarInventoryItem(
  inputName: string,
  items: InventoryItem[]
): { item: InventoryItem; score: number } | null {
  const q = inputName.trim();
  if (q.length < 2) return null;
  let best: { item: InventoryItem; score: number } | null = null;
  for (const it of items) {
    const score = nameSimilarityScore(q, it.name);
    if (!best || score > best.score) {
      best = { item: it, score };
    }
  }
  if (!best || best.score < ITEM_SIMILARITY_THRESHOLD) return null;
  return best;
}
