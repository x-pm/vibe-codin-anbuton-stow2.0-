import type { ItemFormPreset } from '../types/models';
import { enrichPresetWithEstimatedLocation } from '../utils/estimateStorageRoom';
import { callAiProxy, isCloudbaseConfigured } from './cloudbase';
import { fallbackTitleFromUrl, sanitizeProductTitle } from './linkMetaExtract';

const DEFAULT_BASE = 'https://api.siliconflow.cn/v1';
const DEFAULT_TEXT_MODEL = 'Qwen/Qwen2.5-7B-Instruct';
/** 视觉模型需在硅基流动「模型广场」选带「视觉」标签；旧版 Qwen2.5-VL-7B 常报 20012 不存在，默认改用 Qwen3-VL */
const DEFAULT_VISION_MODEL = 'Qwen/Qwen3-VL-30B-A3B-Instruct';
/** 链接录入默认文本模型（与扫描/通用 TEXT 分开）；可被 EXPO_PUBLIC_SILICONFLOW_LINK_TEXT_MODEL 覆盖 */
const DEFAULT_LINK_TEXT_MODEL = 'Qwen/Qwen2.5-14B-Instruct';
/** 链接配图精炼默认视觉模型（与扫描默认分开）；可被 LINK_VISION / VISION 环境变量覆盖 */
const DEFAULT_LINK_VISION_MODEL = 'Qwen/Qwen2.5-VL-32B-Instruct';

const SYSTEM_JSON = `你是中文个人仓库「物品录入」助手。只输出一个 JSON 对象，不要 markdown，不要解释。
键与含义：
name（物品名称，尽量具体；扫描/拍照时填写与实物识别置信度最高的名称即可，不要仅因可能与仓库已有名称相近或同名而改写或刻意回避）,
sku（条码/货号，看不清可为空）,
location（推测的存放房间，优先从以下选择：客厅|餐厅|主卧|次卧|儿童房|厨房|卫生间|书房|玄关|阳台|杂物间|衣帽间|保姆房|车库；餐具、厨具、食品饮料等优先填「厨房」；洗发沐浴、牙膏牙刷、毛巾浴巾等洗浴用品优先填「卫生间」；其余无法明确判断时填「主卧」）,
category（必须是以下之一：电子产品|耗材|文献|工具|衣物|其他）,
remarks（备注：可含包装上的文字、品牌、规格、外观描述等）,
quantity（整数件数，无法判断则为1）。
未知用空字符串或 1。`;

const SYSTEM_LINK_PRODUCT = `你是电商商品详情页解析助手，只输出一个 JSON，不要 markdown，不要解释。
键：name, imageUrl, sku, category, remarks, quantity（整数，默认 1）。
category 必须是以下之一：电子产品|耗材|文献|工具|衣物|其他

【name】必须与详情页「主商品首图」指向的实物一致，取最具体、最可区分的称呼：
- 删除促销语（秒杀、包邮、定金）、空洞形容词（爆款、超值）、重复品牌堆砌、店铺名。
- 删除宽泛品类词单独成团时：若仍有型号/系列名则只保留核心词（如「AirPods Pro」优于「蓝牙耳机」）；若仅剩品类则压缩到具体款式关键词。
- **长度硬性限制**：最终 name 去掉空格后，总长度不得超过 **7 个 Unicode 字符**（汉字、字母、数字均各占 1 位）；超长则必须缩写，优先保留型号/系列。

【imageUrl】必须是下列「候选图片 URL」列表中某一条的**完全一致**的 URL 字符串（可复制粘贴匹配）。
- 选择最能代表主商品单品、清晰正面的详情首图；不要选海报拼图、广告横幅、无关图标。
- 若候选为空，可填 META 主图那条 URL（若提供了 META 主图且你认为它是主商品图）。
- 无法判断则填空字符串。

【remarks】简短摘录可见规格/颜色/尺码等（≤200 字）；【sku】可见货号则填。`;

