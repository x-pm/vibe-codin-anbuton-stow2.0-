import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SpringPressable } from '../components/SpringPressable';
import { FormSheetBackground } from '../components/FormSheetBackground';
import { DEFAULT_AVATAR } from '../constants/defaultImages';
import { useAppData } from '../context/DataContext';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { radius } from '../theme/radius';
import { doneReturnKeyProps } from '../utils/inputKeyboard';
import { playSaveSuccess } from '../services/sfx';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { profileDisplayName, profileAvatarUri, updateProfile } = useAppData();
  const [nameDraft, setNameDraft] = useState(profileDisplayName);
  const [avatarDraft, setAvatarDraft] = useState<string | undefined>(profileAvatarUri);

  useFocusEffect(
    useCallback(() => {
      setNameDraft(profileDisplayName);
      setAvatarDraft(profileAvatarUri);
    }, [profileDisplayName, profileAvatarUri])
  );

  const previewSource = avatarDraft?.trim() ? { uri: avatarDraft } : DEFAULT_AVATAR;

  const promptChangeAvatar = useCallback(() => {
    Alert.alert('更换头像', undefined, [
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
            setAvatarDraft(res.assets[0].uri);
          })();
        },
      },
      {
        text: '从相册选择',
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
            setAvatarDraft(res.assets[0].uri);
          })();
        },
      },
      {
        text: '恢复默认',
        onPress: () => setAvatarDraft(undefined),
      },
      { text: '取消', style: 'cancel' },
    ]);
  }, []);

  const onSave = useCallback(() => {
    const t = nameDraft.trim();
    if (!t) {
      Alert.alert('提示', '昵称不能为空。');
      return;
    }
    updateProfile({
      displayName: t,
      avatarUri: avatarDraft === undefined ? null : avatarDraft,
    });
    playSaveSuccess();
    navigation.goBack();
  }, [avatarDraft, nameDraft, navigation, updateProfile]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <FormSheetBackground />
      <View style={styles.header}>
        <SpringPressable onPress={() => navigation.goBack()} style={styles.headerSide} shrink={0.9}>
          <Ionicons name="chevron-back" size={26} color={colors.textOnGlass} />
        </SpringPressable>
        <Text style={styles.headerTitle}>编辑资料</Text>
        <SpringPressable onPress={onSave} style={styles.headerSide} shrink={0.92}>
          <Text style={styles.saveLabel}>保存</Text>
        </SpringPressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <SpringPressable style={styles.avatarTap} onPress={promptChangeAvatar} shrink={0.98}>
          <Image source={previewSource} style={styles.avatar} />
          <View style={styles.avatarBadge}>
            <Ionicons name="camera" size={16} color={colors.onPrimary} />
          </View>
        </SpringPressable>
        <Text style={styles.avatarHint}>点击头像更换</Text>

        <Text style={styles.fieldLabel}>昵称</Text>
        <TextInput
          style={styles.input}
          value={nameDraft}
          onChangeText={setNameDraft}
          placeholder="输入昵称"
          placeholderTextColor={colors.textOnGlassMuted}
          maxLength={32}
          autoCorrect={false}
          {...doneReturnKeyProps}
        />
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
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(58, 74, 90, 0.18)',
  },
  headerSide: {
    minWidth: 56,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: { fontSize: 17, fontFamily: fonts.extraBold, color: colors.textOnGlass },
  saveLabel: { fontSize: 16, fontFamily: fonts.bold, color: colors.primary },
  scroll: { paddingHorizontal: 24, paddingTop: 28 },
  avatarTap: {
    alignSelf: 'center',
    position: 'relative',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: radius.circle120,
    backgroundColor: 'rgba(58, 74, 90, 0.15)',
  },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 36,
    height: 36,
    borderRadius: radius.circle36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  avatarHint: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 13,
    color: colors.textOnGlassMuted,
  },
  fieldLabel: {
    marginTop: 32,
    marginBottom: 8,
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textOnGlassMuted,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: 'rgba(58, 74, 90, 0.18)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    fontFamily: fonts.semiBold,
    color: colors.textOnGlass,
  },
});
