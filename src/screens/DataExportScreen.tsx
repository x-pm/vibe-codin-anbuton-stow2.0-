import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SpringPressable } from '../components/SpringPressable';
import { FormSheetBackground } from '../components/FormSheetBackground';
import { useAppData } from '../context/DataContext';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { radius } from '../theme/radius';
import { writeStowXlsxFile } from '../utils/exportStowXlsx';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function DataExportScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { items, plans } = useAppData();
  const [includeItems, setIncludeItems] = useState(true);
  const [includePlans, setIncludePlans] = useState(true);
  const [busy, setBusy] = useState(false);

  const toggleRow = useCallback(
    (key: 'items' | 'plans') => {
      if (key === 'items') setIncludeItems((v) => !v);
      else setIncludePlans((v) => !v);
    },
    []
  );

  const onExport = useCallback(async () => {
    if (!includeItems && !includePlans) {
      Alert.alert('请选择导出内容', '至少勾选「我的物品」或「物品计划」中的一项。');
      return;
    }
    setBusy(true);
    try {
      const uri = await writeStowXlsxFile(
        { items: includeItems, plans: includePlans },
        { items, plans }
      );
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        try {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: '导出 Stow 数据',
            UTI: 'org.openxmlformats.spreadsheetml.sheet',
          });
        } catch (shareErr) {
          // 用户取消系统分享面板时部分机型会 reject，不当作导出失败
          const msg = shareErr instanceof Error ? shareErr.message : String(shareErr);
          if (!/cancel|dismiss|did not share|User did not share/i.test(msg)) {
            throw shareErr;
          }
        }
      } else {
        Alert.alert('已生成文件', '当前环境无法打开系统分享，文件已保存在应用缓存目录。');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('导出失败', msg || '请稍后重试');
    } finally {
      setBusy(false);
    }
  }, [includeItems, includePlans, items, plans]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <FormSheetBackground />
      <View style={styles.header}>
        <SpringPressable onPress={() => navigation.goBack()} style={styles.back} shrink={0.9}>
          <Ionicons name="chevron-back" size={26} color={colors.textOnGlass} />
        </SpringPressable>
        <Text style={styles.headerTitle}>数据导出/备份</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.intro}>
          选择要打包的数据，将生成一个 <Text style={styles.mono}>.xlsx</Text>{' '}
          表格文件，可用 Excel、WPS 等打开。
        </Text>

        <Text style={styles.sectionLabel}>导出内容</Text>
        <View style={styles.card}>
          <SpringPressable
            style={[styles.optionRow, styles.optionRowBorder]}
            onPress={() => toggleRow('items')}
            shrink={0.99}
          >
            <Ionicons
              name={includeItems ? 'checkbox' : 'square-outline'}
              size={24}
              color={includeItems ? colors.primary : colors.textOnGlassMuted}
            />
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionTitle}>我的物品</Text>
              <Text style={styles.optionSub}>共 {items.length} 条</Text>
            </View>
          </SpringPressable>
          <SpringPressable style={styles.optionRow} onPress={() => toggleRow('plans')} shrink={0.99}>
            <Ionicons
              name={includePlans ? 'checkbox' : 'square-outline'}
              size={24}
              color={includePlans ? colors.primary : colors.textOnGlassMuted}
            />
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionTitle}>物品计划</Text>
              <Text style={styles.optionSub}>共 {plans.length} 条</Text>
            </View>
          </SpringPressable>
        </View>

        <Text style={styles.sectionLabel}>导出格式</Text>
        <View style={styles.formatChip}>
          <Ionicons name="document-text-outline" size={20} color={colors.textOnGlass} />
          <Text style={styles.formatChipText}>Microsoft Excel（.xlsx）</Text>
        </View>

        <SpringPressable
          style={[styles.exportBtn, busy && styles.exportBtnDisabled]}
          onPress={() => void onExport()}
          shrink={0.98}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <>
              <Ionicons name="share-outline" size={22} color={colors.onPrimary} />
              <Text style={styles.exportBtnText}>导出并分享</Text>
            </>
          )}
        </SpringPressable>
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
  headerTitle: { fontSize: 17, fontFamily: fonts.extraBold, color: colors.textOnGlass },
  scroll: { paddingHorizontal: 24, paddingTop: 20 },
  intro: {
    fontSize: 15,
    color: colors.textOnGlassMuted,
    lineHeight: 24,
    marginBottom: 24,
  },
  mono: { fontFamily: fonts.bold, color: colors.textOnGlass },
  sectionLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textOnGlassMuted,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: 'rgba(58, 74, 90, 0.16)',
    overflow: 'hidden',
    marginBottom: 22,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
  },
  optionRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(58, 74, 90, 0.12)',
  },
  optionTextWrap: { flex: 1 },
  optionTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.textOnGlass },
  optionSub: { marginTop: 4, fontSize: 13, color: colors.textOnGlassMuted },
  formatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.55)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: 'rgba(58, 74, 90, 0.16)',
    marginBottom: 28,
  },
  formatChipText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.textOnGlass },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.surface,
    minHeight: 54,
  },
  exportBtnDisabled: { opacity: 0.75 },
  exportBtnText: { color: colors.onPrimary, fontFamily: fonts.extraBold, fontSize: 16 },
});
