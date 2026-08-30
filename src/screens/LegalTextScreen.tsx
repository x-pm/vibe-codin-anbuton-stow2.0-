import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FormSheetBackground } from '../components/FormSheetBackground';
import { SpringPressable } from '../components/SpringPressable';
import {
  ABOUT_BODY,
  HELP_BODY,
  PRIVACY_POLICY_BODY,
  PRIVACY_POLICY_TITLE,
  SUPPORT_EMAIL,
} from '../constants/legal';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type RouteName = 'AccountSettings' | 'About' | 'Help' | 'PrivacyPolicy';

const pages: Record<RouteName, { title: string; body: string }> = {
  AccountSettings: {
    title: '个性化设置',
    body: `您可在此了解账号与隐私相关选项。

• 编辑资料：返回个人页，点头像旁铅笔。
• 隐私政策：请打开「隐私政策」阅读我们如何处理数据。
• 删除账号：返回个人页底部，使用「删除账号」（需已登录）。该操作将永久删除云端物品快照与本机该账号数据，不可恢复。`,
  },
  About: { title: '关于 Stow', body: ABOUT_BODY },
  Help: { title: '帮助与支持', body: HELP_BODY },
  PrivacyPolicy: { title: PRIVACY_POLICY_TITLE, body: PRIVACY_POLICY_BODY },
};

export function LegalTextScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, RouteName>>();
  const name = route.name as RouteName;
  const page = pages[name] ?? pages.About;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <FormSheetBackground />
      <View style={styles.header}>
        <SpringPressable onPress={() => navigation.goBack()} style={styles.back} shrink={0.9}>
          <Ionicons name="chevron-back" size={26} color={colors.textOnGlass} />
        </SpringPressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {page.title}
        </Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.body}>{page.body}</Text>
        {name === 'Help' || name === 'AccountSettings' ? (
          <SpringPressable
            style={styles.linkBtn}
            onPress={() => navigation.navigate('PrivacyPolicy')}
            shrink={0.98}
          >
            <Text style={styles.linkBtnText}>阅读隐私政策</Text>
          </SpringPressable>
        ) : null}
        {(name === 'PrivacyPolicy' || name === 'Help') && SUPPORT_EMAIL ? (
          <SpringPressable
            style={styles.linkBtn}
            onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
            shrink={0.98}
          >
            <Text style={styles.linkBtnText}>邮件联系 {SUPPORT_EMAIL}</Text>
          </SpringPressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(58, 74, 90, 0.18)',
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: colors.textOnGlass,
  },
  scroll: { padding: 24, paddingBottom: 48 },
  body: { fontSize: 16, color: colors.textOnGlass, lineHeight: 26 },
  linkBtn: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  linkBtnText: { color: colors.onPrimary, fontFamily: fonts.semiBold, fontSize: 15 },
});
