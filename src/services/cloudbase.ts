import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';

/**
 * CloudBase 客户端（HTTP API）。
 * 不用 @cloudbase/adapter-rn：其依赖 react-native-mmkv，Expo Go 无法使用。
 */

const STORAGE_DEVICE = 'stow.cloudbase.deviceId';
const STORAGE_ACCESS = 'stow.cloudbase.accessToken';
const STORAGE_REFRESH = 'stow.cloudbase.refreshToken';
const STORAGE_EXPIRES = 'stow.cloudbase.accessExpiresAt';
const STORAGE_AUTH_KIND = 'stow.cloudbase.authKind';
const STORAGE_AUTH_PROFILE = 'stow.cloudbase.authProfile';

const DEFAULT_FUNCTION = 'stowyun';
const DEFAULT_SYNC_FUNCTION = 'stowSync';

export type AiProxyRequest = {
  model: string;
  messages: unknown[];
  temperature?: number;
  timeoutMs?: number;
};

export type AiProxyResult = {
  ok: boolean;
  content?: string;
  error?: string;
  message?: string;
  status?: number;
  body?: unknown;
  raw?: unknown;
};

export type CloudAuthKind = 'anonymous' | 'user';

export type CloudAuthMethod = 'phone' | 'email' | 'password';

export type CloudAuthProfile = {
  kind: CloudAuthKind;
  method?: CloudAuthMethod;
  /** 个人页展示用 */
  label: string;
  phone?: string;
  email?: string;
  username?: string;
  sub?: string;
};

type TokenPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  sub?: string;
};

function getEnvId(): string {
  return process.env.EXPO_PUBLIC_CLOUDBASE_ENV_ID?.trim() ?? '';
}

function getPublishableKey(): string {
  return (
    process.env.EXPO_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY?.trim() ||
    process.env.EXPO_PUBLIC_CLOUDBASE_ACCESS_KEY?.trim() ||
    ''
  );
}

function getFunctionName(): string {
  return process.env.EXPO_PUBLIC_CLOUDBASE_FUNCTION_NAME?.trim() || DEFAULT_FUNCTION;
}

function getSyncFunctionName(): string {
  return (
    process.env.EXPO_PUBLIC_CLOUDBASE_SYNC_FUNCTION?.trim() || DEFAULT_SYNC_FUNCTION
  );
}

function gatewayBase(envId: string): string {
  return `https://${envId}.api.tcloudbasegateway.com`;
}

/** 是否已配置云开发环境（可走云函数 AI） */
export function isCloudbaseConfigured(): boolean {
  return getEnvId().length > 0;
}