/** 商品简称不超过 max 个 Unicode 码位（满足「≤7 个字」） */
export function clampProductName(name: string, maxChars = 7): string {
  const t = name.replace(/\s+/g, '').trim();
  if (!t) return '';
  return Array.from(t).slice(0, maxChars).join('');
}

/** 视觉模型纯文本输出：去标点、取首行（默认用链接专用视觉模型，见 getLinkVisionModel） */
const SYSTEM_LINK_VISION_REFINE = `你是一个电商商品信息精炼专家。请根据商品标题和商品图片，提取最核心、最直观的商品描述。

## 任务要求
1. 从标题中识别：品牌/IP、核心品类、最显著特征
2. 结合商品图片，保留视觉上最突出的元素
3. 输出不超过7个汉字，优先保留"IP/品牌+品类"或"核心特征+品类"

## 输出格式
直接输出精炼后的商品名，不要解释、不要标点、不要多余内容。

## 示例
输入：Sanrio三丽鸥HelloKitty/凯蒂猫保温保冷杯联名款冰霸杯 高颜值可爱萌物女生吸管水杯桌面
输出：凯蒂猫保温杯

输入：迪士尼草莓熊毛绒玩具公仔玩偶睡觉抱枕布娃娃女生生日礼物超大号
输出：草莓熊玩偶

输入：Apple/苹果 iPhone 15 Pro Max 5G手机 钛金属 原色 256GB
输出：iPhone 15`;

