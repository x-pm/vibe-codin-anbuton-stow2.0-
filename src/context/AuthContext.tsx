import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ensureCloudbaseLogin,
  getCloudAuthProfile,
  isCloudbaseConfigured,
  signOutCloudUser,
  type CloudAuthProfile,
} from '../services/cloudbase';
type AuthContextValue = {
  ready: boolean;
  configured: boolean;
  cloudUser: CloudAuthProfile | null;
  refreshCloudAuth: () => Promise<void>;
  signOutCloud: () => Promise<void>;
  /** 未登录时记下后续动作，登录成功后自动执行 */
  setPendingAction: (action: (() => void) | null) => void;
  consumePendingAction: () => (() => void) | null;
  clearPendingAction: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isCloudbaseConfigured();
  const [ready, setReady] = useState(false);
  const [cloudUser, setCloudUser] = useState<CloudAuthProfile | null>(null);
  const pendingRef = useRef<(() => void) | null>(null);

  const refreshCloudAuth = useCallback(async () => {
    if (!configured) {
      setCloudUser(null);
      setReady(true);
      return;
    }
    const profile = await getCloudAuthProfile();
    setCloudUser(profile);
    setReady(true);
  }, [configured]);

  const signOutCloud = useCallback(async () => {
    pendingRef.current = null;
    await signOutCloudUser();
    setCloudUser(null);
  }, []);

  const setPendingAction = useCallback((action: (() => void) | null) => {
    pendingRef.current = action;
  }, []);

  const consumePendingAction = useCallback(() => {
    const fn = pendingRef.current;
    pendingRef.current = null;
    return fn;
  }, []);

  const clearPendingAction = useCallback(() => {
    pendingRef.current = null;
  }, []);

  useEffect(() => {
    void refreshCloudAuth();
  }, [refreshCloudAuth]);

  const value = useMemo(
    () => ({
      ready,
      configured,
      cloudUser,
      refreshCloudAuth,
      signOutCloud,
      setPendingAction,
      consumePendingAction,
      clearPendingAction,
    }),
    [
      ready,
      configured,
      cloudUser,
      refreshCloudAuth,
      signOutCloud,
      setPendingAction,
      consumePendingAction,
      clearPendingAction,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/**
 * 使用录入等功能：正式账号或匿名会话均可。不弹登录窗。
 * 未登录时后台补一次匿名登录（AI 识别需要）；失败也不挡本机功能。
 */
export function useRequireCloudLogin() {
  const { cloudUser, configured } = useAuth();

  return useCallback(
    (action: () => void) => {
      action();
      if (configured && !cloudUser) {
        void ensureCloudbaseLogin().catch(() => {
          /* 本机录入不依赖云会话；识别时会再试 */
        });
      }
    },
    [cloudUser, configured]
  );
}
