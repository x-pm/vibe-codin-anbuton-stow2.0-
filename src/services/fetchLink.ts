/**
 * 与参考项目 server.ts 中 /api/fetch-link 逻辑一致：提取 URL、拉取页面并剥离 script/style。
 * 在剥离前额外做 Open Graph / JSON-LD 等规则抽取（不调用 AI）。
 */

import type { ExtractedLinkMeta } from './linkMetaExtract';
import { extractProductMetaFromHtml } from './linkMetaExtract';

function extractUrl(raw: string): string {
  const match = raw.match(/(https?:\/\/[^\s「〉》】]+)/i);
  let url = match ? match[1] : raw.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

/** 淘宝短链 / 详情页对移动端 UA 常返回空壳或拦截；改用桌面 Chrome 略提高可得 HTML（仍可能被登录墙挡住） */
function isTaobaoFamilyUrl(urlStr: string): boolean {
  try {
    const h = new URL(urlStr).hostname.toLowerCase();
    return (
      h === 'e.tb.cn' ||
      h === 'tb.cn' ||
      h.endsWith('.tb.cn') ||
      h.endsWith('.taobao.com') ||
      h === 'taobao.com' ||
      h.endsWith('.tmall.com') ||
      h === 'tmall.com'
    );
  } catch {
    return false;
  }
}

function buildFetchHeaders(pageUrl: string): HeadersInit {
  const common: Record<string, string> = {
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  };
  if (isTaobaoFamilyUrl(pageUrl)) {
    return {
      ...common,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Referer: 'https://www.taobao.com/',
    };
  }
  return {
    ...common,
    'User-Agent':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  };
}

export type FetchLinkResult = {
  html: string;
  finalUrl: string;
  /** 规则抽取：标题、主图 URL（相对路径已转为绝对路径） */
  extracted: ExtractedLinkMeta;
};

const FETCH_TIMEOUT_MS = 28_000;

export async function fetchLinkContent(rawInput: string): Promise<FetchLinkResult> {
  const url = extractUrl(rawInput);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      signal: ctrl.signal,
      headers: buildFetchHeaders(url),
      redirect: 'follow',
    });
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    if (err.name === 'AbortError') {
      throw new Error(`抓取链接超时（${FETCH_TIMEOUT_MS / 1000} 秒），请检查网络或稍后重试。`);
    }
    throw new Error(err.message || '无法连接该链接');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const msg =
      response.status === 403 || response.status === 401
        ? '站点拒绝访问（403/401）。常见原因：电商反爬要求登录或仅限浏览器/H5。可尝试复制链接用手机浏览器打开确认；名称与主图仍可尝试「仅抓取」失败后用手动录入。'
        : response.status === 404
          ? '页面不存在（404）'
          : `请求失败（${response.status}）`;
    throw new Error(msg);
  }

  const htmlRaw = await response.text();
  const finalUrl = typeof response.url === 'string' && response.url ? response.url : url;
  const extracted = extractProductMetaFromHtml(htmlRaw, finalUrl);

  const clean = htmlRaw
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, '')
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, '');

  return { html: clean.slice(0, 60000), finalUrl, extracted };
}

/** 粗略去标签，供链接解析/AI 上下文等使用 */
export function htmlToPlainText(html: string, maxLen = 4000): string {
  const t = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
  return t
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}
