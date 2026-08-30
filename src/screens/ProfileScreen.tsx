import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderMenuOutlineButton } from '../components/HeaderMenuOutlineButton';
import { GlassSurface } from '../components/GlassSurface';
import { SpringPressable } from '../components/SpringPressable';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_AVATAR } from '../constants/defaultImages';
import { useAppData, DEFAULT_PROFILE_DISPLAY_NAME } from '../context/DataContext';
import { deleteCloudWorkspace } from '../services/stowCloudSync';
import { useTabWithStackNavigation } from '../navigation/hooks';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { radius } from '../theme/radius';
import { playNavTap } from '../services/sfx';

const settingsRows: Array<{
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: 'DataExport' | 'Help' | 'PrivacyPolicy';
}> = [
  { key: 'data', label: '数据导出/备份', icon: 'sync-outline', route: 'DataExport' },
  { key: 'privacy', label: '隐私政策', icon: 'shield-checkmark-outline', route: 'PrivacyPolicy' },
  { key: 'help', label: '帮助与支持', icon: 'help-circle-outline', route: 'Help' },
];

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useTabWithStackNavigation();
  const { logoutClear, flushCloudSync, profileDisplayName, profileAvatarUri } = useAppData();
  const { configured, cloudUser, refreshCloudAuth, signOutCloud } = useAuth();

  const accountLabel =
    cloudUser?.label?.trim() &&
    cloudUser.label !== '匿名会话' &&
    cloudUser.label !== '已登录云账号'
      ? cloudUser.label.trim()
      : undefined;
  const customName = profileDisplayName.trim();
  const hasCustomName =
    customName.length > 0 && customName !== DEFAULT_PROFILE_DISPLAY_NAME;
  /** 未自定义昵称时用云账号名；都没有则用默认昵称 */
  const displayName = hasCustomName
    ? customName
    : accountLabel || customName || DEFAULT_PROFILE_DISPLAY_NAME;
  const avatarSource = profileAvatarUri?.trim()
    ? { uri: profileAvatarUri }
    : DEFAULT_AVATAR;
  const methodHint =
    cloudUser?.method === 'phone'
      ? '手机号登录'
      : cloudUser?.method === 'email'
        ? '邮箱登录'
        : cloudUser?.method === 'password'
          ? '账密登录'
          : null;

  useFocusEffect(
    useCallback(() => {
      void refreshCloudAuth();
    }, [refreshCloudAuth])
  );

  const openLoginReminder = useCallback(
    (fromLogout = false) => {
      playNavTap();
      if (!configured) {
        Alert.alert('未配置云开发', '请在 .env 填写 EXPO_PUBLIC_CLOUDBASE_ENV_ID 后重试。');
        return;
      }
      navigation.navigate('AuthLogin', { fromLogout });
    },
    [configured, navigation]
  );

  const onLogout = () => {
    if (!cloudUser) {
      openLoginReminder(false);
      return;
    }
    void (async () => {
      try {
        await flushCloudSync();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        Alert.alert('云同步未完成', `${msg}\n仍将退出登录，本机数据已保留。`);
      }
      await signOutCloud();
      openLoginReminder(true);
    })();
  };

  const onDeleteAccount = () => {
    if (!cloudUser) {
      Alert.alert('请先登录', '删除账号需要先登录云账号。', [
        { text: '取消', style: 'cancel' },
        { text: '去登录', onPress: () => openLoginReminder(false) },
      ]);
      return;
    }
    Alert.alert(
      '删除账号',
      '将永久删除云端物品、计划与资料快照，并清除本机该账号数据。此操作不可恢复。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '永久删除',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteCloudWorkspace();
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                Alert.alert('删除失败', msg);
                return;
              }
              logoutClear();
              await signOutCloud();
              Alert.alert('账号已删除', '云端业务数据与本机缓存已清除。');
            })();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topRow}>
        <HeaderMenuOutlineButton />
        <Text style={styles.headerTitle}>Aurelian Archive</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.profileBlock}>
          <View style={styles.avatarLargeWrap}>
            <View style={styles.avatarLargeClip}>
              <Image source={avatarSource} style={styles.avatarLarge} />
            </View>
            <SpringPressable
              style={styles.editFab}
              onPress={() => {
                playNavTap();
                navigation.navigate('EditProfile');
              }}
              shrink={0.9}
            >
              <Ionicons name="pencil" size={14} color={colors.onPrimary} />
            </SpringPressable>
          </View>
          <Text style={styles.userName}>{displayName}</Text>
          {cloudUser ? (
            <View>
              {accountLabel && accountLabel !== displayName ? (
                <Text style={styles.userEmail}>{accountLabel}</Text>
              ) : null}
              {methodHint ? <Text style={styles.userMeta}>{methodHint}</Text> : null}
            </View>
          ) : null}
        </View>

        <View style={styles.menuCard}>
          <GlassSurface pointerEvents="none" tint="surface" style={StyleSheet.absoluteFillObject} />
          {settingsRows.map((row, idx) => (
            <SpringPressable
              key={row.key}
              style={[styles.menuRow, idx < settingsRows.length - 1 && styles.menuRowBorder]}
              onPress={() => {
                playNavTap();
                navigation.navigate(row.route);
              }}
              shrink={0.99}
            >
              <Ionicons name={row.icon} size={22} color={colors.text} />
              <Text style={styles.menuLabel}>{row.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
            </SpringPressable>
          ))}
        </View>

        <View style={styles.actionRow}>
          <SpringPressable
            pressableStyle={styles.actionBtnHit}
            style={styles.deleteBtn}
            onPress={onDeleteAccount}
            shrink={0.98}
          >
            <Text style={styles.deleteBtnText}>删除账号</Text>
          </SpringPressable>
          <SpringPressable
            pressableStyle={styles.actionBtnHit}
            style={styles.logoutBtn}
            onPress={onLogout}
            shrink={0.98}
          >
            <Text style={styles.logoutText}>{cloudUser ? '退出登录' : '登录账号'}</Text>
          </SpringPressable>
        </View>

        <Text style={styles.version}>VERSION 1.0.0 — AURELIAN SERIES</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', paddingHorizontal: 20 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerRightSpacer: { width: 40 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  scroll: { paddingBottom: 100 },
  profileBlock: { alignItems: 'center', marginTop: 12 },
  avatarLargeWrap: { position: 'relative' },
  avatarLargeClip: {
    width: 112,
    height: 112,
    borderRadius: radius.circle112,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  avatarLarge: {
    width: 112,
    height: 112,
    backgroundColor: colors.border,
  },
  editFab: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 32,
    height: 32,
    borderRadius: radius.circle32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  userName: { marginTop: 16, fontSize: 22, fontFamily: fonts.extraBold, color: colors.text },
  userEmail: {
    marginTop: 6,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  userMeta: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textLight,
    textAlign: 'center',
  },
  menuCard: {
    marginTop: 32,
    backgroundColor: 'transparent',
    borderRadius: radius.surface,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
  },
  menuRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  menuLabel: { flex: 1, fontSize: 16, fontFamily: fonts.semiBold, color: colors.text },
  actionRow: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'stretch',
    width: '100%',
    gap: 12,
  },
  actionBtnHit: {
    flex: 1,
  },
  logoutBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.surface,
  },
  logoutText: { color: colors.onPrimary, fontFamily: fonts.extraBold, letterSpacing: 1 },
  deleteBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteBtnText: {
    color: colors.danger,
    fontFamily: fonts.extraBold,
    letterSpacing: 1,
  },
  version: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 10,
    color: colors.textLight,
    letterSpacing: 1,
  },
});