async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(STORAGE_DEVICE);
  if (existing?.trim()) return existing.trim();
  const id = `stow_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  await AsyncStorage.setItem(STORAGE_DEVICE, id);
  return id;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extra,
  };
  const pub = getPublishableKey();
  if (pub) headers.Authorization = `Bearer ${pub}`;
  return headers;
}

function parseJsonSafe(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function errorMessageFromBody(json: Record<string, unknown>, text: string, fallback: string): string {
  const desc =
    (typeof json.error_description === 'string' && json.error_description) ||
    (typeof json.message === 'string' && json.message) ||
    (typeof json.error === 'string' && json.error) ||
    '';
  if (desc) return desc;
  if (text.trim()) return text.slice(0, 240);
  return fallback;
}

async function readCachedAccessToken(): Promise<string | null> {
  const [token, expiresRaw] = await Promise.all([
    AsyncStorage.getItem(STORAGE_ACCESS),
    AsyncStorage.getItem(STORAGE_EXPIRES),
  ]);
  if (!token?.trim()) return null;
  const expiresAt = expiresRaw ? Number(expiresRaw) : 0;
  // 提前 60s 视为过期
  if (expiresAt && Date.now() > expiresAt - 60_000) return null;
  return token.trim();
}

async function saveTokens(payload: TokenPayload): Promise<string> {
  const access = payload.access_token?.trim();
  if (!access) throw new Error('登录未返回 access_token');
  const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : 7200;
  await AsyncStorage.multiSet([
    [STORAGE_ACCESS, access],
    [STORAGE_EXPIRES, String(Date.now() + expiresIn * 1000)],
    [STORAGE_REFRESH, payload.refresh_token?.trim() || ''],
  ]);
  return access;
}

async function saveAuthProfile(profile: CloudAuthProfile): Promise<void> {
  await AsyncStorage.multiSet([
    [STORAGE_AUTH_KIND, profile.kind],
    [STORAGE_AUTH_PROFILE, JSON.stringify(profile)],
  ]);
}

export async function getCloudAuthProfile(): Promise<CloudAuthProfile | null> {
  const [kind, raw] = await Promise.all([
    AsyncStorage.getItem(STORAGE_AUTH_KIND),
    AsyncStorage.getItem(STORAGE_AUTH_PROFILE),
  ]);
  if (kind !== 'user') return null;
  if (!raw?.trim()) {
    return { kind: 'user', label: '已登录云账号' };
  }
  try {
    const parsed = JSON.parse(raw) as CloudAuthProfile;
    return { ...parsed, kind: 'user' };
  } catch {
    return { kind: 'user', label: '已登录云账号' };
  }
}

export async function isCloudUserLoggedIn(): Promise<boolean> {
  const kind = await AsyncStorage.getItem(STORAGE_AUTH_KIND);
  return kind === 'user';
}

/** 国内手机号 → CloudBase 要求的 "+86 1xxxxxxxxxx" */
export function normalizeChinaPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return `+86 ${digits}`;
  if (digits.length === 13 && digits.startsWith('86')) return `+86 ${digits.slice(2)}`;
  return input.trim();
}

export function maskPhoneLabel(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^86/, '');
  if (digits.length === 11) return `${digits.slice(0, 3)}****${digits.slice(7)}`;
  return phone;
}

async function postAuthJson(
  path: string,
  body: Record<string, unknown>,
  opts?: { deviceId?: boolean }
): Promise<{ res: Response; json: Record<string, unknown>; text: string }> {
  const envId = getEnvId();
  if (!envId) {
    throw new Error('未配置 EXPO_PUBLIC_CLOUDBASE_ENV_ID，请在 .env 中填写云开发环境 ID。');
  }
  const headers = authHeaders();
  if (opts?.deviceId) {
    headers['x-device-id'] = await getOrCreateDeviceId();
  }
  const res = await fetch(`${gatewayBase(envId)}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const json = parseJsonSafe(text);
  return { res, json, text };
}

async function signInAnonymously(): Promise<string> {
  const { res, json, text } = await postAuthJson('/auth/v1/signin/anonymously', {}, { deviceId: true });
  if (!res.ok) {
    throw new Error(
      `云开发匿名登录失败（${res.status}）${text ? `: ${text.slice(0, 240)}` : ''}`
    );
  }
  const access = await saveTokens({
    access_token: typeof json.access_token === 'string' ? json.access_token : undefined,
    refresh_token: typeof json.refresh_token === 'string' ? json.refresh_token : undefined,
    expires_in: typeof json.expires_in === 'number' ? json.expires_in : undefined,
  });
  await saveAuthProfile({ kind: 'anonymous', label: '匿名会话' });
  return access;
}

async function tryRefreshAccessToken(): Promise<string | null> {
  const refresh = (await AsyncStorage.getItem(STORAGE_REFRESH))?.trim();
  if (!refresh) return null;
  const envId = getEnvId();
  try {
    const { res, json } = await postAuthJson(
      '/auth/v1/token',
      {
        grant_type: 'refresh_token',
        refresh_token: refresh,
        client_id: envId,
      },
      { deviceId: true }
    );
    if (!res.ok) return null;
    return saveTokens({
      access_token: typeof json.access_token === 'string' ? json.access_token : undefined,
      refresh_token:
        typeof json.refresh_token === 'string' ? json.refresh_token : refresh,
      expires_in: typeof json.expires_in === 'number' ? json.expires_in : undefined,
    });
  } catch {
    return null;
  }
}

let loginPromise: Promise<string> | null = null;

/**
 * 确保已登录（优先使用已保存的用户/匿名 token），返回 access_token。
 * AI 等能力：已登录云用户则用用户 token，否则匿名登录。
 */