function stripRefinedProductNameOutput(raw: string): string {
  let s = raw.trim().split(/\r?\n/)[0]?.trim() ?? '';
  s = s.replace(/^[`"'「」『』【】]+|[`"'「」『』【】]+$/g, '');
  s = s.replace(/[，。、；：！？…,.!?;:《》（）\-_/\\|]+/g, '');
  return s.trim();
}

/**
 * 链接配图精炼：商品标题 + 商品图 URL → 简称（≤7 码位）。默认使用链接专用视觉模型（更强一档，与扫描可分开配置）。
 */
export async function refineLinkProductNameFromTitleAndImage(
  title: string,
  imageUrl: string
): Promise<string> {
  const visionModel = getLinkVisionModel();
  const titleSlice = title.replace(/\s+/g, ' ').trim().slice(0, 1200);
  const userContent: Array<Record<string, unknown>> = [
    {
      type: 'image_url',
      image_url: {
        url: imageUrl,
        detail: 'low',
      },
    },
    {
      type: 'text',
      text: `商品标题：${titleSlice || '（无标题）'}

商品图片：见配图。

请根据标题与配图，直接输出精炼后的商品名（不要解释、不要标点）。`,
    },
  ];

  const raw = await siliconflowChatCompletion(
    visionModel,
    [
      { role: 'system', content: SYSTEM_LINK_VISION_REFINE },
      { role: 'user', content: userContent },
    ],
    {
      timeoutMs: 120_000,
      modelNotExistHint:
        '说明：链接精炼视觉模型不可用（错误码常为 20012）。请到 https://siliconflow.cn/models 筛选「视觉 / 多模态」，写入 EXPO_PUBLIC_SILICONFLOW_LINK_VISION_MODEL 或 EXPO_PUBLIC_SILICONFLOW_VISION_MODEL，保存后执行 npx expo start -c。',
    }
  );

  const cleaned = stripRefinedProductNameOutput(raw);
  return clampProductName(cleaned, 7);
}

function normalizeHref(u: string): string {
  try {
    const x = new URL(u).href;
    return x.replace(/\/+$/, '');
  } catch {
    return u.trim();
  }
}

function pickValidatedImageUrl(
  modelUrl: string | undefined,
  candidates: string[],
  metaUrl?: string
): string | undefined {
  const pool = new Map<string, string>();
  for (const c of candidates) {
    pool.set(normalizeHref(c), c);
  }
  if (metaUrl) {
    try {
      pool.set(normalizeHref(metaUrl), metaUrl);
    } catch {
      /* */
    }
  }
  const raw = modelUrl?.trim();
  if (raw && raw !== 'null') {
    try {
      const n = normalizeHref(raw);
      const hit = pool.get(n);
      if (hit) return hit;
    } catch {
      /* */
    }
  }
  return metaUrl ?? candidates[0];
}

function getApiKey(): string {
  return process.env.EXPO_PUBLIC_SILICONFLOW_API_KEY?.trim() ?? '';
}

/** 是否已配置 AI：优先云开发云函数；否则回退本地硅基 Key */
export function isSiliconflowConfigured(): boolean {
  return isCloudbaseConfigured() || getApiKey().length > 0;
}

function getBaseUrl(): string {
  return (process.env.EXPO_PUBLIC_SILICONFLOW_BASE_URL?.trim() || DEFAULT_BASE).replace(/\/$/, '');
}

function getTextModel(): string {
  return process.env.EXPO_PUBLIC_SILICONFLOW_MODEL?.trim() || DEFAULT_TEXT_MODEL;
}

function getVisionModel(): string {
  return process.env.EXPO_PUBLIC_SILICONFLOW_VISION_MODEL?.trim() || DEFAULT_VISION_MODEL;
}

/** 链接录入 HTML/字段解析；未单独配置时默认用更强文本模型（仍可通过 LINK_TEXT_MODEL 指定其它模型） */
function getLinkTextModel(): string {
  const link = process.env.EXPO_PUBLIC_SILICONFLOW_LINK_TEXT_MODEL?.trim();
  if (link) return link;
  const general = process.env.EXPO_PUBLIC_SILICONFLOW_MODEL?.trim();
  if (general) return general;
  return DEFAULT_LINK_TEXT_MODEL;
}

/** 链接配图精炼；未单独配置时默认 Qwen2.5-VL-32B，与扫描默认 VL 模型分离 */
function getLinkVisionModel(): string {
  const link = process.env.EXPO_PUBLIC_SILICONFLOW_LINK_VISION_MODEL?.trim();
  if (link) return link;
  const general = process.env.EXPO_PUBLIC_SILICONFLOW_VISION_MODEL?.trim();
  if (general) return general;
  return DEFAULT_LINK_VISION_MODEL;
}

function safeJsonParse(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function presetFromJsonObject(obj: Record<string, unknown>): ItemFormPreset {
  const quantityRaw = obj.quantity;
  let quantity = 1;
  if (typeof quantityRaw === 'number' && Number.isFinite(quantityRaw)) {
    quantity = Math.max(1, Math.floor(quantityRaw));
  } else if (typeof quantityRaw === 'string' && /^\d+$/.test(quantityRaw)) {
    quantity = Math.max(1, parseInt(quantityRaw, 10));
  }

  const rawName = String(obj.name ?? '').trim();
  return enrichPresetWithEstimatedLocation({
    name: sanitizeProductTitle(rawName) ?? '',
    sku: String(obj.sku ?? '').trim(),
    location: String(obj.location ?? '').trim(),
    category: String(obj.category ?? '').trim(),
    remarks: String(obj.remarks ?? '').trim() || undefined,
    quantity,
  });
}

async function fetchPostChatCompletions(
  url: string,
  apiKey: string,
  body: { model: string; temperature: number; messages: unknown[] },
  timeoutMs: number
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    if (err.name === 'AbortError') {
      throw new Error(
        `请求超时（${Math.round(timeoutMs / 1000)} 秒内无响应）。请检查手机网络能否访问硅基流动（api.siliconflow.cn），或改用 Wi‑Fi / 关闭代理后再试。`
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function friendlyUpstreamError(errText: string, opts?: { modelNotExistHint?: string }): Error {
  let friendly = '';
  try {
    const j = JSON.parse(errText) as { code?: number; message?: string };
    const code = j.code;
    const msg = String(j.message ?? '');
    if (code === 30001 || /insufficient|balance|余额不足|额度/i.test(msg)) {
      friendly =
        '硅基流动账户余额不足或免费额度已用尽（错误码 30001），暂时无法调用模型。请到 siliconflow.cn 控制台充值或领取额度后再试；当前可先使用「手动录入」或不走 AI 的流程。';
    }
  } catch {
    /* */
  }
  let hint = '';
  if (
    opts?.modelNotExistHint &&
    (errText.includes('20012') ||
      errText.includes('Model does not exist') ||
      errText.includes('model does not exist'))
  ) {
    hint = `\n\n${opts.modelNotExistHint}`;
  }
  if (friendly) return new Error(friendly + hint);
  return new Error(
    `模型请求失败${errText ? `: ${errText.slice(0, 280)}` : ''}${hint}`
  );
}

/** 经云函数 stowyun 调用硅基（推荐） */
async function siliconflowViaCloudbase(
  model: string,
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string | Array<Record<string, unknown>>;
  }>,
  opts?: { modelNotExistHint?: string; timeoutMs?: number }
): Promise<string> {
  const timeoutMs = opts?.timeoutMs ?? 90_000;
  const result = await callAiProxy({
    model,
    messages,
    temperature: 0.2,
    timeoutMs,
  });

  if (!result.ok) {
    if (result.error === 'UNAUTHORIZED') {
      throw new Error(
        result.message ||
          '云函数拒绝未登录调用。请确认已开启匿名登录，且函数权限为 auth != null。'
      );
    }
    if (result.error === 'NO_API_KEY') {
      throw new Error(
        '云函数未配置 SILICONFLOW_API_KEY。请在云开发控制台为函数添加环境变量后重新部署。'
      );
    }
    const errText =
      typeof result.body === 'string'
        ? result.body
        : result.body
          ? JSON.stringify(result.body)
          : result.message || result.error || '';
    throw friendlyUpstreamError(errText, opts);
  }

  return result.content ?? '';
}

/** 本地直连硅基（无云开发时的回退） */
async function siliconflowDirect(
  model: string,
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string | Array<Record<string, unknown>>;
  }>,
  opts?: { modelNotExistHint?: string; timeoutMs?: number }
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      '未配置云开发环境 ID，也未配置 EXPO_PUBLIC_SILICONFLOW_API_KEY。请在 .env 填写 EXPO_PUBLIC_CLOUDBASE_ENV_ID，或本地硅基 Key。'
    );
  }

  const timeoutMs = opts?.timeoutMs ?? 90_000;
  const res = await fetchPostChatCompletions(
    `${getBaseUrl()}/chat/completions`,
    apiKey,
    {
      model,
      temperature: 0.2,
      messages,
    },
    timeoutMs
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw friendlyUpstreamError(errText, opts);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? '';
}

async function siliconflowChatCompletion(
  model: string,
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string | Array<Record<string, unknown>>;
  }>,
  opts?: { modelNotExistHint?: string; timeoutMs?: number }
): Promise<string> {
  if (isCloudbaseConfigured()) {
    return siliconflowViaCloudbase(model, messages, opts);
  }
  return siliconflowDirect(model, messages, opts);
}

/**
 * 链接详情页 HTML → 精炼简称（≤7 字）+ 主图 URL + 其余录入字段
 */
export async function parseLinkProductFromPage(params: {
  pageUrl: string;
  metaTitle?: string;
  metaImageUrl?: string;
  imageCandidates: string[];
  plainExcerpt: string;
  htmlSnippet: string;
}): Promise<ItemFormPreset> {
  const numbered =
    params.imageCandidates.length > 0
      ? params.imageCandidates.map((u, i) => `${i + 1}. ${u}`).join('\n')
      : '（无）';

  const user = `页面 URL（基准）：${params.pageUrl}
META 标题：${params.metaTitle ?? '（无）'}
META 主图：${params.metaImageUrl ?? '（无）'}

候选图片 URL（imageUrl 必须逐字等于其中一条，或等于 META 主图）：
${numbered}

正文摘录：
${params.plainExcerpt.slice(0, 3800)}

HTML 片段（辅助，可能截断）：
${params.htmlSnippet.slice(0, 12000)}`;

  const raw = await siliconflowChatCompletion(
    getLinkTextModel(),
    [
      { role: 'system', content: SYSTEM_LINK_PRODUCT },
      { role: 'user', content: user },
    ],
    { timeoutMs: 90_000 }
  );

  const obj = safeJsonParse(raw);
  if (!obj) {
    throw new Error('模型返回无法解析为 JSON，请重试。');
  }

  const base = presetFromJsonObject(obj);
  const imgRaw = typeof obj.imageUrl === 'string' ? obj.imageUrl.trim() : '';
  const imageUrl = pickValidatedImageUrl(
    imgRaw || undefined,
    params.imageCandidates,
    params.metaImageUrl
  );

  const rawModelName = String(obj.name ?? base.name ?? '').trim();
  const modelSanitized = sanitizeProductTitle(rawModelName);
  let name = modelSanitized ? clampProductName(modelSanitized, 7) : '';

  if (!name) {
    /** 占位/域名兜底标题须完整展示，不能再做 7 字截断（否则会出现「淘宝商品（请填」） */
    name =
      sanitizeProductTitle(params.metaTitle) ?? fallbackTitleFromUrl(params.pageUrl) ?? '商品';
    name = name.slice(0, 120);
  }

  return enrichPresetWithEstimatedLocation({
    ...base,
    name,
    imageUrl,
  });
}

/**
 * 文本 / 网页摘录 → 字段（纯文本模型）
 * @param opts.linkFlow 为 true 时使用链接录入专用文本模型（默认 14B，见 getLinkTextModel）
 */
export async function parseItemFieldsFromText(
  content: string,
  opts?: { linkFlow?: boolean }
): Promise<ItemFormPreset> {
  const model = opts?.linkFlow ? getLinkTextModel() : getTextModel();
  const user = `待解析内容（可截断）：\n${content.slice(0, 12000)}`;
  const raw = await siliconflowChatCompletion(
    model,
    [
      { role: 'system', content: SYSTEM_JSON },
      { role: 'user', content: user },
    ],
    { timeoutMs: 90_000 }
  );
  const obj = safeJsonParse(raw);
  if (!obj) {
    throw new Error('模型返回无法解析为 JSON，请重试或改用手动录入。');
  }
  return presetFromJsonObject(obj);
}

/**
 * 照片（data:image/jpeg;base64,...）→ 字段（多模态视觉模型）
 * 文档：https://docs.siliconflow.cn/cn/userguide/capabilities/multimodal-vision
 */
export async function parseItemFieldsFromImageDataUri(dataUri: string): Promise<ItemFormPreset> {
  const visionModel = getVisionModel();
  const userContent: Array<Record<string, unknown>> = [
    {
      type: 'image_url',
      image_url: {
        url: dataUri,
        detail: 'low',
      },
    },
    {
      type: 'text',
      text: '请根据照片中物品的外观、包装与可见文字，填写上述 JSON 各字段。若画面中有多个物品，请以画面中心、最清晰的那一个为主。\n【name】以识别准确度为准：不要为避免与仓库已有名称重复或相似而刻意改名；与画面最吻合的名称即可。',
    },
  ];

  const raw = await siliconflowChatCompletion(
    visionModel,
    [
      { role: 'system', content: SYSTEM_JSON },
      { role: 'user', content: userContent },
    ],
    {
      timeoutMs: 120_000,
      modelNotExistHint:
        '说明：视觉模型 ID 写错或平台已下线该型号（错误码常为 20012）。请到 https://siliconflow.cn/models 筛选「视觉」，复制控制台里的模型全名，写入 .env 的 EXPO_PUBLIC_SILICONFLOW_VISION_MODEL，保存后执行 npx expo start -c。',
    }
  );
  const obj = safeJsonParse(raw);
  if (!obj) {
    throw new Error('视觉模型返回无法解析为 JSON，请重试或改用手动录入。');
  }
  return presetFromJsonObject(obj);
}
