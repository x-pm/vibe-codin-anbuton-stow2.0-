import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SpringPressable } from '../components/SpringPressable';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const copy: Record<
  keyof Pick<RootStackParamList, 'AccountSettings' | 'About' | 'Help'>,
  { title: string; body: string }
> = {
  AccountSettings: {
    title: '个性化设置',
    body: '此处可接入账号体系、同步与隐私选项。当前为演示占位界面。',
  },
  About: {
    title: '关于 Stow',
    body: 'STOW / Aurelian Archive — 个人数字仓库演示客户端（Expo + React Native）。',
  },
  Help: {
    title: '帮助与支持',
    body: '扫描与链接录入依赖网络与硅基流动 API。若解析失败，请改用手动录入或检查密钥配置。',
  },
};

export function StaticInfoScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const name = route.name as keyof typeof copy;
  const page = copy[name] ?? copy.About;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <SpringPressable onPress={() => navigation.goBack()} style={styles.back} shrink={0.9}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </SpringPressable>
        <Text style={styles.headerTitle}>{page.title}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.body}>{page.body}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: fonts.extraBold, color: colors.text },
  scroll: { padding: 24 },
  body: { fontSize: 16, color: colors.text, lineHeight: 26 },
});