export async function ensureCloudbaseLogin(): Promise<string> {
  const envId = getEnvId();
  if (!envId) {
    throw new Error('未配置 EXPO_PUBLIC_CLOUDBASE_ENV_ID，请在 .env 中填写云开发环境 ID。');
  }

  const cached = await readCachedAccessToken();
  if (cached) return cached;

  const refreshed = await tryRefreshAccessToken();
  if (refreshed) return refreshed;

  // 用户会话无法刷新时清掉标记，再走匿名（避免个人页仍显示已登录）
  const kind = await AsyncStorage.getItem(STORAGE_AUTH_KIND);
  if (kind === 'user') {
    await AsyncStorage.multiRemove([
      STORAGE_ACCESS,
      STORAGE_REFRESH,
      STORAGE_EXPIRES,
      STORAGE_AUTH_KIND,
      STORAGE_AUTH_PROFILE,
    ]);
  }

  if (loginPromise) return loginPromise;

  loginPromise = signInAnonymously().finally(() => {
    loginPromise = null;
  });

  return loginPromise;
}

export type SendVerificationResult = {
  verificationId: string;
  expiresIn: number;
  isUser?: boolean;
};

/** 发送手机 / 邮箱验证码（需在控制台开通对应登录方式） */
export async function sendVerificationCode(input: {
  phone?: string;
  email?: string;
  target?: 'ANY' | 'USER';
}): Promise<SendVerificationResult> {
  const phone = input.phone?.trim() ? normalizeChinaPhone(input.phone) : undefined;
  const email = input.email?.trim() || undefined;
  if (!phone && !email) throw new Error('请填写手机号或邮箱');
  if (phone && email) throw new Error('手机号与邮箱只能选一种');

  const body: Record<string, unknown> = {
    target: input.target ?? 'ANY',
  };
  if (phone) body.phone_number = phone;
  if (email) body.email = email;

  const { res, json, text } = await postAuthJson('/auth/v1/verification', body);
  if (!res.ok) {
    throw new Error(errorMessageFromBody(json, text, `发送验证码失败（${res.status}）`));
  }
  const verificationId =
    typeof json.verification_id === 'string' ? json.verification_id : '';
  if (!verificationId) throw new Error('发送成功但未返回 verification_id');
  return {
    verificationId,
    expiresIn: typeof json.expires_in === 'number' ? json.expires_in : 600,
    isUser: typeof json.is_user === 'boolean' ? json.is_user : undefined,
  };
}

export type VerifyCodeResult = {
  verificationToken: string;
  isUser?: boolean;
};

/** 校验验证码，拿到 verification_token */
export async function verifyVerificationCode(input: {
  verificationId: string;
  verificationCode: string;
}): Promise<VerifyCodeResult> {
  const code = input.verificationCode.trim();
  if (!code) throw new Error('请输入验证码');
  const { res, json, text } = await postAuthJson('/auth/v1/verification/verify', {
    verification_id: input.verificationId,
    verification_code: code,
  });
  if (!res.ok) {
    throw new Error(errorMessageFromBody(json, text, `验证码校验失败（${res.status}）`));
  }
  const verificationToken =
    typeof json.verification_token === 'string' ? json.verification_token : '';
  if (!verificationToken) throw new Error('校验成功但未返回 verification_token');
  return {
    verificationToken,
    isUser: typeof json.is_user === 'boolean' ? json.is_user : undefined,
  };
}

async function persistUserSession(
  tokens: TokenPayload,
  profile: Omit<CloudAuthProfile, 'kind'>
): Promise<CloudAuthProfile> {
  await saveTokens(tokens);
  const full: CloudAuthProfile = {
    kind: 'user',
    ...profile,
    sub: profile.sub || (typeof tokens.sub === 'string' ? tokens.sub : undefined),
  };
  await saveAuthProfile(full);
  return full;
}

function tokensFromJson(json: Record<string, unknown>): TokenPayload {
  return {
    access_token: typeof json.access_token === 'string' ? json.access_token : undefined,
    refresh_token: typeof json.refresh_token === 'string' ? json.refresh_token : undefined,
    expires_in: typeof json.expires_in === 'number' ? json.expires_in : undefined,
    sub: typeof json.sub === 'string' ? json.sub : undefined,
  };
}

