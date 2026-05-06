import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SpringPressable } from '../components/SpringPressable';
import { safeLeaveToPreviousOrHome } from '../navigation/safeNavigate';
import type { RootStackParamList } from '../navigation/types';
import {
  isSiliconflowConfigured,
  parseItemFieldsFromText,
  parseLinkProductFromPage,
  refineLinkProductNameFromTitleAndImage,
} from '../services/aiParse';
import { fetchLinkContent, htmlToPlainText } from '../services/fetchLink';
import {
  collectProductImageCandidates,
  isLinkRecognitionInsufficient,
  isObviousUiArtifactProductName,
  pickHeroProductImage,
} from '../services/linkMetaExtract';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { radius } from '../theme/radius';
import type { ItemFormPreset } from '../types/models';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PLACEHOLDER = '请粘贴物品链接，系统自动识别';

export function LinkEntryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const onConfirm = async () => {
    if (!url.trim()) {
      Alert.alert('提示', '请先粘贴物品链接。');
      return;
    }
    setLoading(true);
    try {
      const { html, finalUrl, extracted } = await fetchLinkContent(url.trim());
      const plain = htmlToPlainText(html).slice(0, 4000);
      const imageCandidates = collectProductImageCandidates(html, finalUrl);
      const heroImage = pickHeroProductImage(extracted.imageUrl, imageCandidates);
      const et = extracted.title?.trim() ?? '';
      const titleForVision =
        et.length >= 8 ? et : plain.slice(0, 800).trim() || et || plain.slice(0, 200);

      let preset: ItemFormPreset = {
        name: extracted.title,
        imageUrl: extracted.imageUrl,
      };

      if (isSiliconflowConfigured()) {
        try {
          let usedVision = false;
          if (heroImage?.startsWith('http')) {
            try {
              const refined = await refineLinkProductNameFromTitleAndImage(titleForVision, heroImage);
              if (refined && !isObviousUiArtifactProductName(refined)) {
                preset.name = refined;
                preset.imageUrl = heroImage;
                usedVision = true;
              }
            } catch {
              /* 配图 URL 无法被服务端拉取等：走文本解析 */
            }
          }

          if (usedVision) {
            try {
              const extra = await parseItemFieldsFromText(html.slice(0, 12_000), { linkFlow: true });
              preset = {
                ...preset,
                sku: extra.sku?.trim() || preset.sku,
                category: extra.category?.trim() || preset.category,
                location: extra.location?.trim() || preset.location,
                quantity: extra.quantity ?? preset.quantity,
              };
            } catch {
              /* 文本辅助字段可选 */
            }
          } else {
            const ai = await parseLinkProductFromPage({
              pageUrl: finalUrl,
              metaTitle: extracted.title,
              metaImageUrl: extracted.imageUrl,
              imageCandidates,
              plainExcerpt: plain,
              htmlSnippet: html.slice(0, 18000),
            });
            preset = {
              ...preset,
              name: ai.name,
              imageUrl: ai.imageUrl ?? preset.imageUrl,
              sku: ai.sku?.trim() || preset.sku,
              category: ai.category?.trim() || preset.category,
              location: ai.location?.trim() || preset.location,
              quantity: ai.quantity ?? preset.quantity,
            };
          }
        } catch {
          // 余额不足等：保留规则抽取结果
        }
      }

      if (isLinkRecognitionInsufficient(preset, finalUrl)) {
        InteractionManager.runAfterInteractions(() => {
          Alert.alert('提示', '抱歉，未能有效识别，请选择其他方式', [
            {
              text: '手动录入',
              onPress: () => navigation.replace('AddItem', undefined),
            },
            {
              text: '图片扫描',
              onPress: () =>
                navigation.replace('ScanEntry', {
                  entryHint: '建议上传商品详情图片，将自动识别~',
                }),
            },
          ]);
        });
        return;
      }

      navigation.replace('AddItem', { preset });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '解析失败';
      Alert.alert('提示', msg, [{ text: '确定' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable
        style={styles.overlay}
        onPress={() => safeLeaveToPreviousOrHome(navigation)}
      >
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          <TextInput
            style={styles.input}
            placeholder={PLACEHOLDER}
            placeholderTextColor={colors.textLight}
            value={url}
            onChangeText={setUrl}
            multiline
            textAlignVertical="top"
            editable={!loading}
          />
          <SpringPressable
            style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]}
            onPress={() => void onConfirm()}
            shrink={0.98}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.confirmBtnText}>确定</Text>
            )}
          </SpringPressable>
        </View>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.surface,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    minHeight: 100,
    backgroundColor: colors.bg,
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    marginBottom: 16,
  },
  confirmBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radius.surface,
    backgroundColor: colors.primary,
  },
  confirmBtnDisabled: { opacity: 0.75 },
  confirmBtnText: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 16 },
});
