import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CloudAuthMethod } from './cloudbase';

const STORAGE_PREFS = 'stow.auth.loginPrefs';

export type AuthLoginPrefs = {
  lastMethod: CloudAuthMethod;
  phone: string;
  email: string;
  username: string;
  /** 仅本机记忆，便于退出后再一键账密登录 */
  password: string;
};

const DEFAULT_PREFS: AuthLoginPrefs = {
  lastMethod: 'phone',
  phone: '',
  email: '',
  username: '',
  password: '',
};

export async function loadAuthLoginPrefs(): Promise<AuthLoginPrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_PREFS);
    if (!raw?.trim()) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<AuthLoginPrefs>;
    const method = parsed.lastMethod;
    return {
      lastMethod:
        method === 'phone' || method === 'email' || method === 'password'
          ? method
          : 'phone',
      phone: typeof parsed.phone === 'string' ? parsed.phone : '',
      email: typeof parsed.email === 'string' ? parsed.email : '',
      username: typeof parsed.username === 'string' ? parsed.username : '',
      password: typeof parsed.password === 'string' ? parsed.password : '',
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export async function saveAuthLoginPrefs(
  patch: Partial<AuthLoginPrefs>
): Promise<AuthLoginPrefs> {
  const prev = await loadAuthLoginPrefs();
  const next: AuthLoginPrefs = { ...prev, ...patch };
  await AsyncStorage.setItem(STORAGE_PREFS, JSON.stringify(next));
  return next;
}