/** 用户名 + 密码登录（控制台需开通「用户名密码」） */
export async function signInWithPassword(input: {
  username: string;
  password: string;
}): Promise<CloudAuthProfile> {
  const username = input.username.trim();
  const password = input.password;
  if (!username || !password) throw new Error('请填写用户名和密码');

  const { res, json, text } = await postAuthJson('/auth/v1/signin', {
    username,
    password,
  });
  if (!res.ok) {
    throw new Error(errorMessageFromBody(json, text, `账密登录失败（${res.status}）`));
  }
  return persistUserSession(tokensFromJson(json), {
    method: 'password',
    label: username,
    username,
  });
}

/**
 * 账密注册：云开发不支持「仅用户名+密码」注册，须用邮箱验证码。
 * 注册成功后不保留会话，回到登录页用邮箱作为账号再登录。
 */
export async function signUpWithEmailPassword(input: {
  email: string;
  password: string;
  verificationToken: string;
}): Promise<void> {
  const email = input.email.trim();
  const password = input.password;
  const token = input.verificationToken.trim();
  if (!email) throw new Error('请填写账号（邮箱）');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('账号请使用邮箱地址，以便完成注册验证');
  }
  if (!password || password.length < 6) throw new Error('密码至少 6 位');
  if (!token) throw new Error('请先获取并填写验证码');

  const { res, json, text } = await postAuthJson('/auth/v1/signup', {
    email,
    password,
    verification_token: token,
  });
  if (!res.ok) {
    throw new Error(errorMessageFromBody(json, text, `注册失败（${res.status}）`));
  }
  // 不保留注册返回的会话，回到登录页让用户再输密码
  await AsyncStorage.multiRemove([
    STORAGE_ACCESS,
    STORAGE_REFRESH,
    STORAGE_EXPIRES,
    STORAGE_AUTH_KIND,
    STORAGE_AUTH_PROFILE,
  ]);
}

/**
 * 手机 / 邮箱验证码登录；若账号不存在则自动注册（与控制台「在线体验」一致）。
 */
export async function signInOrSignUpWithVerification(input: {
  method: 'phone' | 'email';
  phone?: string;
  email?: string;
  verificationToken: string;
  /** 发送验证码时返回的 is_user；未知则先登录再注册 */
  isUser?: boolean;
}): Promise<CloudAuthProfile> {
  const token = input.verificationToken.trim();
  if (!token) throw new Error('缺少 verification_token');

  const phone = input.phone?.trim() ? normalizeChinaPhone(input.phone) : undefined;
  const email = input.email?.trim() || undefined;

  const trySignIn = async () => {
    const { res, json, text } = await postAuthJson('/auth/v1/signin', {
      verification_token: token,
    });
    if (!res.ok) {
      throw new Error(errorMessageFromBody(json, text, `验证码登录失败（${res.status}）`));
    }
    return tokensFromJson(json);
  };

  const trySignUp = async () => {
    const body: Record<string, unknown> = { verification_token: token };
    if (input.method === 'phone') {
      if (!phone) throw new Error('请填写手机号');
      body.phone_number = phone;
    } else {
      if (!email) throw new Error('请填写邮箱');
      body.email = email;
    }
    const { res, json, text } = await postAuthJson('/auth/v1/signup', body);
    if (!res.ok) {
      throw new Error(errorMessageFromBody(json, text, `注册失败（${res.status}）`));
    }
    return tokensFromJson(json);
  };

  let tokens: TokenPayload;
  if (input.isUser === false) {
    tokens = await trySignUp();
  } else if (input.isUser === true) {
    tokens = await trySignIn();
  } else {
    try {
      tokens = await trySignIn();
    } catch {
      tokens = await trySignUp();
    }
  }

  if (input.method === 'phone') {
    const label = phone ? maskPhoneLabel(phone) : '手机号用户';
    return persistUserSession(tokens, {
      method: 'phone',
      label,
      phone,
    });
  }
  return persistUserSession(tokens, {
    method: 'email',
    label: email || '邮箱用户',
    email,
  });
}

