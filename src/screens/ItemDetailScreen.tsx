import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  InteractionManager,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EasePressable } from '../components/EasePressable';
import { SavedToast } from '../components/SavedToast';
import { SpringPressable } from '../components/SpringPressable';
import { useAppData } from '../context/DataContext';
import type { RootStackParamList } from '../navigation/types';
import type { InventoryItem } from '../types/models';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { radius } from '../theme/radius';
import { itemDisplayGroup } from '../utils/itemGroup';

type Route = RouteProp<RootStackParamList, 'ItemDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

function parseTags(raw: string): string[] {
  return raw
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ItemDetailScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { items, updateItem, removeItem, addGroup } = useAppData();
  const item = items.find((i) => i.id === route.params.itemId);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<InventoryItem | null>(null);
  const [savedToastVisible, setSavedToastVisible] = useState(false);
  const autoEditOnceRef = useRef(false);
  const similarInboundHintRef = useRef(false);

  useEffect(() => {
    if (route.params.openInEditMode !== true || !item) return;
    if (autoEditOnceRef.current) return;
    autoEditOnceRef.current = true;
    setDraft({ ...item });
    setIsEditing(true);
  }, [route.params.openInEditMode, item]);

  useEffect(() => {
    autoEditOnceRef.current = false;
    similarInboundHintRef.current = false;
  }, [route.params.itemId]);

  /** 录入页相似判断点「是」：按文档提示在本页填写/调整数量后再保存 */
  useEffect(() => {
    if (route.params.suggestQuantityEdit !== true || !item) return;
    if (similarInboundHintRef.current) return;
    similarInboundHintRef.current = true;
    const handle = InteractionManager.runAfterInteractions(() => {
      Alert.alert(
        '在已有物品上继续录入',
        '请在本页核对信息并调整「数量」等字段：保存后将更新该物品。若本次仅增加库存，请将数量改为「原数量 + 本次入库件数」。',
        [{ text: '知道了' }]
      );
    });
    return () => handle.cancel?.();
  }, [route.params.suggestQuantityEdit, item]);

  /** 仅在编辑态展示移除按钮；浏览详情时不展示 */
  const confirmRemove = useCallback(() => {
    if (!item) return;
    Alert.alert('移除物品', '该操作会将物品彻底移除，是否继续？', [
      { text: '否', style: 'cancel' },
      {
        text: '是',
        style: 'destructive',
        onPress: () => {
          removeItem(item.id);
          setDraft(null);
          setIsEditing(false);
          navigation.goBack();
        },
      },
    ]);
  }, [item, navigation, removeItem]);

  const startEdit = useCallback(() => {
    if (!item) return;
    setDraft({ ...item });
    setIsEditing(true);
  }, [item]);

  const saveEdit = useCallback(() => {
    if (savedToastVisible) return;
    if (!draft) return;
    const { id, ...rest } = draft;
    const g = draft.group?.trim() || draft.category?.trim();
    if (g) addGroup(g);
    updateItem(id, rest);
    setDraft(null);
    setIsEditing(false);
    setSavedToastVisible(true);
  }, [draft, updateItem, addGroup, savedToastVisible]);

  const onSavedToastHidden = useCallback(() => {
    setSavedToastVisible(false);
  }, []);

  const goBack = useCallback(() => {
    if (isEditing) {
      Alert.alert('放弃编辑？', '未保存的修改将丢失。', [
        { text: '继续编辑', style: 'cancel' },
        {
          text: '放弃',
          style: 'destructive',
          onPress: () => {
            setDraft(null);
            setIsEditing(false);
            navigation.goBack();
          },
        },
      ]);
      return;
    }
    navigation.goBack();
  }, [isEditing, navigation]);

  const promptChangeImage = useCallback(() => {
    Alert.alert('更换主图', undefined, [
      {
        text: '拍照',
        onPress: () => {
          void (async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) {
              Alert.alert('提示', '需要相机权限才能拍照。');
              return;
            }
            const res = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.85,
            });
            if (res.canceled || !res.assets[0]?.uri) return;
            setDraft((prev) => (prev ? { ...prev, imageUri: res.assets[0].uri } : prev));
          })();
        },
      },
      {
        text: '从相册上传',
        onPress: () => {
          void (async () => {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
              Alert.alert('提示', '需要相册权限才能选择图片。');
              return;
            }
            const res = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.85,
              allowsEditing: false,
            });
            if (res.canceled || !res.assets[0]?.uri) return;
            setDraft((prev) => (prev ? { ...prev, imageUri: res.assets[0].uri } : prev));
          })();
        },
      },
      { text: '取消', style: 'cancel' },
    ]);
  }, []);

  if (!item) {
    return (
      <View style={[styles.missing, { paddingTop: insets.top }]}>
        <Text style={styles.missingText}>未找到该物品</Text>
        <SpringPressable style={styles.backBtn} onPress={() => navigation.goBack()} shrink={0.97}>
          <Text style={styles.backBtnText}>返回</Text>
        </SpringPressable>
      </View>
    );
  }

  const d = isEditing && draft ? draft : item;
  const mainUri = d.imageUri ?? 'https://picsum.photos/seed/item/400/520';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navRow}>
        <SpringPressable onPress={goBack} style={styles.navIcon} shrink={0.9}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </SpringPressable>
        <Text style={styles.logo}>STOW</Text>
        {isEditing ? (
          <SpringPressable
            onPress={saveEdit}
            style={[styles.navSave, savedToastVisible && styles.navSaveDisabled]}
            shrink={0.96}
            disabled={savedToastVisible}
          >
            <Text style={styles.navSaveText}>保存</Text>
          </SpringPressable>
        ) : (
          <SpringPressable onPress={startEdit} style={styles.navIcon} shrink={0.9}>
            <Ionicons name="create-outline" size={22} color={colors.text} />
          </SpringPressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isEditing ? (
          <View>
            <EasePressable
              pressableStyle={styles.galleryTap}
              style={styles.galleryTap}
              onPress={promptChangeImage}
              shrink={0.98}
            >
              <Image source={{ uri: mainUri }} style={styles.galleryMainSingle} />
              <Text style={styles.galleryTapHint}>点击更换主图</Text>
            </EasePressable>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gallery}>
            {[
              mainUri,
              'https://picsum.photos/seed/detailb/120/200',
              'https://picsum.photos/seed/detailc/120/200',
            ].map((u, idx) => (
              <Image
                key={u}
                source={{ uri: u }}
                style={[styles.galleryImg, idx === 0 ? styles.galleryMain : styles.gallerySide]}
              />
            ))}
          </ScrollView>
        )}

        {isEditing && draft ? (
          <>
            <TextInput
              style={styles.inputCat}
              value={draft.group ?? draft.category}
              onChangeText={(t) =>
                setDraft((prev) =>
                  prev ? { ...prev, group: t, category: t } : prev
                )
              }
              placeholder="分组"
              placeholderTextColor={colors.textLight}
            />
            <TextInput
              style={styles.inputTitle}
              value={draft.name}
              onChangeText={(t) => setDraft((prev) => (prev ? { ...prev, name: t } : prev))}
              placeholder="物品名称"
              placeholderTextColor={colors.textLight}
            />
            <View style={styles.qtyEditRow}>
              <SpringPressable
                style={styles.qtyBtn}
                onPress={() =>
                  setDraft((prev) =>
                    prev ? { ...prev, quantity: Math.max(1, prev.quantity - 1) } : prev
                  )
                }
                shrink={0.92}
              >
                <Text style={styles.qtyBtnText}>−</Text>
              </SpringPressable>
              <Text style={styles.qtyText}>{draft.quantity} 件</Text>
              <SpringPressable
                style={[styles.qtyBtn, styles.qtyBtnPlus]}
                onPress={() =>
                  setDraft((prev) => (prev ? { ...prev, quantity: prev.quantity + 1 } : prev))
                }
                shrink={0.92}
              >
                <Text style={[styles.qtyBtnText, styles.qtyBtnPlusText]}>+</Text>
              </SpringPressable>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name="file-tray-stacked-outline" size={18} color={colors.textMuted} />
                <Text style={styles.cardTitle}>存储位置</Text>
              </View>
              <TextInput
                style={styles.inputInCard}
                value={draft.location ?? ''}
                onChangeText={(t) =>
                  setDraft((prev) => (prev ? { ...prev, location: t || undefined } : prev))
                }
                placeholder="主要位置"
                placeholderTextColor={colors.textLight}
              />
              <TextInput
                style={[styles.inputInCard, styles.inputInCardSub]}
                value={draft.locationDetail ?? ''}
                onChangeText={(t) =>
                  setDraft((prev) => (prev ? { ...prev, locationDetail: t || undefined } : prev))
                }
                placeholder="详细架位"
                placeholderTextColor={colors.textLight}
                multiline
              />
            </View>

            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name="pricetag-outline" size={18} color={colors.textMuted} />
                <Text style={styles.cardTitle}>分类标签</Text>
              </View>
              <TextInput
                style={styles.inputInCard}
                value={(draft.tags ?? []).join('，')}
                onChangeText={(t) =>
                  setDraft((prev) => (prev ? { ...prev, tags: parseTags(t) } : prev))
                }
                placeholder="多个标签用逗号分隔"
                placeholderTextColor={colors.textLight}
              />
            </View>

            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name="document-text-outline" size={18} color={colors.textMuted} />
                <Text style={styles.cardTitle}>备注信息</Text>
              </View>
              <TextInput
                style={styles.inputNotes}
                value={draft.notes ?? ''}
                onChangeText={(t) =>
                  setDraft((prev) => (prev ? { ...prev, notes: t || undefined } : prev))
                }
                placeholder="备注"
                placeholderTextColor={colors.textLight}
                multiline
                textAlignVertical="top"
              />
            </View>

            <SpringPressable style={styles.removeBtn} onPress={confirmRemove} shrink={0.98}>
              <Ionicons name="trash-outline" size={22} color={colors.onPrimary} />
              <Text style={styles.removeBtnText}>移除物品</Text>
            </SpringPressable>
          </>
        ) : (
          <>
            <Text style={styles.catLabel}>分组 · {itemDisplayGroup(d)}</Text>
            <Text style={styles.codeLine}>编号 {d.codeLabel}</Text>
            <Text style={styles.itemTitle}>{d.name}</Text>

            <View style={styles.qtyReadonly}>
              <Text style={styles.qtyText}>{d.quantity} 件</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name="file-tray-stacked-outline" size={18} color={colors.textMuted} />
                <Text style={styles.cardTitle}>存储位置</Text>
              </View>
              <Text style={styles.cardMain}>{d.location ?? '未设置'}</Text>
              <Text style={styles.cardSub}>{d.locationDetail ?? '可在录入时补充架位信息。'}</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name="pricetag-outline" size={18} color={colors.textMuted} />
                <Text style={styles.cardTitle}>分类标签</Text>
              </View>
              <View style={styles.tagRow}>
                {(d.tags?.length ? d.tags : ['未分类']).map((t) => (
                  <View key={t} style={styles.tagPill}>
                    <Text style={styles.tagPillText}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name="document-text-outline" size={18} color={colors.textMuted} />
                <Text style={styles.cardTitle}>备注信息</Text>
              </View>
              <Text style={styles.notes}>{d.notes ?? '暂无备注。'}</Text>
            </View>
          </>
        )}
      </ScrollView>
      <SavedToast visible={savedToastVisible} onHidden={onSavedToastHidden} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  missingText: { fontSize: 16, color: colors.textMuted },
  backBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: radius.surface,
  },
  backBtnText: { color: colors.onPrimary, fontFamily: fonts.bold },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  navIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navSave: {
    minWidth: 52,
    paddingHorizontal: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navSaveDisabled: { opacity: 0.45 },
  navSaveText: { fontSize: 16, fontFamily: fonts.bold, color: colors.primary },
  logo: {
    fontFamily: fonts.bold,
    fontSize: 20,
    letterSpacing: 3,
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  gallery: { marginVertical: 8 },
  galleryImg: { borderRadius: radius.surface, backgroundColor: colors.border, marginRight: 10 },
  galleryMain: { width: 280, height: 200 },
  gallerySide: { width: 100, height: 200 },
  galleryTap: { marginVertical: 8, alignSelf: 'flex-start' },
  galleryMainSingle: {
    width: 280,
    height: 200,
    borderRadius: radius.surface,
    backgroundColor: colors.border,
  },
  galleryTapHint: { marginTop: 6, fontSize: 12, color: colors.textMuted },
  catLabel: { marginTop: 8, fontSize: 13, color: colors.textMuted },
  codeLine: { marginTop: 4, fontSize: 13, fontFamily: fonts.semiBold, color: colors.text },
  itemTitle: { marginTop: 8, fontSize: 28, fontFamily: fonts.extraBold, color: colors.text },
  inputCat: {
    marginTop: 8,
    fontSize: 13,
    color: colors.text,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  inputTitle: {
    marginTop: 8,
    fontSize: 28,
    fontFamily: fonts.extraBold,
    color: colors.text,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  qtyReadonly: {
    marginTop: 20,
    backgroundColor: '#ECEAE4',
    borderRadius: radius.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    backgroundColor: '#ECEAE4',
    borderRadius: radius.surface,
    padding: 10,
  },
  qtyBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.surface,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnPlus: { backgroundColor: '#5C4F3A' },
  qtyBtnText: { fontSize: 22, color: colors.text, fontFamily: fonts.medium },
  qtyBtnPlusText: { color: colors.onPrimary },
  qtyText: { fontSize: 18, fontFamily: fonts.bold, color: colors.text },
  card: {
    marginTop: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.surface,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  cardMain: { fontSize: 17, fontFamily: fonts.bold, color: colors.text },
  cardSub: { marginTop: 6, fontSize: 13, color: colors.textMuted, lineHeight: 20 },
  inputInCard: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.text,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  inputInCardSub: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.text,
    marginTop: 8,
    minHeight: 48,
  },
  inputNotes: {
    marginTop: 4,
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.surface,
    backgroundColor: '#EFEFEF',
  },
  tagPillText: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.text },
  notes: { fontSize: 14, color: colors.text, lineHeight: 22 },
  removeBtn: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.surface,
  },
  removeBtnText: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 16 },
});
