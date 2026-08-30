import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SpringPressable } from '../components/SpringPressable';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { loadAuthLoginPrefs, saveAuthLoginPrefs } from '../services/authPrefs';
import {
  isCloudbaseConfigured,
  maskPhoneLabel,
  sendVerificationCode,
  signInOrSignUpWithVerification,
  signInWithPassword,
  signUpWithEmailPassword,
  type CloudAuthMethod,
  verifyVerificationCode,
} from '../services/cloudbase';
import { playNavTap, playSaveSuccess } from '../services/sfx';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { radius } from '../theme/radius';
import { doneReturnKeyProps } from '../utils/inputKeyboard';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'AuthLogin'>;

const METHODS: Array<{
  key: CloudAuthMethod;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'phone', title: '手机号登录', icon: 'phone-portrait-outline' },
  { key: 'email', title: '邮箱登录', icon: 'mail-outline' },
  { key: 'password', title: '账密登录', icon: 'key-outline' },
];

const FADE_OUT_MS = 160;
const FADE_IN_MS = 220;
const fadeEasing = Easing.out(Easing.cubic);

export function AuthLoginScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const fromLogout = Boolean(route.params?.fromLogout);
  const { refreshCloudAuth, consumePendingAction, clearPendingAction } = useAuth();

  const [prefsReady, setPrefsReady] = useState(false);
  /** null = 方式列表弹窗；有值 = 该方式的表单弹窗 */
  const [formMethod, setFormMethod] = useState<CloudAuthMethod | null>(null);
  /** 账密：登录 / 注册 */
  const [passwordMode, setPasswordMode] = useState<'login' | 'register'>('login');
  const [lastMethod, setLastMethod] = useState<CloudAuthMethod>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [isUserHint, setIsUserHint] = useState<boolean | undefined>(undefined);
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const panelAnimating = useRef(false);
  const overlayOp = useRef(new Animated.Value(0)).current;
  const panelOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void (async () => {
      const prefs = await loadAuthLoginPrefs();
      setLastMethod(prefs.lastMethod);
      setPhone(prefs.phone);
      setEmail(prefs.email);
      setUsername(prefs.username);
      setPassword(prefs.password);
      setPrefsReady(true);
    })();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(overlayOp, {
        toValue: 1,
        duration: FADE_IN_MS,
        easing: fadeEasing,
        useNativeDriver: true,
      }),
      Animated.timing(panelOp, {
        toValue: 1,
        duration: FADE_IN_MS,
        easing: fadeEasing,
        useNativeDriver: true,
      }),
    ]).start();
  }, [overlayOp, panelOp]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const crossfadePanel = useCallback(
    (apply: () => void) => {
      if (panelAnimating.current) return;
      panelAnimating.current = true;
      Animated.timing(panelOp, {
        toValue: 0,
        duration: FADE_OUT_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) {
          panelAnimating.current = false;
          return;
        }
        apply();
        Animated.timing(panelOp, {
          toValue: 1,
          duration: FADE_IN_MS,
          easing: fadeEasing,
          useNativeDriver: true,
        }).start(() => {
          panelAnimating.current = false;
        });
      });
    },
    [panelOp]
  );

  const dismissAll = useCallback(() => {
    if (panelAnimating.current) return;
    playNavTap();
    panelAnimating.current = true;
    Animated.parallel([
      Animated.timing(overlayOp, {
        toValue: 0,
        duration: FADE_OUT_MS + 40,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(panelOp, {
        toValue: 0,
        duration: FADE_OUT_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      panelAnimating.current = false;
      if (!finished) return;
      clearPendingAction();
      navigation.goBack();
    });
  }, [clearPendingAction, navigation, overlayOp, panelOp]);

  const backToMethods = useCallback(() => {
    playNavTap();
    crossfadePanel(() => {
      setFormMethod(null);
      setPasswordMode('login');
      setCode('');
      setConfirmPassword('');
      setVerificationId(null);
      setIsUserHint(undefined);
    });
  }, [crossfadePanel]);

  const openPasswordRegister = useCallback(() => {
    playNavTap();
    crossfadePanel(() => {
      setPasswordMode('register');
      setPassword('');
      setConfirmPassword('');
      setCode('');
      setVerificationId(null);
      setIsUserHint(undefined);
    });
  }, [crossfadePanel]);

  const backToPasswordLogin = useCallback(
    (account?: string) => {
      playNavTap();
      crossfadePanel(() => {
        setPasswordMode('login');
        if (account?.trim()) setUsername(account.trim());
        setPassword('');
        setConfirmPassword('');
        setCode('');
        setVerificationId(null);
        setIsUserHint(undefined);
      });
    },
    [crossfadePanel]
  );

  const onBackdropPress = useCallback(() => {
    if (formMethod === 'password' && passwordMode === 'register') {
      backToPasswordLogin();
      return;
    }
    if (formMethod) {
      backToMethods();
      return;
    }
    dismissAll();
  }, [backToMethods, backToPasswordLogin, dismissAll, formMethod, passwordMode]);

  const finishLogin = useCallback(async () => {
    await refreshCloudAuth();
    playSaveSuccess();
    const pending = consumePendingAction();
    panelAnimating.current = true;
    Animated.parallel([
      Animated.timing(overlayOp, {
        toValue: 0,
        duration: FADE_OUT_MS + 40,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(panelOp, {
        toValue: 0,
        duration: FADE_OUT_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      panelAnimating.current = false;
      if (!finished) return;
      navigation.goBack();
      if (pending) {
        setTimeout(() => pending(), 80);
      }
    });
  }, [consumePendingAction, navigation, overlayOp, panelOp, refreshCloudAuth]);

  const startCountdown = useCallback((seconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(seconds);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const openMethod = useCallback(
    (method: CloudAuthMethod) => {
      playNavTap();
      crossfadePanel(() => {
        setFormMethod(method);
        setPasswordMode('login');
        setLastMethod(method);
        setCode('');
        setConfirmPassword('');
        setVerificationId(null);
        setIsUserHint(undefined);
      });
      void saveAuthLoginPrefs({ lastMethod: method });
    },
    [crossfadePanel]
  );

  const onSendCode = useCallback(async () => {
    if (!isCloudbaseConfigured()) {
      Alert.alert('未配置', '请先在 .env 填写 EXPO_PUBLIC_CLOUDBASE_ENV_ID。');
      return;
    }
    if (!formMethod) return;
    if (countdown > 0 || sending) return;

    const registerEmail =
      formMethod === 'password' && passwordMode === 'register' ? username.trim() : '';
    const targetEmail =
      formMethod === 'email' ? email : formMethod === 'password' ? registerEmail : '';
    const targetPhone = formMethod === 'phone' ? phone : '';

    if (formMethod === 'password' && passwordMode !== 'register') return;
    if (formMethod === 'password' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerEmail)) {
      Alert.alert('提示', '注册账号请填写邮箱地址，以便接收验证码。');
      return;
    }

    try {
      setSending(true);
      playNavTap();
      const result = targetPhone
        ? await sendVerificationCode({ phone: targetPhone, target: 'ANY' })
        : await sendVerificationCode({ email: targetEmail, target: 'ANY' });
      setVerificationId(result.verificationId);
      setIsUserHint(result.isUser);
      startCountdown(Math.min(60, result.expiresIn || 60));
      if (formMethod === 'phone') {
        await saveAuthLoginPrefs({ lastMethod: 'phone', phone: phone.trim() });
      } else if (formMethod === 'email') {
        await saveAuthLoginPrefs({ lastMethod: 'email', email: email.trim() });
      }
    } catch (e) {
      Alert.alert('发送失败', e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }, [
    countdown,
    email,
    formMethod,
    passwordMode,
    phone,
    sending,
    startCountdown,
    username,
  ]);

  const onSubmitCodeLogin = useCallback(async () => {
    if (!formMethod || formMethod === 'password') return;
    if (!verificationId) {
      Alert.alert('提示', '请先获取验证码。');
      return;
    }
    if (!code.trim()) {
      Alert.alert('提示', '请输入验证码。');
      return;
    }
    try {
      setBusy(true);
      const verified = await verifyVerificationCode({
        verificationId,
        verificationCode: code,
      });
      await signInOrSignUpWithVerification({
        method: formMethod,
        phone: formMethod === 'phone' ? phone : undefined,
        email: formMethod === 'email' ? email : undefined,
        verificationToken: verified.verificationToken,
        isUser: verified.isUser ?? isUserHint,
      });
      if (formMethod === 'phone') {
        await saveAuthLoginPrefs({ lastMethod: 'phone', phone: phone.trim() });
      } else {
        await saveAuthLoginPrefs({ lastMethod: 'email', email: email.trim() });
      }
      await finishLogin();
    } catch (e) {
      Alert.alert('登录失败', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [code, email, finishLogin, formMethod, isUserHint, phone, verificationId]);

  const onSubmitPassword = useCallback(async () => {
    try {
      setBusy(true);
      await signInWithPassword({ username, password });
      await saveAuthLoginPrefs({
        lastMethod: 'password',
        username: username.trim(),
        password,
      });
      await finishLogin();
    } catch (e) {
      Alert.alert('登录失败', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [finishLogin, password, username]);

  const onSubmitRegister = useCallback(async () => {
    const account = username.trim();
    if (!account) {
      Alert.alert('提示', '请填写账号（邮箱）。');
      return;
    }
    if (!password) {
      Alert.alert('提示', '请填写密码。');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('提示', '两次输入的密码不一致。');
      return;
    }
    if (!verificationId) {
      Alert.alert('提示', '请先获取验证码。');
      return;
    }
    if (!code.trim()) {
      Alert.alert('提示', '请输入验证码。');
      return;
    }
    try {
      setBusy(true);
      const verified = await verifyVerificationCode({
        verificationId,
        verificationCode: code,
      });
      await signUpWithEmailPassword({
        email: account,
        password,
        verificationToken: verified.verificationToken,
      });
      await saveAuthLoginPrefs({
        lastMethod: 'password',
        username: account,
        password: '',
      });
      Alert.alert('注册成功', '请再次输入密码登录。', [
        {
          text: '好的',
          onPress: () => backToPasswordLogin(account),
        },
      ]);
    } catch (e) {
      Alert.alert('注册失败', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [backToPasswordLogin, code, confirmPassword, password, username, verificationId]);

  const rememberedHint = (method: CloudAuthMethod): string | null => {
    if (method === 'phone' && phone.trim()) return maskPhoneLabel(phone);
    if (method === 'email' && email.trim()) return email.trim();
    if (method === 'password' && username.trim()) return username.trim();
    return null;
  };

  const formTitle =
    formMethod === 'phone'
      ? '手机号登录'
      : formMethod === 'email'
        ? '邮箱登录'
        : formMethod === 'password'
          ? passwordMode === 'register'
            ? '注册账号'
            : '账密登录'
          : '';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.View style={[styles.overlay, { opacity: overlayOp }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onBackdropPress} />
        <Animated.View
          style={[styles.card, { opacity: panelOp }]}
          onStartShouldSetResponder={() => true}
        >
          {!formMethod ? (
            <>
              <Text style={styles.title}>登录提醒</Text>
              {!fromLogout ? (
                <Text style={styles.lead}>
                  登录后可将物品与计划同步到云端。也可点空白处关闭，先以访客身份使用本机功能。
                </Text>
              ) : (
                <View style={{ height: 14 }} />
              )}

              {!prefsReady ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
              ) : (
                <View style={styles.methodList}>
                  {METHODS.map((item, idx) => {
                    const hint = rememberedHint(item.key);
                    const isLast = idx === METHODS.length - 1;
                    const preferred = item.key === lastMethod;
                    return (
                      <SpringPressable
                        key={item.key}
                        style={[styles.methodRow, !isLast && styles.methodRowBorder]}
                        onPress={() => openMethod(item.key)}
                        shrink={0.99}
                      >
                        <View style={[styles.methodIcon, preferred && styles.methodIconPreferred]}>
                          <Ionicons name={item.icon} size={20} color={colors.onPrimary} />
                        </View>
                        <View style={styles.methodTextCol}>
                          <Text style={styles.methodTitle}>{item.title}</Text>
                          {hint ? (
                            <Text style={styles.methodHint}>上次：{hint}</Text>
                          ) : preferred ? (
                            <Text style={styles.methodHint}>上次使用</Text>
                          ) : null}
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.modalCardMuted} />
                      </SpringPressable>
                    );
                  })}
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.formHeader}>
                <SpringPressable
                  style={styles.formBackBtn}
                  onPress={() => {
                    if (formMethod === 'password' && passwordMode === 'register') {
                      backToPasswordLogin();
                      return;
                    }
                    backToMethods();
                  }}
                  shrink={0.92}
                >
                  <Ionicons name="chevron-back" size={22} color={colors.modalCardText} />
                </SpringPressable>
                <Text style={styles.formTitle}>{formTitle}</Text>
                <View style={styles.formBackBtn} />
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {formMethod === 'password' ? (
                  <View>
                    <Text style={styles.label}>
                      {passwordMode === 'register' ? '账号（邮箱）' : '用户名'}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType={
                        passwordMode === 'register' ? 'email-address' : 'default'
                      }
                      placeholder={
                        passwordMode === 'register' ? 'name@example.com' : '用户名'
                      }
                      placeholderTextColor={colors.modalCardMuted}
                      {...doneReturnKeyProps}
                    />
                    <Text style={styles.label}>密码</Text>
                    <TextInput
                      style={styles.input}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      autoCapitalize="none"
                      placeholder="密码"
                      placeholderTextColor={colors.modalCardMuted}
                      {...doneReturnKeyProps}
                    />
                    {passwordMode === 'register' ? (
                      <>
                        <Text style={styles.label}>再次确认密码</Text>
                        <TextInput
                          style={styles.input}
                          value={confirmPassword}
                          onChangeText={setConfirmPassword}
                          secureTextEntry
                          autoCapitalize="none"
                          placeholder="再次输入密码"
                          placeholderTextColor={colors.modalCardMuted}
                          {...doneReturnKeyProps}
                        />
                        <Text style={styles.label}>验证码</Text>
                        <View style={styles.codeRow}>
                          <TextInput
                            style={[styles.input, styles.codeInput]}
                            value={code}
                            onChangeText={setCode}
                            keyboardType="number-pad"
                            maxLength={8}
                            placeholder="6 位验证码"
                            placeholderTextColor={colors.modalCardMuted}
                            {...doneReturnKeyProps}
                          />
                          <SpringPressable
                            style={[
                              styles.codeBtn,
                              (countdown > 0 || sending) && styles.btnDisabled,
                            ]}
                            onPress={() => {
                              if (!(countdown > 0 || sending)) void onSendCode();
                            }}
                            shrink={0.97}
                          >
                            {sending ? (
                              <ActivityIndicator color={colors.onPrimary} />
                            ) : (
                              <Text style={styles.codeBtnText}>
                                {countdown > 0 ? `${countdown}s` : '获取验证码'}
                              </Text>
                            )}
                          </SpringPressable>
                        </View>
                        <Text style={styles.registerHint}>
                          云开发需邮箱验证码完成注册；注册成功后可用该邮箱作为账密登录账号。
                        </Text>
                        <SpringPressable
                          style={[styles.primaryBtn, busy && styles.btnDisabled]}
                          onPress={() => {
                            if (!busy) void onSubmitRegister();
                          }}
                          shrink={0.98}
                        >
                          {busy ? (
                            <ActivityIndicator color={colors.onPrimary} />
                          ) : (
                            <Text style={styles.primaryBtnText}>注册</Text>
                          )}
                        </SpringPressable>
                        <Pressable
                          style={styles.registerLinkWrap}
                          onPress={() => backToPasswordLogin()}
                        >
                          <Text style={styles.registerLink}>已有账号？返回登录</Text>
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <SpringPressable
                          style={[styles.primaryBtn, busy && styles.btnDisabled]}
                          onPress={() => {
                            if (!busy) void onSubmitPassword();
                          }}
                          shrink={0.98}
                        >
                          {busy ? (
                            <ActivityIndicator color={colors.onPrimary} />
                          ) : (
                            <Text style={styles.primaryBtnText}>登录</Text>
                          )}
                        </SpringPressable>
                        <Pressable style={styles.registerLinkWrap} onPress={openPasswordRegister}>
                          <Text style={styles.registerLink}>没有账号？立即注册 »</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                ) : (
                  <View>
                    {formMethod === 'phone' ? (
                      <>
                        <Text style={styles.label}>手机号</Text>
                        <TextInput
                          style={styles.input}
                          value={phone}
                          onChangeText={setPhone}
                          keyboardType="phone-pad"
                          placeholder="11 位手机号"
                          placeholderTextColor={colors.modalCardMuted}
                          {...doneReturnKeyProps}
                        />
                      </>
                    ) : (
                      <>
                        <Text style={styles.label}>邮箱</Text>
                        <TextInput
                          style={styles.input}
                          value={email}
                          onChangeText={setEmail}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          placeholder="name@example.com"
                          placeholderTextColor={colors.modalCardMuted}
                          {...doneReturnKeyProps}
                        />
                      </>
                    )}

                    <Text style={styles.label}>验证码</Text>
                    <View style={styles.codeRow}>
                      <TextInput
                        style={[styles.input, styles.codeInput]}
                        value={code}
                        onChangeText={setCode}
                        keyboardType="number-pad"
                        maxLength={8}
                        placeholder="6 位验证码"
                        placeholderTextColor={colors.modalCardMuted}
                        {...doneReturnKeyProps}
                      />
                      <SpringPressable
                        style={[
                          styles.codeBtn,
                          (countdown > 0 || sending) && styles.btnDisabled,
                        ]}
                        onPress={() => {
                          if (!(countdown > 0 || sending)) void onSendCode();
                        }}
                        shrink={0.97}
                      >
                        {sending ? (
                          <ActivityIndicator color={colors.onPrimary} />
                        ) : (
                          <Text style={styles.codeBtnText}>
                            {countdown > 0 ? `${countdown}s` : '获取验证码'}
                          </Text>
                        )}
                      </SpringPressable>
                    </View>

                    <SpringPressable
                      style={[styles.primaryBtn, busy && styles.btnDisabled]}
                      onPress={() => {
                        if (!busy) void onSubmitCodeLogin();
                      }}
                      shrink={0.98}
                    >
                      {busy ? (
                        <ActivityIndicator color={colors.onPrimary} />
                      ) : (
                        <Text style={styles.primaryBtnText}>登录</Text>
                      )}
                    </SpringPressable>
                  </View>
                )}
              </ScrollView>
            </>
          )}
        </Animated.View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 28,
    zIndex: 1,
  },
  card: {
    backgroundColor: colors.modalCardBg,
    borderRadius: radius.surface,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
    maxHeight: '78%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.28,
        shadowRadius: 24,
      },
      android: { elevation: 16 },
      default: {},
    }),
  },
  title: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: colors.modalCardText,
    textAlign: 'center',
  },
  lead: {
    marginTop: 8,
    marginBottom: 14,
    fontSize: 13,
    lineHeight: 20,
    color: colors.modalCardMuted,
    textAlign: 'center',
  },
  methodList: {
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderRadius: radius.surface,
    overflow: 'hidden',
    marginBottom: 8,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 12,
  },
  methodRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(58, 74, 90, 0.16)',
  },
  methodIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodIconPreferred: {
    backgroundColor: colors.blueDeep,
  },
  methodTextCol: { flex: 1 },
  methodTitle: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.modalCardText,
  },
  methodHint: {
    marginTop: 3,
    fontSize: 12,
    color: colors.modalCardMuted,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  formBackBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontFamily: fonts.semiBold,
    color: colors.modalCardText,
  },
  label: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.modalCardMuted,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: 'rgba(58, 74, 90, 0.18)',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.modalCardText,
  },
  codeRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  codeInput: { flex: 1, marginBottom: 0 },
  codeBtn: {
    minWidth: 100,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: radius.surface,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBtnText: {
    color: colors.onPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  primaryBtn: {
    marginTop: 18,
    marginBottom: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.surface,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: colors.onPrimary,
    fontFamily: fonts.extraBold,
    fontSize: 16,
  },
  btnDisabled: { opacity: 0.55 },
  registerLinkWrap: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 4,
  },
  registerLink: {
    fontSize: 14,
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
  registerHint: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: colors.modalCardMuted,
  },
});
