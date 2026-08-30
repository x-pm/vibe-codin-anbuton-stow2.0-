/**
 * CloudBase 云函数：AI 代理（控制台函数名可能是 stowyun）
 * 环境变量：SILICONFLOW_API_KEY、SILICONFLOW_BASE_URL
 */

const DEFAULT_BASE = 'https://api.siliconflow.cn/v1';

function resolveUserId(event, context) {
  const bag = [
    context?.EXTENDED_CONTEXT?.userInfo?.openId,
    context?.EXTENDED_CONTEXT?.userInfo?.uid,
    context?.userInfo?.openId,
    context?.userInfo?.uid,
    context?.auth?.uid,
    context?.auth?.openId,
    event?.userInfo?.openId,
    event?.userInfo?.uid,
    process.env.WX_OPENID,
    process.env.TCB_UUID,
    process.env.TCB_OPENID,
  ];
  for (const v of bag) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  // 部分网关把身份塞进 context 字符串
  try {
    const envCtx = process.env.TCB_CONTEXT || process.env.CLOUDBASE_CONTEXT;
    if (envCtx) {
      const j = JSON.parse(envCtx);
      const id = j?.userInfo?.openId || j?.userInfo?.uid || j?.uid || j?.openId;
      if (typeof id === 'string' && id.trim()) return id.trim();
    }
  } catch {
    /* */
  }
  return '';
}

exports.main = async (event, context) => {
  const userId = resolveUserId(event, context);
  if (!userId) {
    return {
      ok: false,
      error: 'UNAUTHORIZED',
      message: '请先登录后再调用 AI（匿名登录也可）',
    };
  }

  const apiKey = (process.env.SILICONFLOW_API_KEY || '').trim();
  if (!apiKey) {
    return {
      ok: false,
      error: 'NO_API_KEY',
      message: '云函数未配置环境变量 SILICONFLOW_API_KEY',
    };
  }

  const baseUrl = (process.env.SILICONFLOW_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
  const model = typeof event.model === 'string' ? event.model.trim() : '';
  const messages = Array.isArray(event.messages) ? event.messages : null;
  const temperature =
    typeof event.temperature === 'number' && Number.isFinite(event.temperature)
      ? event.temperature
      : 0.2;
  const timeoutMs =
    typeof event.timeoutMs === 'number' && event.timeoutMs > 0
      ? Math.min(event.timeoutMs, 120000)
      : 90000;

  if (!model || !messages || messages.length === 0) {
    return {
      ok: false,
      error: 'BAD_REQUEST',
      message: '需要传入 model 与 messages',
    };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, temperature, messages }),
      signal: ctrl.signal,
    });

    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* */
    }

    if (!res.ok) {
      return {
        ok: false,
        error: 'UPSTREAM_HTTP',
        status: res.status,
        body: json ?? text.slice(0, 2000),
      };
    }

    const content =
      json?.choices?.[0]?.message?.content ?? json?.choices?.[0]?.text ?? '';

    return {
      ok: true,
      content: typeof content === 'string' ? content : JSON.stringify(content),
      raw: json,
    };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    if (err.name === 'AbortError') {
      return {
        ok: false,
        error: 'TIMEOUT',
        message: `上游请求超时（${Math.round(timeoutMs / 1000)}s）`,
      };
    }
    return {
      ok: false,
      error: 'FETCH_FAILED',
      message: err.message,
    };
  } finally {
    clearTimeout(timer);
  }
};