/** 退出云用户会话；下次 AI 会重新匿名登录。不清除本机物品数据。 */
export async function signOutCloudUser(): Promise<void> {
  await AsyncStorage.multiRemove([
    STORAGE_ACCESS,
    STORAGE_REFRESH,
    STORAGE_EXPIRES,
    STORAGE_AUTH_KIND,
    STORAGE_AUTH_PROFILE,
  ]);
}

/** 注销 CloudBase 登录账号（App Store 5.1.1(v)）。须在清除本地 token 之前调用。 */
export async function deleteCloudAuthUser(): Promise<void> {
  const envId = getEnvId();
  if (!envId) {
    throw new Error('未配置 EXPO_PUBLIC_CLOUDBASE_ENV_ID');
  }
  const accessToken = await requireCloudUserAccessToken();
  const res = await fetch(`${gatewayBase(envId)}/auth/v1/user`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (res.ok || res.status === 404) return;
  const text = await res.text();
  throw new Error(`注销登录账号失败（${res.status}）${text ? `: ${text.slice(0, 200)}` : ''}`);
}

/**
 * 调用 AI 代理云函数（默认名 stowyun）。
 */
export async function callAiProxy(data: AiProxyRequest): Promise<AiProxyResult> {
  const envId = getEnvId();
  if (!envId) {
    throw new Error('未配置 EXPO_PUBLIC_CLOUDBASE_ENV_ID');
  }
  const accessToken = await ensureCloudbaseLogin();
  const name = encodeURIComponent(getFunctionName());
  const res = await fetch(`${gatewayBase(envId)}/v1/functions/${name}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(data),
  });

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    return {
      ok: false,
      error: 'HTTP_ERROR',
      status: res.status,
      message: typeof parsed === 'string' ? parsed.slice(0, 280) : JSON.stringify(parsed).slice(0, 280),
      body: parsed,
    };
  }

  // 网关可能包一层 { result: {...} } 或直接返回函数结果
  const result =
    parsed &&
    typeof parsed === 'object' &&
    parsed !== null &&
    'result' in parsed &&
    (parsed as { result: unknown }).result != null
      ? (parsed as { result: unknown }).result
      : parsed;

  if (result && typeof result === 'object' && result !== null && 'ok' in result) {
    return result as AiProxyResult;
  }

  return {
    ok: false,
    error: 'BAD_RESPONSE',
    message: '云函数返回格式异常',
    body: parsed,
  };
}

function unwrapFunctionResult(parsed: unknown): unknown {
  if (
    parsed &&
    typeof parsed === 'object' &&
    parsed !== null &&
    'result' in parsed &&
    (parsed as { result: unknown }).result != null
  ) {
    return (parsed as { result: unknown }).result;
  }
  return parsed;
}

/** 仅云用户（非匿名）可用的 access_token */
export async function requireCloudUserAccessToken(): Promise<string> {
  if (!(await isCloudUserLoggedIn())) {
    throw new Error('请先登录云账号后再同步数据');
  }
  const token = await readCachedAccessToken();
  if (token) return token;
  // 尝试 refresh；仍须保持 user kind
  const refreshed = await tryRefreshAccessToken();
  if (refreshed && (await isCloudUserLoggedIn())) return refreshed;
  throw new Error('登录已过期，请重新登录后再同步');
}

export type StowSyncPullResult = {
  ok: boolean;
  empty?: boolean;
  snapshot?: unknown;
  updatedAt?: number;
  error?: string;
  message?: string;
};

export type StowSyncPushResult = {
  ok: boolean;
  updatedAt?: number;
  error?: string;
  message?: string;
};

/**
 * 调用业务数据同步云函数（默认名 stowSync）。
 */
export async function callStowSync(input: {
  action: 'pull' | 'push' | 'deleteAccount';
  snapshot?: unknown;
  updatedAt?: number;
}): Promise<StowSyncPullResult & StowSyncPushResult> {
  const envId = getEnvId();
  if (!envId) {
    throw new Error('未配置 EXPO_PUBLIC_CLOUDBASE_ENV_ID');
  }
  const accessToken = await requireCloudUserAccessToken();
  const name = encodeURIComponent(getSyncFunctionName());
  const res = await fetch(`${gatewayBase(envId)}/v1/functions/${name}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    return {
      ok: false,
      error: 'HTTP_ERROR',
      message:
        typeof parsed === 'string'
          ? parsed.slice(0, 280)
          : JSON.stringify(parsed).slice(0, 280),
    };
  }

  const result = unwrapFunctionResult(parsed);
  if (result && typeof result === 'object' && result !== null && 'ok' in result) {
    return result as StowSyncPullResult & StowSyncPushResult;
  }

  return {
    ok: false,
    error: 'BAD_RESPONSE',
    message: '同步云函数返回格式异常',
  };
}

export type StowUploadResult = {
  objectId: string;
  downloadUrl: string;
  cloudObjectId?: string;
};

/**
 * 上传本地文件到云存储（需已登录云用户）。
 * objectId 例：stow/{uid}/items/{itemId}.jpg
 */
export async function uploadStowObject(input: {
  objectId: string;
  localUri: string;
}): Promise<StowUploadResult> {
  const envId = getEnvId();
  if (!envId) throw new Error('未配置 EXPO_PUBLIC_CLOUDBASE_ENV_ID');
  const accessToken = await requireCloudUserAccessToken();
  const objectId = input.objectId.replace(/^\/+/, '');

  const infoRes = await fetch(
    `${gatewayBase(envId)}/v1/storages/get-objects-upload-info`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify([{ objectId }]),
    }
  );
  const infoText = await infoRes.text();
  let infoJson: unknown = null;
  try {
    infoJson = JSON.parse(infoText);
  } catch {
    infoJson = infoText;
  }
  if (!infoRes.ok) {
    throw new Error(
      `获取上传凭证失败（${infoRes.status}）：${infoText.slice(0, 200)}`
    );
  }

  const row = Array.isArray(infoJson) ? infoJson[0] : null;
  if (!row || typeof row !== 'object' || row === null) {
    throw new Error('上传凭证响应异常');
  }
  const info = row as Record<string, unknown>;
  if (typeof info.code === 'string') {
    throw new Error(
      typeof info.message === 'string' ? info.message : `上传凭证错误：${info.code}`
    );
  }

  const uploadUrl = typeof info.uploadUrl === 'string' ? info.uploadUrl : '';
  const authorization = typeof info.authorization === 'string' ? info.authorization : '';
  const token = typeof info.token === 'string' ? info.token : '';
  const cloudObjectMeta =
    typeof info.cloudObjectMeta === 'string' ? info.cloudObjectMeta : '';
  const downloadUrl =
    (typeof info.downloadUrlEncoded === 'string' && info.downloadUrlEncoded) ||
    (typeof info.downloadUrl === 'string' && info.downloadUrl) ||
    '';
  const cloudObjectId =
    typeof info.cloudObjectId === 'string' ? info.cloudObjectId : undefined;

  if (!uploadUrl || !authorization || !downloadUrl) {
    throw new Error('上传凭证缺少 uploadUrl / authorization / downloadUrl');
  }

  const fileRes = await fetch(input.localUri);
  if (!fileRes.ok) {
    throw new Error(`读取本地图片失败（${fileRes.status}）`);
  }
  const blob = await fileRes.blob();

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: authorization,
      'X-Cos-Security-Token': token,
      'X-Cos-Meta-Fileid': cloudObjectMeta,
      'Content-Type': blob.type || 'application/octet-stream',
    },
    body: blob,
  });
  if (!putRes.ok) {
    const putText = await putRes.text().catch(() => '');
    throw new Error(
      `云存储上传失败（${putRes.status}）${putText ? `: ${putText.slice(0, 160)}` : ''}`
    );
  }

  return { objectId, downloadUrl, cloudObjectId };
}

/** 云存储对象路径用的用户 id（优先登录返回的 sub） */
export async function getCloudStorageUserId(): Promise<string> {
  const profile = await getCloudAuthProfile();
  if (profile?.sub?.trim()) return profile.sub.trim();
  if (profile?.phone?.trim()) {
    return normalizeChinaPhone(profile.phone).replace(/\s+/g, '');
  }
  if (profile?.email?.trim()) return profile.email.trim().toLowerCase();
  if (profile?.username?.trim()) return profile.username.trim().toLowerCase();
  throw new Error('无法解析云用户 ID，请重新登录');
}

