import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SavedToast } from '../components/SavedToast';
import { SpringPressable } from '../components/SpringPressable';
import { useAppData } from '../context/DataContext';
import type { RootStackParamList } from '../navigation/types';
import type { InventoryItem } from '../types/models';
import { findBestSimilarInventoryItem } from '../utils/itemSimilarity';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { radius } from '../theme/radius';

type Route = RouteProp<RootStackParamList, 'AddItem'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

function pickGroupLabel(
  raw: string | undefined,
  explicitGroup: string | undefined,
  groupsList: string[]
): string {
  const first = groupsList[0] ?? '电子产品';
  const tryPick = (s: string) => {
    const hit = groupsList.find((g) => s.includes(g) || g.includes(s));
    return hit ?? (s.trim() || first);
  };
  if (explicitGroup?.trim()) return tryPick(explicitGroup.trim());
  if (!raw?.trim()) return first;
  return tryPick(raw.trim());
}

export function AddItemScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { addItem, groups, addGroup, items } = useAppData();

  const preset = route.params?.preset;

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(groups[0] ?? '电子产品');
  const [qty, setQty] = useState(1);
  const [remarks, setRemarks] = useState('');
  const [coverUri, setCoverUri] = useState<string | undefined>(undefined);

  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [newGroupInput, setNewGroupInput] = useState('');
  const [debouncedName, setDebouncedName] = useState('');
  const [similarityModalItem, setSimilarityModalItem] = useState<InventoryItem | null>(null);
  const dismissedSimilarIdRef = useRef<string | null>(null);
  const prevDebouncedNameRef = useRef('');

  const scrollRef = useRef<ScrollView>(null);
  const blockYRef = useRef({ name: 0, location: 0, remarks: 0 });
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [savedToastVisible, setSavedToastVisible] = useState(false);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvt, (e) => setKeyboardHeight(e.endCoordinates.height));
    const subHide = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const scrollFieldIntoView = useCallback((key: keyof typeof blockYRef.current) => {
    const y = blockYRef.current[key];
    const lift = key === 'remarks' ? 120 : 88;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - lift), animated: true });
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedName(name.trim()), 450);
    return () => clearTimeout(t);
  }, [name]);

  useEffect(() => {
    if (debouncedName !== prevDebouncedNameRef.current) {
      prevDebouncedNameRef.current = debouncedName;
      dismissedSimilarIdRef.current = null;
    }
  }, [debouncedName]);

  useEffect(() => {
    if (debouncedName.length < 2) {
      setSimilarityModalItem(null);
      return;
    }
    const hit = findBestSimilarInventoryItem(debouncedName, items);
    if (!hit) {
      setSimilarityModalItem(null);
      return;
    }
    if (dismissedSimilarIdRef.current === hit.item.id) {
      setSimilarityModalItem(null);
      return;
    }
    Keyboard.dismiss();
    setSimilarityModalItem((prev) => (prev?.id === hit.item.id ? prev : hit.item));
  }, [debouncedName, items]);

  /** 弹窗出现时收起键盘，避免 Android 上 Modal 被键盘挡住「像没弹出来」 */
  useEffect(() => {
    if (similarityModalItem) Keyboard.dismiss();
  }, [similarityModalItem]);

  useEffect(() => {
    setSelectedGroup((prev) => (groups.includes(prev) ? prev : groups[0] ?? prev));
  }, [groups]);

  useEffect(() => {
    if (!preset) return;
    if (preset.name) setName(preset.name);
    if (preset.location) setLocation(preset.location);
    if (preset.remarks) setRemarks(preset.remarks);
    if (preset.quantity) setQty(Math.max(1, preset.quantity));
    setSelectedGroup(pickGroupLabel(preset.category, preset.group, groups));
    if (preset.localImageUri) setCoverUri(preset.localImageUri);
    else if (preset.imageUrl?.startsWith('http')) setCoverUri(preset.imageUrl);
  }, [preset, groups]);

  const confirmNewGroup = () => {
    const t = newGroupInput.trim();
    if (!t) return;
    addGroup(t);
    setSelectedGroup(t);
    setNewGroupInput('');
    setGroupModalOpen(false);
  };

  const submit = () => {
    if (savedToastVisible) return;
    if (!name.trim()) {
      return;
    }
    const nm = name.trim();
    const similarHit = findBestSimilarInventoryItem(nm, items);
    if (similarHit && dismissedSimilarIdRef.current !== similarHit.item.id) {
      Keyboard.dismiss();
      setSimilarityModalItem(similarHit.item);
      return;
    }
    const g = selectedGroup.trim() || groups[0] || '未分组';
    addItem({
      name: name.trim(),
      category: g,
      group: g,
      subCategory: undefined,
      inventoryNumber: 0,
      codeLabel: '',
      sku: preset?.sku?.trim() || undefined,
      location: location.trim() || undefined,
      quantity: qty,
      notes: remarks.trim() || undefined,
      tags: [g],
      imageUri: coverUri ?? 'https://picsum.photos/seed/newitem/400/520',
    });
    Keyboard.dismiss();
    setSavedToastVisible(true);
  };

  const onSavedToastHidden = useCallback(() => {
    setSavedToastVisible(false);
    navigation.goBack();
  }, [navigation]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <SpringPressable onPress={() => navigation.goBack()} style={styles.headerIcon} shrink={0.9}>
          <Ionicons name="close" size={28} color={colors.text} />
        </SpringPressable>
        <Text style={styles.headerTitle}>录入物品</Text>
        <SpringPressable
          style={[styles.saveChip, savedToastVisible && styles.saveChipDisabled]}
          onPress={submit}
          shrink={0.95}
          disabled={savedToastVisible}
        >
          <Text style={styles.saveChipText}>保存</Text>
        </SpringPressable>
      </View>

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 6 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scroll,
            {
              flexGrow: 1,
              paddingBottom: 28 + insets.bottom + keyboardHeight + (keyboardHeight > 0 ? 24 : 0),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
        <SpringPressable style={styles.photoBox} onPress={() => {}} shrink={0.99}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={styles.coverImg} resizeMode="contain" />
          ) : (
            <>
              <Ionicons name="camera-outline" size={40} color={colors.textMuted} />
              <Text style={styles.photoHint}>添加物品照片</Text>
            </>
          )}
        </SpringPressable>

        <View
          onLayout={(e) => {
            blockYRef.current.name = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.label}>物品名称</Text>
          <TextInput
            style={styles.input}
            placeholder="输入名称..."
            placeholderTextColor={colors.textLight}
            value={name}
            onChangeText={setName}
            onFocus={() => scrollFieldIntoView('name')}
          />
        </View>

        <View
          onLayout={(e) => {
            blockYRef.current.location = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.label}>存储位置</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 1, borderWidth: 0, marginBottom: 0 }]}
              placeholder="选择仓库/架位"
              placeholderTextColor={colors.textLight}
              value={location}
              onChangeText={setLocation}
              onFocus={() => scrollFieldIntoView('location')}
            />
            <Ionicons name="location-outline" size={20} color={colors.textMuted} />
          </View>
        </View>

        <Text style={styles.label}>物品分组</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsRow}>
          {groups.map((t) => (
            <SpringPressable
              key={t}
              style={[styles.tag, selectedGroup === t && styles.tagActive]}
              onPress={() => setSelectedGroup(t)}
              shrink={0.95}
            >
              <Text style={[styles.tagText, selectedGroup === t && styles.tagTextActive]}>{t}</Text>
            </SpringPressable>
          ))}
          <SpringPressable
            style={styles.tagPlus}
            onPress={() => {
              setNewGroupInput('');
              setGroupModalOpen(true);
            }}
            shrink={0.92}
          >
            <Ionicons name="add" size={22} color={colors.text} />
          </SpringPressable>
        </ScrollView>

        <View style={styles.stepperCard}>
          <View>
            <Text style={styles.stepperTitle}>本次录入</Text>
            <Text style={styles.stepperSub}>QUANTITY TO REGISTER</Text>
          </View>
          <View style={styles.stepper}>
            <SpringPressable
              style={styles.stepBtn}
              onPress={() => setQty((q) => Math.max(1, q - 1))}
              shrink={0.92}
            >
              <Text style={styles.stepBtnText}>−</Text>
            </SpringPressable>
            <Text style={styles.stepVal}>{qty}</Text>
            <SpringPressable style={styles.stepBtn} onPress={() => setQty((q) => q + 1)} shrink={0.92}>
              <Text style={styles.stepBtnText}>+</Text>
            </SpringPressable>
          </View>
        </View>

        <View
          onLayout={(e) => {
            blockYRef.current.remarks = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.label}>备注信息</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="添加关于此物品的详细说明、保养要求或历史背景..."
            placeholderTextColor={colors.textLight}
            value={remarks}
            onChangeText={setRemarks}
            multiline
            textAlignVertical="top"
            onFocus={() => scrollFieldIntoView('remarks')}
          />
        </View>

        <SpringPressable style={styles.confirmBtn} onPress={submit} shrink={0.98}>
          <Text style={styles.confirmText}>确认并录入仓库</Text>
        </SpringPressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={!!similarityModalItem}
        transparent
        animationType="fade"
        statusBarTranslucent
        presentationStyle="overFullScreen"
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            if (similarityModalItem) dismissedSimilarIdRef.current = similarityModalItem.id;
            setSimilarityModalItem(null);
          }}
        >
          <Pressable style={[styles.modalCard, { paddingBottom: 16 + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>相似物品</Text>
            <Text style={styles.similarityBody}>
              检测到仓库中已存在类似物品，是否继续在该物品下录入？
            </Text>
            {similarityModalItem ? (
              <Text style={styles.similarityHint} numberOfLines={2}>
                已有：{similarityModalItem.name}
                {similarityModalItem.codeLabel ? `（编号 ${similarityModalItem.codeLabel}）` : ''}
              </Text>
            ) : null}
            <View style={styles.similarityActions}>
              <SpringPressable
                pressableStyle={styles.similarityBtnGhostPressable}
                style={styles.similarityBtnGhost}
                onPress={() => {
                  if (similarityModalItem) dismissedSimilarIdRef.current = similarityModalItem.id;
                  setSimilarityModalItem(null);
                }}
                shrink={0.96}
                accessibilityRole="button"
                accessibilityLabel="否，继续当前录入"
              >
                <Text style={styles.similarityBtnGhostText}>否</Text>
              </SpringPressable>
              <SpringPressable
                pressableStyle={styles.similarityBtnPrimaryPressable}
                style={styles.similarityBtnPrimary}
                onPress={() => {
                  const id = similarityModalItem?.id;
                  setSimilarityModalItem(null);
                  if (id) {
                    navigation.replace('ItemDetail', {
                      itemId: id,
                      openInEditMode: true,
                      suggestQuantityEdit: true,
                    });
                  }
                }}
                shrink={0.96}
                accessibilityRole="button"
                accessibilityLabel="是，打开已有物品编辑"
              >
                <Text style={styles.similarityBtnPrimaryText}>是</Text>
              </SpringPressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={groupModalOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        presentationStyle="overFullScreen"
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setGroupModalOpen(false)}>
          <Pressable style={[styles.modalCard, { paddingBottom: 16 + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>新建分组</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="分组名称"
              placeholderTextColor={colors.textLight}
              value={newGroupInput}
              onChangeText={setNewGroupInput}
              autoFocus
            />
            <View style={styles.modalActions}>
              <SpringPressable style={styles.modalBtnGhost} onPress={() => setGroupModalOpen(false)} shrink={0.96}>
                <Text style={styles.modalBtnGhostText}>取消</Text>
              </SpringPressable>
              <SpringPressable style={styles.modalBtnPrimary} onPress={confirmNewGroup} shrink={0.96}>
                <Text style={styles.modalBtnPrimaryText}>添加</Text>
              </SpringPressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <SavedToast visible={savedToastVisible} onHidden={onSavedToastHidden} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  kav: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: fonts.extraBold, color: colors.text },
  saveChip: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.surface,
  },
  saveChipDisabled: { opacity: 0.55 },
  saveChipText: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 14 },
  scroll: { padding: 20 },
  photoBox: {
    height: 160,
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: '#F0EDE6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  coverImg: { width: '100%', height: '100%' },
  photoHint: { marginTop: 8, fontSize: 14, color: colors.textMuted },
  label: { fontSize: 13, fontFamily: fonts.bold, color: colors.text, marginBottom: 8 },
  input: {
    backgroundColor: '#F3F1EC',
    borderRadius: radius.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F1EC',
    borderRadius: radius.surface,
    paddingRight: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 18,
  },
  tagsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tagActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tagText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.text },
  tagTextActive: { color: colors.onPrimary },
  tagPlus: {
    width: 44,
    height: 44,
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  stepperCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E8E6E0',
    borderRadius: radius.surface,
    padding: 16,
    marginBottom: 18,
  },
  stepperTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  stepperSub: { marginTop: 4, fontSize: 10, color: colors.textLight, letterSpacing: 0.5 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.surface,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 20, color: colors.text },
  stepVal: { fontSize: 18, fontFamily: fonts.bold, minWidth: 28, textAlign: 'center' },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  confirmBtn: {
    marginTop: 8,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.surface,
    alignItems: 'center',
  },
  confirmText: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 16 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 28,
    zIndex: 9999,
    elevation: 24,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.surface,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { fontSize: 17, fontFamily: fonts.extraBold, color: colors.text, marginBottom: 14 },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    marginBottom: 18,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalBtnGhost: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalBtnGhostText: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.text },
  modalBtnPrimary: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.surface,
    backgroundColor: colors.primary,
  },
  modalBtnPrimaryText: { fontSize: 15, fontFamily: fonts.bold, color: colors.onPrimary },
  similarityBody: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 10,
  },
  similarityHint: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginBottom: 18,
    lineHeight: 20,
  },
  similarityActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  /** 仅布局：边框与背景在内层 Animated.View，避免出现「双描边」内框 */
  similarityBtnGhostPressable: {
    flex: 1,
    minHeight: 48,
  },
  similarityBtnGhost: {
    flex: 1,
    width: '100%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  similarityBtnPrimaryPressable: {
    flex: 1,
    minHeight: 48,
  },
  /** 弹窗内用系统黑体，避免全局思源宋体在「否」等字上出现方框/回退字形 */
  similarityBtnGhostText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    includeFontPadding: false,
    ...Platform.select({
      android: { fontFamily: 'sans-serif-medium' },
      ios: { fontFamily: 'PingFang SC' },
      default: { fontFamily: fonts.semiBold },
    }),
  },
  similarityBtnPrimary: {
    flex: 1,
    width: '100%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radius.surface,
    backgroundColor: colors.primary,
    overflow: 'hidden',
  },
  similarityBtnPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onPrimary,
    includeFontPadding: false,
    ...Platform.select({
      android: { fontFamily: 'sans-serif-medium' },
      ios: { fontFamily: 'PingFang SC' },
      default: { fontFamily: fonts.bold },
    }),
  },
});
