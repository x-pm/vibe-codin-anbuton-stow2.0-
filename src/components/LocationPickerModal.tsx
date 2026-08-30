import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STORAGE_EQUIPMENT_IMAGES, type StorageEquipment } from '../constants/storageLocations';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { radius } from '../theme/radius';
import { GlassSurface } from './GlassSurface';
import { SpringPressable } from './SpringPressable';
import { dismissKeyboard } from '../utils/inputKeyboard';

export type LocationPickerValue = {
  room: string;
  equipment: string;
  /** 勾选「无」时为 true，此时 room/equipment 为空 */
  skipped?: boolean;
};

type OpenMenu = 'room' | 'equipment' | null;
type EditorKind = 'room' | 'equipment' | null;

type Props = {
  visible: boolean;
  rooms: string[];
  storageEquipment: string[];
  storageEquipmentImages?: Record<string, string>;
  initialRoom?: string;
  initialEquipment?: string;
  onClose: () => void;
  onConfirm: (value: LocationPickerValue) => void;
  onAddRoom: (name: string) => void;
  onRenameRoom: (from: string, to: string) => void;
  onAddStorageEquipment: (name: string, imageUri?: string) => void;
  onRenameStorageEquipment: (from: string, to: string) => void;
};

const DROPDOWN_MAX_HEIGHT = 220;
const OPTION_ROW_HEIGHT = 48;

function equipmentImageSource(
  name: string,
  customImages?: Record<string, string>
): ImageSourcePropType | undefined {
  const custom = customImages?.[name]?.trim();
  if (custom) return { uri: custom };
  return STORAGE_EQUIPMENT_IMAGES[name as StorageEquipment];
}

