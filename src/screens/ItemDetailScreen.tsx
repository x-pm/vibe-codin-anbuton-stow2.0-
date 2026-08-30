import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  InteractionManager,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EasePressable } from '../components/EasePressable';
import { FormSheetBackground } from '../components/FormSheetBackground';
import { GlassSurface } from '../components/GlassSurface';
import { LocationPickerModal } from '../components/LocationPickerModal';
import { SavedToast } from '../components/SavedToast';
import { SpringPressable } from '../components/SpringPressable';
import { DEFAULT_ITEM_COVER } from '../constants/defaultImages';
import { useAppData } from '../context/DataContext';
import type { RootStackParamList } from '../navigation/types';
import type { InventoryItem } from '../types/models';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { radius } from '../theme/radius';
import { DEFAULT_OTHER_GROUP, itemDisplayGroup } from '../utils/itemGroup';
import { doneReturnKeyProps } from '../utils/inputKeyboard';

type Route = RouteProp<RootStackParamList, 'ItemDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ItemDetailScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const {
    items,
    groups,
    updateItem,
    removeItem,
    addGroup,
    rooms,
    addRoom,
    renameRoom,
    storageEquipment,
    storageEquipmentImages,
    addStorageEquipment,
    renameStorageEquipment,
  } = useAppData();
  const item = items.find((i) => i.id === route.params.itemId);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<InventoryItem | null>(null);
  const [savedToastVisible, setSavedToastVisible] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [newGroupInput, setNewGroupInput] = useState('');
  const autoEditOnceRef = useRef(false);
  const similarInboundHintRef = useRef(false);
  /** 相似物品选「是」：与新增录入页统一（无右上保存，底部「确认并录入仓库」） */
  const isSimilarInbound = route.params.suggestQuantityEdit === true;

  useEffect(() => {
    if (route.params.openInEditMode !== true || !item) return;
    if (autoEditOnceRef.current) return;
    autoEditOnceRef.current = true;
    const g = item.group?.trim() || item.category?.trim();
    if (g) addGroup(g);
    setDraft({ ...item });
    setIsEditing(true);
  }, [route.params.openInEditMode, item, addGroup]);

  useEffect(() => {
    autoEditOnceRef.current = false;
    similarInboundHintRef.current = false;
  }, [route.params.itemId]);

  /** 录入页相似判断点「是」：提示在本页调整数量后点底部录入 */
  useEffect(() => {
    if (!isSimilarInbound || !item) return;
    if (similarInboundHintRef.current) return;
    similarInboundHintRef.current = true;
    const handle = InteractionManager.runAfterInteractions(() => {
      Alert.alert(
        '在已有物品上继续录入',
        '请在本页核对信息并调整「数量」等字段：点下方「确认并录入仓库」后将更新该物品。若本次仅增加库存，请将数量改为「原数量 + 本次入库件数」。',
        [{ text: '知道了' }]
      );
    });
    return () => handle.cancel?.();
  }, [isSimilarInbound, item]);

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
    const g = item.group?.trim() || item.category?.trim();
    if (g) addGroup(g);
    setDraft({ ...item });
    setIsEditing(true);
  }, [item, addGroup]);

  const confirmNewGroup = useCallback(() => {
    const t = newGroupInput.trim();
    if (!t) return;
    addGroup(t);
    setDraft((prev) => (prev ? { ...prev, group: t, category: t } : prev));
    setNewGroupInput('');
    setGroupModalOpen(false);
  }, [newGroupInput, addGroup]);

  const saveEdit = useCallback(() => {
    if (savedToastVisible) return;
    if (!draft) return;
    const g = draft.group?.trim() || draft.category?.trim() || DEFAULT_OTHER_GROUP;
    addGroup(g);
    const { id, ...rest } = { ...draft, group: g, category: g };
    updateItem(id, rest);
    setDraft(null);
    setIsEditing(false);
    setSavedToastVisible(true);
  }, [draft, updateItem, addGroup, savedToastVisible]);

  const onSavedToastHidden = useCallback(() => {
    setSavedToastVisible(false);
    if (isSimilarInbound) navigation.goBack();
  }, [isSimilarInbound, navigation]);

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
  const mainUri = d.imageUri?.trim() || undefined;
  const mainSource = mainUri ? { uri: mainUri } : DEFAULT_ITEM_COVER;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <FormSheetBackground />
      <View style={styles.navRow}>
        <SpringPressable onPress={goBack} style={styles.navIcon} shrink={0.9}>
          <Ionicons
            name={isSimilarInbound ? 'close' : 'chevron-back'}
            size={isSimilarInbound ? 28 : 26}
            color={colors.textOnGlass}
          />
        </SpringPressable>
        {isSimilarInbound ? (
          <Text style={[styles.logo, styles.logoEntry]}>录入物品</Text>
        ) : (
          <View style={styles.navCenter} />
        )}
        {isSimilarInbound ? (
          <View style={styles.navIcon} />
        ) : isEditing ? (
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
            <Ionicons name="create-outline" size={22} color={colors.textOnGlass} />
          </SpringPressable>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          isSimilarInbound && isEditing ? { paddingBottom: 28 + insets.bottom } : null,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isEditing ? (
          <View>
            <EasePressable
              pressableStyle={styles.galleryTap}
              style={styles.galleryTap}
              onPress={promptChangeImage}
              shrink={0.98}
            >
              <Image source={mainSource} style={styles.galleryMainSingle} />
              <Text style={styles.galleryTapHint}>点击更换主图</Text>
            </EasePressable>
          </View>
        ) : (
          <View style={styles.gallery}>
            <Image source={mainSource} style={[styles.galleryImg, styles.galleryMain]} />
          </View>
        )}

        {isEditing && draft ? (
          <>
            <Text style={styles.groupLabel}>物品分组</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.groupTagsRow}
            >
              {groups.map((t) => {
                const selected = (draft.group ?? draft.category) === t;
                return (
                  <SpringPressable
                    key={t}
                    style={[styles.groupTag, selected && styles.groupTagActive]}
                    onPress={() =>
                      setDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              group: selected ? '' : t,
                              category: selected ? '' : t,
                            }
                          : prev
                      )
                    }
                    shrink={0.95}
                  >
                    {!selected ? (
                      <GlassSurface
                        pointerEvents="none"
                        tint="form"
                        style={StyleSheet.absoluteFillObject}
                      />
                    ) : null}
                    <Text style={[styles.groupTagText, selected && styles.groupTagTextActive]}>
                      {t}
                    </Text>
                  </SpringPressable>
                );
              })}
              <SpringPressable
                style={styles.groupTagPlus}
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
            <TextInput
              style={styles.inputTitle}
              value={draft.name}
              onChangeText={(t) => setDraft((prev) => (prev ? { ...prev, name: t } : prev))}
              placeholder="物品名称"
              placeholderTextColor={colors.textLight}
              {...doneReturnKeyProps}
            />
            <View style={styles.qtyEditRow}>
              <GlassSurface pointerEvents="none" tint="form" style={StyleSheet.absoluteFillObject} />
              <SpringPressable
                style={styles.qtyBtn}
                onPress={() =>
                  setDraft((prev) =>
                    prev ? { ...prev, quantity: Math.max(1, prev.quantity - 1) } : prev
                  )
                }
                shrink={0.92}
              >
                <GlassSurface pointerEvents="none" tint="form" style={StyleSheet.absoluteFillObject} />
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
              <GlassSurface pointerEvents="none" tint="form" style={StyleSheet.absoluteFillObject} />
              <View style={styles.cardHead}>
                <Ionicons name="file-tray-stacked-outline" size={18} color={colors.textOnGlassMuted} />
                <Text style={styles.cardTitle}>存储位置</Text>
              </View>
              <SpringPressable
                style={styles.locationPickRow}
                onPress={() => setLocationModalOpen(true)}
                shrink={0.99}
                accessibilityRole="button"
                accessibilityLabel="选择存储位置"
              >
                <GlassSurface pointerEvents="none" tint="form" style={StyleSheet.absoluteFillObject} />
                <Text
                  style={[
                    styles.locationPickValue,
                    !(draft.location?.trim()) && styles.locationPickPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {draft.location?.trim()
                    ? draft.locationDetail?.trim()
                      ? `${draft.location.trim()} · ${draft.locationDetail.trim()}`
                      : draft.location.trim()
                    : '选择位置'}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textOnGlassMuted} />
              </SpringPressable>
            </View>

            <View style={styles.card}>
              <GlassSurface pointerEvents="none" tint="form" style={StyleSheet.absoluteFillObject} />
              <View style={styles.cardHead}>
                <Ionicons name="document-text-outline" size={18} color={colors.textOnGlassMuted} />
                <Text style={styles.cardTitle}>备注信息</Text>
              </View>
              <TextInput
                style={styles.inputNotes}
                value={draft.notes ?? ''}
                onChangeText={(t) =>
                  setDraft((prev) => (prev ? { ...prev, notes: t || undefined } : prev))
                }
                placeholder="备注"
                placeholderTextColor={colors.textOnGlassMuted}
                multiline
                textAlignVertical="top"
                {...doneReturnKeyProps}
              />
            </View>

            {isSimilarInbound ? (
              <SpringPressable
                style={[styles.confirmBtn, savedToastVisible && styles.confirmBtnDisabled]}
                onPress={saveEdit}
                shrink={0.98}
                disabled={savedToastVisible}
              >
                <Text style={styles.confirmText}>确认并录入仓库</Text>
              </SpringPressable>
            ) : (
              <SpringPressable style={styles.removeBtn} onPress={confirmRemove} shrink={0.98}>
                <Ionicons name="trash-outline" size={22} color={colors.onPrimary} />
                <Text style={styles.removeBtnText}>移除物品</Text>
              </SpringPressable>
            )}
          </>
        ) : (
          <>
            <Text style={styles.catLabel}>分组 · {itemDisplayGroup(d)}</Text>
            <Text style={styles.codeLine}>编号 {d.codeLabel}</Text>
            <Text style={styles.itemTitle}>{d.name}</Text>

            <View style={styles.qtyReadonly}>
              <GlassSurface pointerEvents="none" tint="form" style={StyleSheet.absoluteFillObject} />
              <Text style={styles.qtyText}>{d.quantity} 件</Text>
            </View>

            <View style={styles.card}>
              <GlassSurface pointerEvents="none" tint="form" style={StyleSheet.absoluteFillObject} />
              <View style={styles.cardHead}>
                <Ionicons name="file-tray-stacked-outline" size={18} color={colors.textOnGlassMuted} />
                <Text style={styles.cardTitle}>存储位置</Text>
              </View>
              <Text style={styles.cardMain}>
                {d.location
                  ? d.locationDetail
                    ? `${d.location} · ${d.locationDetail}`
                    : d.location
                  : '未设置'}
              </Text>
              {!d.location ? (
                <Text style={styles.cardSub}>可在录入时补充架位信息。</Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <GlassSurface pointerEvents="none" tint="form" style={StyleSheet.absoluteFillObject} />
              <View style={styles.cardHead}>
                <Ionicons name="document-text-outline" size={18} color={colors.textOnGlassMuted} />
                <Text style={styles.cardTitle}>备注信息</Text>
              </View>
              <Text style={styles.notes}>{d.notes ?? '暂无备注。'}</Text>
            </View>
          </>
        )}
      </ScrollView>
      <LocationPickerModal
        visible={locationModalOpen}
        rooms={rooms}
        storageEquipment={storageEquipment}
        storageEquipmentImages={storageEquipmentImages}
        initialRoom={draft?.location ?? ''}
        initialEquipment={draft?.locationDetail ?? ''}
        onClose={() => setLocationModalOpen(false)}
        onAddRoom={addRoom}
        onRenameRoom={renameRoom}
        onAddStorageEquipment={addStorageEquipment}
        onRenameStorageEquipment={renameStorageEquipment}
        onConfirm={({ room, equipment, skipped }) => {
          setDraft((prev) =>
            prev
              ? {
                  ...prev,
                  location: skipped || !room.trim() ? undefined : room.trim(),
                  locationDetail:
                    skipped || !equipment.trim() ? undefined : equipment.trim(),
                }
              : prev
          );
          setLocationModalOpen(false);
        }}
      />
      <Modal
        visible={groupModalOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={() => setGroupModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setGroupModalOpen(false)}>
          <Pressable
            style={[styles.modalCard, { paddingBottom: 16 + insets.bottom }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>新建分组</Text>
            <View style={[styles.modalInput, styles.modalInputSolid]}>
              <TextInput
                style={styles.modalInputText}
                placeholder="分组名称"
                placeholderTextColor={colors.textOnGlassMuted}
                value={newGroupInput}
                onChangeText={setNewGroupInput}
                autoFocus
                {...doneReturnKeyProps}
              />
            </View>
            <View style={styles.modalActions}>
              <SpringPressable
                style={[styles.modalBtnGhost, styles.modalBtnGhostSolid]}
                onPress={() => setGroupModalOpen(false)}
                shrink={0.96}
              >
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
  root: { flex: 1, backgroundColor: 'transparent' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  missingText: { fontSize: 16, color: colors.textOnGlassMuted },
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
  navCenter: { flex: 1 },
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
    color: colors.textOnGlass,
  },
  logoEntry: {
    fontFamily: fonts.extraBold,
    fontSize: 17,
    letterSpacing: 0,
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  confirmBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.surface,
    alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.55 },
  confirmText: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 16 },
  gallery: { marginVertical: 8 },
  galleryImg: { borderRadius: radius.surface, backgroundColor: 'rgba(58, 74, 90, 0.15)', marginRight: 10 },
  galleryMain: { width: 280, height: 200 },
  gallerySide: { width: 100, height: 200 },
  galleryTap: { marginVertical: 8, alignSelf: 'flex-start' },
  galleryMainSingle: {
    width: 280,
    height: 200,
    borderRadius: radius.surface,
    backgroundColor: 'rgba(58, 74, 90, 0.15)',
  },
  galleryTapHint: { marginTop: 6, fontSize: 12, color: colors.textOnGlassMuted },
  catLabel: { marginTop: 8, fontSize: 13, color: colors.textOnGlassMuted },
  codeLine: { marginTop: 4, fontSize: 13, fontFamily: fonts.semiBold, color: colors.textOnGlass },
  itemTitle: { marginTop: 8, fontSize: 28, fontFamily: fonts.extraBold, color: colors.textOnGlass },
  groupLabel: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textOnGlass,
  },
  groupTagsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  groupTag: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.surface,
    overflow: 'hidden',
  },
  groupTagActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  groupTagText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.textOnGlass },
  groupTagTextActive: { color: colors.onPrimary },
  groupTagPlus: {
    width: 44,
    height: 44,
    borderRadius: radius.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
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
  modalTitle: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: colors.modalCardText,
    marginBottom: 14,
  },
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
  inputTitle: {
    marginTop: 8,
    fontSize: 28,
    fontFamily: fonts.extraBold,
    color: colors.textOnGlass,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(58, 74, 90, 0.2)',
  },
  qtyReadonly: {
    marginTop: 20,
    borderRadius: radius.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  qtyEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    borderRadius: radius.surface,
    padding: 10,
    overflow: 'hidden',
  },
  qtyBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  qtyBtnPlus: { backgroundColor: colors.primary },
  qtyBtnText: { fontSize: 22, color: colors.textOnGlass, fontFamily: fonts.medium },
  qtyBtnPlusText: { color: colors.onPrimary },
  qtyText: { fontSize: 18, fontFamily: fonts.bold, color: colors.textOnGlass },
  card: {
    marginTop: 14,
    borderRadius: radius.surface,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.textOnGlass },
  cardMain: { fontSize: 17, fontFamily: fonts.bold, color: colors.textOnGlass },
  cardSub: { marginTop: 6, fontSize: 13, color: colors.textOnGlassMuted, lineHeight: 20 },
  locationPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(58, 74, 90, 0.16)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
    overflow: 'hidden',
  },
  locationPickValue: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.textOnGlass,
    marginRight: 8,
  },
  locationPickPlaceholder: {
    color: colors.textOnGlassMuted,
    fontFamily: fonts.regular,
  },
  inputNotes: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textOnGlass,
    lineHeight: 22,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  notes: { fontSize: 14, color: colors.textOnGlass, lineHeight: 22 },
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
