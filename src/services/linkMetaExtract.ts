/**
 * 不依赖 AI，从商品页 HTML 中抽取常见「标题 + 主图」：
 * Open Graph / Twitter Card / JSON-LD(Product) / <title>
 * 淘宝/京东等强反爬站可能返回登录页或空壳，此时规则抽取会失败，可再依赖文本模型或手动录入。
 */

export type ExtractedLinkMeta = {
  title?: string;
  imageUrl?: string;
};

/** SPA 首屏常见占位标题（如得物 fast.dewu.com），不可当作商品名 */
export function sanitizeProductTitle(raw: string | undefined): string | undefined {
  if (raw == null) return undefined;
  const t = raw.replace(/\s+/g, ' ').trim();
  if (t.length < 2) return undefined;
  const lower = t.toLowerCase();
  if (lower === 'loading' || /^loading\.+$/.test(lower)) return undefined;
  if (/^加载中/.test(t)) return undefined;
  if (t === '请稍候' || t === '请稍后') return undefined;
  if (t === '...' || t === '…') return undefined;
  return t;
}

/** 规则抽取失败或仅为占位符时，给用户可编辑的兜底标题 */
export function fallbackTitleFromUrl(pageUrl: string): string | undefined {
  try {
    const u = new URL(pageUrl);
    const host = u.hostname.replace(/^www\./, '');
    if (/dewu\.com$/i.test(host) || host.includes('dewu')) {
      return '得物商品（请填写名称）';
    }
    if (/jd\.com|360buy/i.test(host)) return '京东商品（请填写名称）';
    if (/taobao\.com|tmall\.com|tb\.cn/i.test(host)) return '淘宝商品（请填写名称）';
    return `网页抓取 · ${host}`;
  } catch {
    return undefined;
  }
}

/** 详情页静态 HTML 里常见的非主图 URL：收藏心形、点赞、导航小图标等（得物等 SPA 极易排在首位） */
export function isLikelyNonProductUiImageUrl(url: string): boolean {
  const low = url.toLowerCase();
  if (/icon[_-]?heart|heart[_-]?icon|ic[_-]?heart|heart[_-]?(btn|button|small)|love[_-]?icon|icon[_-]?love/.test(low)) {
    return true;
  }
  if (/like[_-]?(btn|icon)|favorite|favourite|wishlist|want[_-]?it|collect[_-]?(btn|icon)/.test(low)) return true;
  if (/\/icons?\/|iconfont|\bsprite\b|placeholder|loading[_-]?(img|gif)/.test(low)) return true;
  if (/avatar|badge|ribbon|chevron|arrow[_-]?(left|right)|close[_-]?icon|nav[_-]?icon/.test(low)) return true;
  if (/点赞|收藏|爱心图标/.test(url)) return true;
  try {
    const base = (new URL(url).pathname.split('/').pop() ?? '').toLowerCase();
    if (/^(heart|love)\.(png|webp|jpe?g|gif)$/i.test(base)) return true;
  } catch {
    /* */
  }
  const dim = low.match(/[_/](\d{1,3})x(\d{1,3})([_./?]|$)/);
  if (dim) {
    const w = Number(dim[1]);
    const h = Number(dim[2]);
    if (w >= 8 && h >= 8 && w <= 72 && h <= 72) return true;
  }
  return false;
}

export function filterLikelyProductImageUrls(urls: string[]): string[] {
  return urls.filter((u) => Boolean(u) && !isLikelyNonProductUiImageUrl(u));
}

/** 视觉模型误把 UI 图标当商品时的典型简称 */
export function isObviousUiArtifactProductName(name: string): boolean {
  const t = name.replace(/\s+/g, '').trim();
  if (!t) return false;
  return /^(爱心图标|爱心|红心|心形|心形图标|点赞|收藏|收藏图标|箭头|箭头图标|按钮|图标)$/i.test(t);
}

/** 无可用的 http(s) 商品主图 */
export function isEmptyOrInvalidLinkProductImage(url: string | undefined): boolean {
  const u = url?.trim() ?? '';
  return !u || !/^https?:\/\//i.test(u);
}

/**
 * 名称仍为占位/兜底或未识别到具体商品（与 `parseLinkProductFromPage` 的「商品」兜底等一致）
 */
