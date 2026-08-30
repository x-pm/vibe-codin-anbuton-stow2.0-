/**
 * CloudBase 云函数：本机工作区快照同步（物品 / 计划 / 资料）
 * 控制台函数名建议：stowSync
 * 集合：stow_snapshots（文档 _id = 登录用户 uid）
 *
 * 依赖：@cloudbase/node-sdk（部署时安装）
 */

const cloud = require('@cloudbase/node-sdk');

const COLLECTION = 'stow_snapshots';

function resolveUserId(event, context) {
  const bag = [
    context?.EXTENDED_CONTEXT?.userInfo?.uid,
    context?.EXTENDED_CONTEXT?.userInfo?.openId,
    context?.userInfo?.uid,
    context?.userInfo?.openId,
    context?.auth?.uid,
    context?.auth?.openId,
    event?.userInfo?.uid,
    event?.userInfo?.openId,
    process.env.TCB_UUID,
    process.env.WX_OPENID,
    process.env.TCB_OPENID,
  ];
  for (const v of bag) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  try {
    const envCtx = process.env.TCB_CONTEXT || process.env.CLOUDBASE_CONTEXT;
    if (envCtx) {
      const j = JSON.parse(envCtx);
      const id = j?.userInfo?.uid || j?.userInfo?.openId || j?.uid || j?.openId;
      if (typeof id === 'string' && id.trim()) return id.trim();
    }
  } catch {
    /* */
  }
  return '';
}

function resolveLoginType(event, context) {
  const bag = [
    context?.EXTENDED_CONTEXT?.userInfo?.loginType,
    context?.userInfo?.loginType,
    context?.auth?.loginType,
    event?.userInfo?.loginType,
  ];
  for (const v of bag) {
    if (typeof v === 'string' && v.trim()) return v.trim().toUpperCase();
  }
  try {
    const envCtx = process.env.TCB_CONTEXT || process.env.CLOUDBASE_CONTEXT;
    if (envCtx) {
      const j = JSON.parse(envCtx);
      const t = j?.userInfo?.loginType || j?.loginType;
      if (typeof t === 'string' && t.trim()) return t.trim().toUpperCase();
    }
  } catch {
    /* */
  }
  return '';
}

function isAnonymousLogin(loginType) {
  return loginType === 'ANONYMOUS' || loginType === 'ANONYMOUSLY';
}

function isValidSnapshot(snap) {
  if (!snap || typeof snap !== 'object') return false;
  if (snap.v !== 1) return false;
  if (!Array.isArray(snap.items) || !Array.isArray(snap.plans) || !Array.isArray(snap.groups)) {
    return false;
  }
  return true;
}

exports.main = async (event, context) => {
  const uid = resolveUserId(event, context);
  if (!uid) {
    return {
      ok: false,
      error: 'UNAUTHORIZED',
      message: '请先用手机号 / 邮箱 / 账密登录后再同步',
    };
  }

  const loginType = resolveLoginType(event, context);
  if (isAnonymousLogin(loginType)) {
    return {
      ok: false,
      error: 'ANONYMOUS_NOT_ALLOWED',
      message: '匿名登录不能同步业务数据，请先登录账号',
    };
  }

  const action = typeof event.action === 'string' ? event.action.trim() : '';
  if (action !== 'pull' && action !== 'push' && action !== 'deleteAccount') {
    return {
      ok: false,
      error: 'BAD_REQUEST',
      message: 'action 须为 pull、push 或 deleteAccount',
    };
  }

  const app = cloud.init({ env: cloud.SYMBOL_CURRENT_ENV });
  const db = app.database();
  const col = db.collection(COLLECTION);

  try {
    if (action === 'deleteAccount') {
      try {
        await col.doc(uid).remove();
      } catch (removeErr) {
        void removeErr;
      }
      return { ok: true, deleted: true };
    }

    if (action === 'pull') {
      const res = await col.doc(uid).get();
      const data = Array.isArray(res.data) ? res.data[0] : res.data;
      if (!data || !data.snapshot) {
        return { ok: true, empty: true };
      }
      return {
        ok: true,
        empty: false,
        updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
        snapshot: data.snapshot,
      };
    }

    // push
    if (!isValidSnapshot(event.snapshot)) {
      return {
        ok: false,
        error: 'BAD_SNAPSHOT',
        message: 'snapshot 格式无效（需 v:1 且含 items/plans/groups）',
      };
    }

    const updatedAt =
      typeof event.updatedAt === 'number' && Number.isFinite(event.updatedAt)
        ? event.updatedAt
        : Date.now();

    const doc = {
      updatedAt,
      snapshot: event.snapshot,
    };

    const existing = await col.doc(uid).get();
    const existingData = Array.isArray(existing.data) ? existing.data[0] : existing.data;
    if (existingData) {
      await col.doc(uid).update(doc);
    } else {
      try {
        await col.doc(uid).set(doc);
      } catch {
        await col.add({ _id: uid, ...doc });
      }
    }

    return { ok: true, updatedAt };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    return {
      ok: false,
      error: 'DB_FAILED',
      message: err.message,
    };
  }
};