export function LocationPickerModal({
  visible,
  rooms,
  storageEquipment,
  storageEquipmentImages,
  initialRoom = '',
  initialEquipment = '',
  onClose,
  onConfirm,
  onAddRoom,
  onRenameRoom,
  onAddStorageEquipment,
  onRenameStorageEquipment,
}: Props) {
  const insets = useSafeAreaInsets();
  const [room, setRoom] = useState(initialRoom);
  const [equipment, setEquipment] = useState(initialEquipment);
  const [skipLocation, setSkipLocation] = useState(false);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [editorKind, setEditorKind] = useState<EditorKind>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [renameTarget, setRenameTarget] = useState('');
  const [equipmentImageDraft, setEquipmentImageDraft] = useState<string | undefined>();

  useEffect(() => {
    if (!visible) return;
    setRoom(initialRoom);
    setEquipment(initialEquipment);
    setSkipLocation(false);
    setOpenMenu(null);
    setEditorKind(null);
    setNameDraft('');
    setRenameTarget('');
    setEquipmentImageDraft(undefined);
  }, [visible, initialRoom, initialEquipment]);

  useEffect(() => {
    if (skipLocation) return;
    if (room && !rooms.includes(room) && rooms.length > 0) {
      setRoom(rooms.includes(initialRoom) ? initialRoom : rooms[0] ?? '');
    }
  }, [rooms, room, initialRoom, skipLocation]);

  const toggleMenu = (menu: Exclude<OpenMenu, null>) => {
    if (skipLocation) return;
    Keyboard.dismiss();
    setEditorKind(null);
    setRenameTarget('');
    setNameDraft('');
    setOpenMenu((prev) => (prev === menu ? null : menu));
  };

  const pickRoom = (name: string) => {
    setRoom(name);
    setSkipLocation(false);
    setOpenMenu(null);
    setEditorKind(null);
    setRenameTarget('');
  };

  const pickEquipment = (name: string) => {
    setEquipment(name);
    setSkipLocation(false);
    setOpenMenu(null);
    setEditorKind(null);
    setRenameTarget('');
  };

  const toggleSkipLocation = () => {
    setSkipLocation((prev) => {
      const next = !prev;
      if (next) {
        setOpenMenu(null);
        setEditorKind(null);
        setRenameTarget('');
        setNameDraft('');
        setEquipmentImageDraft(undefined);
      }
      return next;
    });
  };

  const startAddRoom = () => {
    Keyboard.dismiss();
    setRenameTarget('');
    setNameDraft('');
    setEditorKind('room');
  };

  const startRenameRoom = (name: string) => {
    Keyboard.dismiss();
    setRenameTarget(name);
    setNameDraft(name);
    setEditorKind('room');
  };

  const startAddEquipment = () => {
    Keyboard.dismiss();
    setRenameTarget('');
    setNameDraft('');
    setEquipmentImageDraft(undefined);
    setEditorKind('equipment');
  };

  const startRenameEquipment = (name: string) => {
    Keyboard.dismiss();
    setRenameTarget(name);
    setNameDraft(name);
    setEquipmentImageDraft(storageEquipmentImages?.[name]);
    setEditorKind('equipment');
  };

  const promptEquipmentPhoto = useCallback(() => {
    Alert.alert(
      equipmentImageDraft ? '更换储物照片' : '上传储物照片',
      '拍下或选择这个储物位置的样子',
      [
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
              setEquipmentImageDraft(res.assets[0].uri);
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
              setEquipmentImageDraft(res.assets[0].uri);
            })();
          },
        },
        { text: '取消', style: 'cancel' },
      ]
    );
  }, [equipmentImageDraft]);

  const commitEditor = () => {
    const t = nameDraft.trim();
    if (!t || !editorKind) return;
    if (editorKind === 'room') {
      if (renameTarget) {
        onRenameRoom(renameTarget, t);
        setRoom(t);
      } else {
        onAddRoom(t);
        setRoom(t);
      }
    } else {
      const photo = equipmentImageDraft?.trim();
      if (renameTarget) {
        onRenameStorageEquipment(renameTarget, t);
        setEquipment(t);
        if (photo) onAddStorageEquipment(t, photo);
      } else {
        onAddStorageEquipment(t, photo || undefined);
        setEquipment(t);
      }
    }
    setEditorKind(null);
    setNameDraft('');
    setRenameTarget('');
    setEquipmentImageDraft(undefined);
  };

  const cancelEditor = () => {
    setEditorKind(null);
    setNameDraft('');
    setRenameTarget('');
    setEquipmentImageDraft(undefined);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { paddingBottom: 14 + insets.bottom }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.head}>
            <Text style={styles.title}>存储位置</Text>
            <SpringPressable onPress={onClose} style={styles.closeBtn} shrink={0.9}>
              <Ionicons name="close" size={22} color={colors.modalCardText} />
            </SpringPressable>
          </View>

          <SpringPressable
            style={styles.skipRow}
            onPress={toggleSkipLocation}
            shrink={0.98}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: skipLocation }}
            accessibilityLabel="无"
          >
            <View style={[styles.skipCheck, skipLocation && styles.skipCheckOn]}>
              {skipLocation ? (
                <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
              ) : null}
            </View>
            <Text style={styles.skipLabel}>无</Text>
          </SpringPressable>

          {/* 一级：房间 */}
          <View style={[styles.fieldBlock, skipLocation && styles.fieldsDisabled]}>
            <SpringPressable
              style={styles.row}
              onPress={() => toggleMenu('room')}
              shrink={0.99}
              disabled={skipLocation}
              accessibilityRole="button"
              accessibilityLabel="选择房间"
            >
              <GlassSurface pointerEvents="none" tint="form" style={StyleSheet.absoluteFillObject} />
              <Text style={styles.rowLabel}>房间</Text>
              <Text style={[styles.rowValue, !room && styles.rowPlaceholder]} numberOfLines={1}>
                {skipLocation ? '无' : room || '请选择'}
              </Text>
              <Ionicons
                name={openMenu === 'room' ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.modalCardMuted}
              />
            </SpringPressable>

            {openMenu === 'room' && !skipLocation ? (
              <View style={styles.dropdown}>
                <GlassSurface pointerEvents="none" tint="form" style={StyleSheet.absoluteFillObject} />
                <ScrollView
                  style={styles.dropdownScroll}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                >
                  {rooms.map((r) => {
                    const active = room === r;
                    return (
                      <Pressable
                        key={r}
                        style={[styles.optionRow, active && styles.optionRowActive]}
                        onPress={() => pickRoom(r)}
                        onLongPress={() => startRenameRoom(r)}
                        accessibilityRole="button"
                        accessibilityLabel={`${r}${active ? '，已选中' : ''}，长按可改名`}
                      >
                        <Text
                          style={[styles.optionText, active && styles.optionTextActive]}
                          numberOfLines={1}
                        >
                          {r}
                        </Text>
                        {active ? (
                          <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                  <Pressable
                    style={styles.optionRow}
                    onPress={startAddRoom}
                    accessibilityRole="button"
                    accessibilityLabel="添加房间"
                  >
                    <Text style={styles.optionAddText}>添加房间…</Text>
                  </Pressable>
                </ScrollView>

                {editorKind === 'room' ? (
                  <View style={styles.editorBox}>
                    <GlassSurface pointerEvents="none" tint="form" style={StyleSheet.absoluteFillObject} />
                    <Text style={styles.editorLabel}>
                      {renameTarget ? `重命名「${renameTarget}」` : '新建房间'}
                    </Text>
                    <View style={styles.editorInput}>
                      <TextInput
                        style={styles.editorInputText}
                        placeholder="输入房间名称"
                        placeholderTextColor={colors.modalCardMuted}
                        value={nameDraft}
                        onChangeText={setNameDraft}
                        autoFocus
                        returnKeyType="done"
                        blurOnSubmit
                        showSoftInputOnFocus
                        onSubmitEditing={dismissKeyboard}
                        accessibilityLabel="房间名称"
                      />
                    </View>
                    <View style={styles.editorActions}>
                      <SpringPressable style={styles.ghostBtn} onPress={cancelEditor} shrink={0.96}>
                        <Text style={styles.ghostBtnText}>取消</Text>
                      </SpringPressable>
                      <SpringPressable style={styles.primaryBtn} onPress={commitEditor} shrink={0.96}>
                        <Text style={styles.primaryBtnText}>
                          {renameTarget ? '保存' : '添加'}
                        </Text>
                      </SpringPressable>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* 二级：储物设备 */}
          <View style={[styles.fieldBlock, skipLocation && styles.fieldsDisabled]}>
            <SpringPressable
              style={styles.row}
              onPress={() => toggleMenu('equipment')}
              shrink={0.99}
              disabled={skipLocation}
              accessibilityRole="button"
              accessibilityLabel="选择储物设备"
            >
              <GlassSurface pointerEvents="none" tint="form" style={StyleSheet.absoluteFillObject} />
              <Text style={styles.rowLabel}>储物</Text>
              <Text
                style={[styles.rowValue, !equipment && styles.rowPlaceholder]}
                numberOfLines={1}
              >
                {skipLocation ? '无' : equipment || '请选择'}
              </Text>
              <Ionicons
                name={openMenu === 'equipment' ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.modalCardMuted}
              />
            </SpringPressable>

            {openMenu === 'equipment' && !skipLocation ? (
              <View style={styles.dropdown}>
                <GlassSurface pointerEvents="none" tint="form" style={StyleSheet.absoluteFillObject} />
                <ScrollView
                  style={styles.dropdownScroll}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                >
                  {storageEquipment.map((eq) => {
                    const active = equipment === eq;
                    const thumb = equipmentImageSource(eq, storageEquipmentImages);
                    const customPhoto = Boolean(storageEquipmentImages?.[eq]);
                    return (
                      <Pressable
                        key={eq}
                        style={[styles.optionRow, active && styles.optionRowActive]}
                        onPress={() => pickEquipment(eq)}
                        onLongPress={() => startRenameEquipment(eq)}
                        accessibilityRole="button"
                        accessibilityLabel={`${eq}${active ? '，已选中' : ''}，长按可改名`}
                      >
                        <Text
                          style={[styles.optionText, active && styles.optionTextActive]}
                          numberOfLines={1}
                        >
                          {eq}
                        </Text>
                        {active ? (
                          <Ionicons
                            name="checkmark"
                            size={18}
                            color={colors.onPrimary}
                            style={styles.optionCheck}
                          />
                        ) : null}
                        {thumb ? (
                          <Image
                            source={thumb}
                            style={styles.optionThumb}
                            resizeMode={customPhoto ? 'cover' : 'contain'}
                          />
                        ) : (
                          <View style={styles.optionThumbPlaceholder}>
                            <Ionicons
                              name="cube-outline"
                              size={18}
                              color={active ? colors.onPrimary : colors.textMuted}
                            />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                  <Pressable
                    style={styles.optionRow}
                    onPress={startAddEquipment}
                    accessibilityRole="button"
                    accessibilityLabel="添加储物设备"
                  >
                    <Text style={styles.optionAddText}>添加储物…</Text>
                  </Pressable>
                </ScrollView>

                {editorKind === 'equipment' ? (
                  <View style={styles.editorBox}>
                    <GlassSurface pointerEvents="none" tint="form" style={StyleSheet.absoluteFillObject} />
                    <Text style={styles.editorLabel}>
                      {renameTarget ? `重命名「${renameTarget}」` : '新建储物'}
                    </Text>
                    <View style={styles.editorInputRow}>
                      <TextInput
                        style={styles.editorInputText}
                        placeholder="输入储物名称"
                        placeholderTextColor={colors.modalCardMuted}
                        value={nameDraft}
                        onChangeText={setNameDraft}
                        autoFocus
                        returnKeyType="done"
                        blurOnSubmit
                        showSoftInputOnFocus
                        onSubmitEditing={dismissKeyboard}
                        accessibilityLabel="储物名称"
                      />
                      <Pressable
                        onPress={promptEquipmentPhoto}
                        style={styles.editorPhotoBtn}
                        accessibilityRole="button"
                        accessibilityLabel="上传储物位置照片"
                      >
                        {equipmentImageDraft ? (
                          <Image
                            source={{ uri: equipmentImageDraft }}
                            style={styles.optionThumb}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.optionThumbPlaceholder}>
                            <Ionicons name="camera-outline" size={18} color={colors.modalCardMuted} />
                          </View>
                        )}
                      </Pressable>
                    </View>
                    <View style={styles.editorActions}>
                      <SpringPressable style={styles.ghostBtn} onPress={cancelEditor} shrink={0.96}>
                        <Text style={styles.ghostBtnText}>取消</Text>
                      </SpringPressable>
                      <SpringPressable style={styles.primaryBtn} onPress={commitEditor} shrink={0.96}>
                        <Text style={styles.primaryBtnText}>
                          {renameTarget ? '保存' : '添加'}
                        </Text>
                      </SpringPressable>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          <SpringPressable
            style={[
              styles.confirmBtn,
              !skipLocation && !room && styles.confirmBtnDisabled,
            ]}
            onPress={() => {
              if (skipLocation) {
                onConfirm({ room: '', equipment: '', skipped: true });
                return;
              }
              if (!room) return;
              onConfirm({ room, equipment, skipped: false });
            }}
            shrink={0.98}
            disabled={!skipLocation && !room}
          >
            <Text style={styles.confirmBtnText}>完成</Text>
          </SpringPressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 28,
    zIndex: 9999,
    elevation: 24,
  },
  card: {
    backgroundColor: colors.modalCardBg,
    borderRadius: radius.surface,
    paddingTop: 14,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: { fontSize: 17, fontFamily: fonts.extraBold, color: colors.modalCardText },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  skipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 40,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  skipCheck: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(58, 74, 90, 0.35)',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipCheckOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  skipLabel: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.modalCardText,
  },
  fieldBlock: { marginBottom: 8 },
  fieldsDisabled: { opacity: 0.4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(58, 74, 90, 0.18)',
    overflow: 'hidden',
    borderRadius: radius.surface,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  rowLabel: {
    width: 40,
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.modalCardMuted,
  },
  rowValue: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.modalCardText,
    marginRight: 8,
  },
  rowPlaceholder: {
    color: colors.modalCardMuted,
    fontFamily: fonts.regular,
  },
  dropdown: {
    marginTop: -1,
    borderWidth: 1,
    borderColor: 'rgba(58, 74, 90, 0.18)',
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderRadius: radius.surface,
  },
  dropdownScroll: {
    maxHeight: DROPDOWN_MAX_HEIGHT,
  },
  optionRow: {
    height: OPTION_ROW_HEIGHT,
    minHeight: OPTION_ROW_HEIGHT,
    maxHeight: OPTION_ROW_HEIGHT,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(58, 74, 90, 0.12)',
    width: '100%',
    overflow: 'hidden',
  },
  optionRowActive: {
    backgroundColor: colors.primary,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.modalCardText,
    marginRight: 8,
  },
  optionTextActive: {
    color: colors.onPrimary,
    fontFamily: fonts.bold,
  },
  optionCheck: {
    marginRight: 8,
  },
  optionThumb: {
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: 6,
    backgroundColor: 'rgba(58, 74, 90, 0.06)',
  },
  optionThumbPlaceholder: {
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(58, 74, 90, 0.06)',
  },
  optionAddText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.modalCardMuted,
  },
  editorBox: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(58, 74, 90, 0.12)',
    overflow: 'hidden',
    backgroundColor: 'rgba(236, 242, 248, 0.98)',
  },
  editorLabel: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.modalCardMuted,
    marginBottom: 8,
  },
  editorInput: {
    borderWidth: 1,
    borderColor: 'rgba(58, 74, 90, 0.18)',
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: radius.surface,
  },
  editorInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(58, 74, 90, 0.18)',
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: radius.surface,
    paddingRight: 8,
  },
  editorInputText: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.modalCardText,
  },
  editorPhotoBtn: {
    width: 32,
    height: 32,
    flexShrink: 0,
  },
  editorActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  ghostBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(58, 74, 90, 0.2)',
    overflow: 'hidden',
    borderRadius: radius.surface,
    backgroundColor: '#fff',
  },
  ghostBtnText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.modalCardText },
  primaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.surface,
  },
  primaryBtnText: { fontSize: 14, fontFamily: fonts.bold, color: colors.onPrimary },
  confirmBtn: {
    marginTop: 10,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: radius.surface,
  },
  confirmBtnDisabled: { opacity: 0.45 },
  confirmBtnText: { fontSize: 15, fontFamily: fonts.bold, color: colors.onPrimary },
});