export function isGenericLinkProductName(name: string | undefined, pageUrl: string): boolean {
  const t = name?.replace(/\s+/g, ' ').trim() ?? '';
  if (!t || t.length < 2) return true;
  if (isObviousUiArtifactProductName(t)) return true;
  if (/请填写名称/.test(t)) return true;
  if (/^网页抓取 ·/i.test(t)) return true;
  if (t === '商品') return true;
  const fb = fallbackTitleFromUrl(pageUrl);
  if (fb != null && t === fb) return true;
  return false;
}

/** 链接自动识别结果不可靠：无有效主图，或名称未落到具体商品 */
export function isLinkRecognitionInsufficient(
  preset: { name?: string; imageUrl?: string },
  pageUrl: string
): boolean {
  return (
    isEmptyOrInvalidLinkProductImage(preset.imageUrl) || isGenericLinkProductName(preset.name, pageUrl)
  );
}

/** meta 主图可用则用；若为 UI 图则改用候选列表中第一张可靠图 */
export function pickHeroProductImage(metaUrl: string | undefined, candidates: string[]): string | undefined {
  const list = filterLikelyProductImageUrls(candidates);
  const m = metaUrl?.trim();
  if (m && /^https?:\/\//i.test(m) && !isLikelyNonProductUiImageUrl(m)) return m;
  return list[0];
}

/** 链接录入：真实 meta 优先；若仅有域名兜底标题则尝试采用 AI 名称 */
export function resolvePresetTitleFromLink(
  extractedTitle: string | undefined,
  aiTitle: string | undefined,
  pageUrl: string
): string | undefined {
  const fb = fallbackTitleFromUrl(pageUrl);
  const ex = sanitizeProductTitle(extractedTitle);
  const ai = sanitizeProductTitle(aiTitle);
  if (fb != null && ex === fb) {
    return ai ?? ex;
  }
  return ex ?? ai ?? fb;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function metaByProp(html: string, prop: string, attr: 'property' | 'name'): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]+${attr}=["']${prop.replace(/\./g, '\\.')}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${prop.replace(/\./g, '\\.')}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeHtmlEntities(m[1].trim());
  }
  return undefined;
}

function documentTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m?.[1]) return undefined;
  const t = decodeHtmlEntities(m[1].replace(/\s+/g, ' ').trim());
  return t.length > 0 ? t : undefined;
}

function extractJsonLdBlocks(html: string): string[] {
  const blocks: string[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const inner = m[1]?.trim();
    if (inner) blocks.push(inner);
  }
  return blocks;
}

