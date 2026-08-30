import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
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
import { CircularCoverOrb } from '../components/CircularCoverOrb';
import { FormSheetBackground } from '../components/FormSheetBackground';
import { GlassSurface } from '../components/GlassSurface';
import { LocationPickerModal } from '../components/LocationPickerModal';
import { SavedToast } from '../components/SavedToast';
import { SpringPressable } from '../components/SpringPressable';
import { useAppData } from '../context/DataContext';
import type { RootStackParamList } from '../navigation/types';
import { doneReturnKeyProps, focusTextInputAfterTransition } from '../utils/inputKeyboard';
import type { InventoryItem } from '../types/models';
import { DEFAULT_OTHER_GROUP } from '../utils/itemGroup';
import { findBestSimilarInventoryItem } from '../utils/itemSimilarity';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { radius } from '../theme/radius';

type Route = RouteProp<RootStackParamList, 'AddItem'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export function AddItemScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const {
    addItem,
    groups,
    addGroup,
    rooms,
    addRoom,
    renameRoom,
    storageEquipment,
    storageEquipmentImages,
    addStorageEquipment,
    renameStorageEquipment,
    items,
  } = useAppData();

  const preset = route.params?.preset;

  const [name, setName] = useState('');
  /** 一级：房间 */
  const [location, setLocation] = useState('');
  /** 二级：储物设备 */
  const [locationDetail, setLocationDetail] = useState('');
  /** 未勾选时保存到系统默认「其他」 */
  const [selectedGroup, setSelectedGroup] = useState('');
  const [qty, setQty] = useState(1);
  const [remarks, setRemarks] = useState('');
  const [coverUri, setCoverUri] = useState<string | undefined>(undefined);

  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [newGroupInput, setNewGroupInput] = useState('');
  const [similarityModalItem, setSimilarityModalItem] = useState<InventoryItem | null>(null);
  const appliedPresetKeyRef = useRef<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const groupInputRef = useRef<TextInput>(null);
  const blockYRef = useRef({ name: 0, location: 0, remarks: 0 });
  const [savedToastVisible, setSavedToastVisible] = useState(false);

  useEffect(() => {
    if (!groupModalOpen) return;
    focusTextInputAfterTransition(groupInputRef);
  }, [groupModalOpen]);

  const scrollFieldIntoView = useCallback((key: keyof typeof blockYRef.current) => {
    const y = blockYRef.current[key];
    const lift = key === 'remarks' ? 120 : 88;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - lift), animated: true });
    });
  }, []);

  /** 弹窗出现时收起键盘，避免 Android 上 Modal 被键盘挡住「像没弹出来」 */
  useEffect(() => {
    if (similarityModalItem) Keyboard.dismiss();
  }, [similarityModalItem]);

  useEffect(() => {
    // 允许空选；仅在已选分组被删除时清空，不自动改选其他分组
    setSelectedGroup((prev) => (!prev || groups.includes(prev) ? prev : ''));
  }, [groups]);

  useEffect(() => {
    if (!preset) return;
    const key = JSON.stringify(preset);
    if (appliedPresetKeyRef.current === key) return;
    appliedPresetKeyRef.current = key;

    // 录入默认留空：识别结果只带入名称与照片，不自动填分组/位置/备注等
    if (preset.name) setName(preset.name);
    if (preset.localImageUri) setCoverUri(preset.localImageUri);
    else if (preset.imageUrl?.startsWith('http')) setCoverUri(preset.imageUrl);
  }, [preset]);

  const confirmNewGroup = () => {
    const t = newGroupInput.trim();
    if (!t) return;
    addGroup(t);
    setSelectedGroup(t);
    setNewGroupInput('');
    setGroupModalOpen(false);
  };

  const openLocationPicker = () => {
    Keyboard.dismiss();
    setLocationModalOpen(true);
  };

  const promptAddCover = useCallback(() => {
    Alert.alert(coverUri ? '更换物品照片' : '添加物品照片', undefined, [
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
            setCoverUri(res.assets[0].uri);
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
            setCoverUri(res.assets[0].uri);
          })();
        },
      },
      { text: '取消', style: 'cancel' },
    ]);
  }, [coverUri]);

  const persistNewItem = useCallback(() => {
    if (savedToastVisible) return;
    const g = selectedGroup.trim() || DEFAULT_OTHER_GROUP;
    if (!groups.includes(g)) addGroup(g);
    addItem({
      name: name.trim(),
      category: g,
      group: g,
      subCategory: undefined,
      inventoryNumber: 0,
      codeLabel: '',
      sku: preset?.sku?.trim() || undefined,
      location: location.trim() || undefined,
      locationDetail: locationDetail.trim() || undefined,
      quantity: qty,
      notes: remarks.trim() || undefined,
      tags: [g],
      imageUri: coverUri,
    });
    Keyboard.dismiss();
    setSavedToastVisible(true);
  }, [
    savedToastVisible,
    selectedGroup,
    groups,
    addGroup,
    addItem,
    name,
    preset?.sku,
    location,
    locationDetail,
    qty,
    remarks,
    coverUri,
  ]);

  /** 仅在用户点击「确认并录入仓库」时检查相似物品；须由用户点「是/否」决定，不自动确认 */
  const submit = () => {
    if (savedToastVisible) return;
    if (!name.trim()) {
      return;
    }
    const similarHit = findBestSimilarInventoryItem(name.trim(), items);
    if (similarHit) {
      Keyboard.dismiss();
      setSimilarityModalItem(similarHit.item);
      return;
    }
    persistNewItem();
  };

  const onSavedToastHidden = useCallback(() => {
    setSavedToastVisible(false);
    navigation.goBack();
  }, [navigation]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <FormSheetBackground />
      <View style={styles.header}>
        <SpringPressable onPress={() => navigation.goBack()} style={styles.headerIcon} shrink={0.9}>
          <Ionicons name="close" size={28} color={colors.textOnGlass} />
        </SpringPressable>
        <Text style={styles.headerTitle}>录入物品</Text>
        <View style={styles.headerIcon} />
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
            { flexGrow: 1, paddingBottom: 28 + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator
        >
        <CircularCoverOrb
          uri={coverUri}
          onPress={promptAddCover}
          disabled={savedToastVisible}
        />

        <View
          collapsable={false}
          onLayout={(e) => {
            blockYRef.current.name = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.label}>物品名称</Text>
          <GlassSurface tint="form" style={styles.input}>
            <TextInput
              style={styles.inputText}
              placeholder="输入名称..."
              placeholderTextColor={colors.textOnGlassMuted}
              value={name}
              onChangeText={setName}
              onFocus={() => scrollFieldIntoView('name')}
              {...doneReturnKeyProps}
            />
          </GlassSurface>
        </View>

        <View
          onLayout={(e) => {
            blockYRef.current.location = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.label}>存储位置</Text>
          <SpringPressable
            style={styles.inputRow}
            onPress={openLocationPicker}
            shrink={0.99}
            accessibilityRole="button"
            accessibilityLabel="选择存储位置"
          >
            <GlassSurface pointerEvents="none" tint="form" style={StyleSheet.absoluteFillObject} />
            <Text
              style={[
                styles.locationValue,
                !location && styles.locationPlaceholder,
              ]}
              numberOfLines={1}
            >
              {location
                ? locationDetail
                  ? `${location} · ${locationDetail}`
                  : location
                : '选择位置'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textOnGlassMuted} />
          </SpringPressable>
        </View>

        <Text style={styles.label}>物品分组</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsRow}>
          {groups.map((t) => (
            <SpringPressable
              key={t}
              style={[styles.tag, selectedGroup === t && styles.tagActive]}
              onPress={() => setSelectedGroup((prev) => (prev === t ? '' : t))}
              shrink={0.95}
            >
              {selectedGroup !== t ? (
                <GlassSurface pointerEvents="none" tint="form" style={StyleSheet.absoluteFillObject} />
              ) : null}
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
            <GlassSurface pointerEvents="none" tint="form" style={StyleSheet.absoluteFillObject} />
            <Ionicons name="add" size={22} color={colors.textOnGlass} />
          </SpringPressable>
        </ScrollView>

        <View style={styles.stepperCard}>
          <GlassSurface pointerEvents="none" tint="form" style={StyleSheet.absoluteFillObject} />
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
              <GlassSurface pointerEvents="none" tint="form" style={StyleSheet.absoluteFillObject} />
              <Text style={styles.stepBtnText}>−</Text>
            </SpringPressable>
            <Text style={styles.stepVal}>{qty}</Text>
            <SpringPressable style={styles.stepBtn} onPress={() => setQty((q) => q + 1)} shrink={0.92}>
              <GlassSurface pointerEvents="none" tint="form" style={StyleSheet.absoluteFillObject} />
              <Text style={styles.stepBtnText}>+</Text>
            </SpringPressable>
          </View>
        </View>

        <View
          collapsable={false}
          onLayout={(e) => {
            blockYRef.current.remarks = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.label}>备注信息</Text>
          <GlassSurface tint="form" style={[styles.input, styles.textArea]}>
            <TextInput
              style={[styles.inputText, styles.textAreaInner]}
              placeholder="添加关于此物品的详细说明、保养要求或历史背景..."
              placeholderTextColor={colors.textOnGlassMuted}
              value={remarks}
              onChangeText={setRemarks}
              multiline
              textAlignVertical="top"
              onFocus={() => scrollFieldIntoView('remarks')}
              {...doneReturnKeyProps}
            />
          </GlassSurface>
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
        <Pressable style={styles.modalBackdrop} onPress={() => setSimilarityModalItem(null)}>
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
                  setSimilarityModalItem(null);
                  persistNewItem();
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

      <LocationPickerModal
        visible={locationModalOpen}
        rooms={rooms}
        storageEquipment={storageEquipment}
        storageEquipmentImages={storageEquipmentImages}
        initialRoom={location}
        initialEquipment={locationDetail}
        onClose={() => setLocationModalOpen(false)}
        onAddRoom={addRoom}
        onRenameRoom={renameRoom}
        onAddStorageEquipment={addStorageEquipment}
        onRenameStorageEquipment={renameStorageEquipment}
        onConfirm={({ room, equipment, skipped }) => {
          if (skipped) {
            setLocation('');
            setLocationDetail('');
          } else {
            setLocation(room);
            setLocationDetail(equipment);
          }
          setLocationModalOpen(false);
        }}
      />

      <Modal
        visible={groupModalOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        presentationStyle="overFullScreen"
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setGroupModalOpen(false)} />
          <Pressable
            style={[styles.modalCard, { paddingBottom: 16 + insets.bottom }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>新建分组</Text>
            <View style={[styles.modalInput, styles.modalInputSolid]}>
              <TextInput
                ref={groupInputRef}
                style={styles.modalInputText}
                placeholder="分组名称"
                placeholderTextColor={colors.textOnGlassMuted}
                value={newGroupInput}
                onChangeText={setNewGroupInput}
                {...doneReturnKeyProps}
              />
            </View>
            <View style={styles.modalActions}>
              <SpringPressable style={[styles.modalBtnGhost, styles.modalBtnGhostSolid]} onPress={() => setGroupModalOpen(false)} shrink={0.96}>
                <Text style={styles.modalBtnGhostText}>取消</Text>
              </SpringPressable>
              <SpringPressable style={styles.modalBtnPrimary} onPress={confirmNewGroup} shrink={0.96}>
                <Text style={styles.modalBtnPrimaryText}>添加</Text>
              </SpringPressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
      <SavedToast visible={savedToastVisible} onHidden={onSavedToastHidden} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  kav: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(58, 74, 90, 0.18)',
  },
  headerIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: fonts.extraBold, color: colors.textOnGlass },
  scroll: { padding: 20 },
  label: { fontSize: 13, fontFamily: fonts.bold, color: colors.textOnGlass, marginBottom: 8 },
  input: {
    borderRadius: radius.surface,
    marginBottom: 18,
    overflow: 'hidden',
  },
  inputText: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textOnGlass,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.surface,
    paddingLeft: 14,
    paddingRight: 12,
    paddingVertical: 12,
    marginBottom: 18,
    overflow: 'hidden',
  },
  locationValue: {
    flex: 1,
    fontSize: 15,
    color: colors.textOnGlass,
    fontFamily: fonts.medium,
    marginRight: 8,
  },
  locationPlaceholder: {
    color: colors.textOnGlassMuted,
    fontFamily: fonts.regular,
  },
  tagsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.surface,
    overflow: 'hidden',
  },
  tagActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tagText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.textOnGlass },
  tagTextActive: { color: colors.onPrimary },
  tagPlus: {
    width: 44,
    height: 44,
    borderRadius: radius.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stepperCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.surface,
    padding: 16,
    marginBottom: 18,
    overflow: 'hidden',
  },
  stepperTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.textOnGlass },
  stepperSub: { marginTop: 4, fontSize: 10, color: colors.textOnGlassMuted, letterSpacing: 0.5 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stepBtnText: { fontSize: 20, color: colors.textOnGlass },
  stepVal: { fontSize: 18, fontFamily: fonts.bold, minWidth: 28, textAlign: 'center', color: colors.textOnGlass },
  textArea: { minHeight: 100 },
  textAreaInner: { minHeight: 100, textAlignVertical: 'top' },
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 28,
    zIndex: 9999,
    elevation: 24,
  },
  modalCard: {
    backgroundColor: colors.modalCardBg,
    borderRadius: radius.surface,
    padding: 20,
    overflow: 'hidden',
  },
  modalTitle: { fontSize: 17, fontFamily: fonts.extraBold, color: colors.modalCardText, marginBottom: 14 },
  modalInput: {
    borderRadius: radius.surface,
    marginBottom: 18,
    overflow: 'hidden',
  },
  modalInputSolid: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(58, 74, 90, 0.18)',
  },
  modalInputText: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textOnGlass,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalBtnGhost: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.surface,
    overflow: 'hidden',
  },
  modalBtnGhostSolid: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(58, 74, 90, 0.2)',
  },
  modalBtnGhostText: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.modalCardText },
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
    color: colors.modalCardText,
    lineHeight: 22,
    marginBottom: 10,
  },
  similarityHint: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.modalCardMuted,
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
    color: colors.modalCardText,
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
