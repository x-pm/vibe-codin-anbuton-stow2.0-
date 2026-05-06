import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderBrandMark } from '../components/HeaderBrandMark';
import { HeaderMenuOutlineButton } from '../components/HeaderMenuOutlineButton';
import { SpringPressable } from '../components/SpringPressable';
import { DEFAULT_PROFILE_AVATAR_URI, useAppData } from '../context/DataContext';
import { useTabWithStackNavigation } from '../navigation/hooks';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { radius } from '../theme/radius';

const settingsRows: Array<{
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: 'AccountSettings' | 'DataExport' | 'About' | 'Help';
}> = [
  { key: 'acc', label: '个性化设置', icon: 'person-outline', route: 'AccountSettings' },
  { key: 'data', label: '数据导出/备份', icon: 'sync-outline', route: 'DataExport' },
  { key: 'about', label: '关于 Stow', icon: 'information-circle-outline', route: 'About' },
  { key: 'help', label: '帮助与支持', icon: 'help-circle-outline', route: 'Help' },
];

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useTabWithStackNavigation();
  const { logoutClear, profileDisplayName, profileAvatarUri } = useAppData();

  const displayName = profileDisplayName;
  const avatarUri = profileAvatarUri ?? DEFAULT_PROFILE_AVATAR_URI;

  const onLogout = () => {
    Alert.alert(
      '退出登录',
      '将清除本机已保存的物品、计划与资料，并恢复默认昵称。确定退出？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '退出登录',
          style: 'destructive',
          onPress: () => {
            logoutClear();
            Alert.alert('已退出', '本地会话已结束，数据已按退出流程清除。');
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
        <HeaderBrandMark onPress={() => navigation.navigate('ProfileTab')} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.profileBlock}>
          <View style={styles.avatarLargeWrap}>
            <View style={styles.avatarLargeClip}>
              <Image source={{ uri: avatarUri }} style={styles.avatarLarge} />
            </View>
            <SpringPressable
              style={styles.editFab}
              onPress={() => navigation.navigate('EditProfile')}
              shrink={0.9}
            >
              <Ionicons name="pencil" size={14} color={colors.onPrimary} />
            </SpringPressable>
          </View>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>alex.archive@stow.app</Text>
        </View>

        <View style={styles.menuCard}>
          {settingsRows.map((row, idx) => (
            <SpringPressable
              key={row.key}
              style={[styles.menuRow, idx < settingsRows.length - 1 && styles.menuRowBorder]}
              onPress={() => navigation.navigate(row.route)}
              shrink={0.99}
            >
              <Ionicons name={row.icon} size={22} color={colors.text} />
              <Text style={styles.menuLabel}>{row.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
            </SpringPressable>
          ))}
        </View>

        <SpringPressable style={styles.logoutBtn} onPress={onLogout} shrink={0.98}>
          <Ionicons name="log-out-outline" size={20} color={colors.onPrimary} />
          <Text style={styles.logoutText}>退出登录</Text>
        </SpringPressable>

        <Text style={styles.version}>VERSION 2.4.0 — AURELIAN SERIES</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  scroll: { paddingBottom: 40 },
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
  userEmail: { marginTop: 6, fontSize: 14, color: colors.textMuted },
  menuCard: {
    marginTop: 32,
    backgroundColor: colors.surface,
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
  logoutBtn: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.surface,
  },
  logoutText: { color: colors.onPrimary, fontFamily: fonts.extraBold, letterSpacing: 1 },
  version: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 10,
    color: colors.textLight,
    letterSpacing: 1,
  },
});