function normalizeImageUrl(src: string | undefined, baseUrl: string): string | undefined {
  if (!src?.trim()) return undefined;
  const s = decodeHtmlEntities(src.trim()).replace(/^\/\//, 'https://');
  try {
    return new URL(s, baseUrl).href;
  } catch {
    return undefined;
  }
}

function tryProductFromJsonLd(blocks: string[]): { name?: string; image?: string } {
  const out: { name?: string; image?: string } = {};
  for (const block of blocks) {
    try {
      const data = JSON.parse(block);
      const stack: unknown[] = [data];
      while (stack.length) {
        const cur = stack.pop();
        if (cur == null) continue;
        if (Array.isArray(cur)) {
          cur.forEach((x) => stack.push(x));
          continue;
        }
        if (typeof cur !== 'object') continue;
        const o = cur as Record<string, unknown>;
        if ('@graph' in o && Array.isArray(o['@graph'])) {
          stack.push(...o['@graph']);
        }
        const types = o['@type'];
        const tlist = Array.isArray(types) ? types : types != null ? [types] : [];
        const productLike = tlist.some((t) =>
          /Product|ProductGroup|IndividualProduct|Offer/i.test(String(t))
        );
        if (productLike) {
          const n = o.name;
          if (typeof n === 'string' && !out.name) out.name = decodeHtmlEntities(n.trim());
          const img = o.image;
          if (!out.image && typeof img === 'string') out.image = img;
          else if (!out.image && Array.isArray(img)) {
            const first = img[0];
            if (typeof first === 'string') out.image = first;
            else if (first && typeof first === 'object' && 'url' in first) {
              const u = (first as { url?: string }).url;
              if (typeof u === 'string') out.image = u;
            }
          } else if (!out.image && img && typeof img === 'object' && !Array.isArray(img)) {
            const u = (img as { url?: string }).url;
            if (typeof u === 'string') out.image = u;
          }
        }
        for (const v of Object.values(o)) {
          if (v && typeof v === 'object') stack.push(v);
        }
      }
    } catch {
      /* 非法 JSON-LD */
    }
    if (out.name || out.image) break;
  }
  return out;
}

/** 从详情页 HTML 收集可能的主图 URL（供模型择优；含 meta、JSON-LD、懒加载属性） */
export function collectProductImageCandidates(html: string, pageUrl: string, limit = 40): string[] {
  const seen = new Set<string>();
  const push = (raw?: string) => {
    const u = normalizeImageUrl(raw, pageUrl);
    if (!u || !/^https?:\/\//i.test(u)) return;
    const low = u.toLowerCase();
    if (low.startsWith('data:')) return;
    if (/\.svg(\?|$)/i.test(low)) return;
    if (/favicon|pixel\.gif|\.ico(\?|$)|1x1|blank\.gif|spacer|logo[_-]?small|avatar[_-]?thumb/i.test(low)) {
      return;
    }
    if (isLikelyNonProductUiImageUrl(u)) return;
    if (!seen.has(u)) seen.add(u);
  };

  push(metaByProp(html, 'og:image', 'property'));
  push(metaByProp(html, 'twitter:image', 'name'));

  for (const block of extractJsonLdBlocks(html)) {
    try {
      const data = JSON.parse(block);
      const stack: unknown[] = [data];
      while (stack.length) {
        const cur = stack.pop();
        if (cur == null) continue;
        if (Array.isArray(cur)) {
          cur.forEach((x) => stack.push(x));
          continue;
        }
        if (typeof cur !== 'object') continue;
        const o = cur as Record<string, unknown>;
        if ('@graph' in o && Array.isArray(o['@graph'])) stack.push(...o['@graph']);
        const img = o.image;
        if (typeof img === 'string') push(img);
        else if (Array.isArray(img)) {
          for (const x of img) {
            if (typeof x === 'string') push(x);
            else if (x && typeof x === 'object' && 'url' in x) {
              const u = (x as { url?: string }).url;
              if (typeof u === 'string') push(u);
            }
          }
        } else if (img && typeof img === 'object' && 'url' in img) {
          const u = (img as { url?: string }).url;
          if (typeof u === 'string') push(u);
        }
        for (const v of Object.values(o)) {
          if (v && typeof v === 'object') stack.push(v);
        }
      }
    } catch {
      /* skip */
    }
  }

  const attrRe =
    /(?:src|data-src|data-original|data-lazy-src|data-lazy)=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(html)) !== null) {
    const v = m[1]?.trim();
    if (!v || v.startsWith('data:') || v.startsWith('{')) continue;
    if (
      /\.(jpe?g|png|webp|gif)(\?[^"'<>]*)?$/i.test(v) ||
      /imgcdn|image|img\.alicdn|gw\.alicdn|jdimg|360buyimg|126\.net|qpic|douyinpic|douyinstatic/i.test(
        v
      )
    ) {
      push(v);
    }
    if (seen.size >= limit * 3) break;
  }

  return Array.from(seen).slice(0, limit);
}

export function extractProductMetaFromHtml(html: string, pageUrl: string): ExtractedLinkMeta {
  const ogTitle = metaByProp(html, 'og:title', 'property');
  const ogImage = metaByProp(html, 'og:image', 'property');
  const twTitle = metaByProp(html, 'twitter:title', 'name');
  const twImage = metaByProp(html, 'twitter:image', 'name');
  const ld = tryProductFromJsonLd(extractJsonLdBlocks(html));

  const rawCandidates = [
    ogTitle && ogTitle.length > 1 ? ogTitle : undefined,
    ld.name && ld.name.length > 1 ? ld.name : undefined,
    twTitle && twTitle.length > 1 ? twTitle : undefined,
    documentTitle(html),
  ];
  let title: string | undefined;
  for (const c of rawCandidates) {
    const s = sanitizeProductTitle(c);
    if (s) {
      title = s;
      break;
    }
  }
  if (!title) title = fallbackTitleFromUrl(pageUrl);

  const imageRaw = ogImage || twImage || ld.image;
  let imageUrl = normalizeImageUrl(imageRaw, pageUrl);
  if (imageUrl && isLikelyNonProductUiImageUrl(imageUrl)) imageUrl = undefined;

  return {
    title: title?.slice(0, 500),
    imageUrl,
  };
}
