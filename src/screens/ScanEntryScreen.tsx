import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  InteractionManager,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SpringPressable } from '../components/SpringPressable';
import type { RootStackParamList } from '../navigation/types';
import type { ItemFormPreset } from '../types/models';
import { safeLeaveToPreviousOrHome } from '../navigation/safeNavigate';
import { fetchLinkContent } from '../services/fetchLink';
import {
  isSiliconflowConfigured,
  parseItemFieldsFromImageDataUri,
  parseItemFieldsFromText,
} from '../services/aiParse';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { radius } from '../theme/radius';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ScanEntryRoute = RouteProp<RootStackParamList, 'ScanEntry'>;

/** 与链接录入弹窗一致的居中卡片样式 */
const pickStyles = StyleSheet.create({
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
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radius.surface,
    backgroundColor: colors.primary,
  },
  primaryBtnDisabled: { opacity: 0.75 },
  primaryBtnText: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 16 },
  hint: {
    marginTop: 14,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    textAlign: 'center',
  },
  entryHint: {
    marginBottom: 14,
    fontSize: 13,
    lineHeight: 20,
    color: colors.primary,
    fontFamily: fonts.semiBold,
    textAlign: 'center',
  },
});

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`${label}超时（${Math.round(ms / 1000)} 秒），请重试。`)),
      ms
    );
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

/** 未配置 AI：不把扫码原文写入「备注」；纯数字条码写入 sku，否则把截断原文作为名称便于手改 */
function presetFromScanWithoutAi(raw: string): ItemFormPreset {
  const trimmed = raw.trim();
  if (/^\d{8,14}$/.test(trimmed)) {
    return { sku: trimmed };
  }
  return { name: trimmed.slice(0, 80) };
}

const FALLBACK_CROP_NORM = { l: 0.08, t: 0.08, r: 0.92, b: 0.92 };
const CROP_MIN_FRAC = 0.06;
const CROP_HANDLE = 36;

/** 须与下方 `styles.cropHintWrap.bottom` 使用同一数值 */
const CROP_HINT_WRAP_BOTTOM = 112;
const CROP_HINT_TEXT_BLOCK = 52;
const CROP_TOP_BAR_PAD_BELOW_STATUS = 8;
const CROP_TOP_BTN = 44;
const CROP_SIDE_PAD = 14;

type CropNorm = typeof FALLBACK_CROP_NORM;
type DisplayMetrics = { ox: number; oy: number; dw: number; dh: number; iw: number; ih: number; cw: number; ch: number };

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * 默认框选在预览坐标系内避开顶部返回/关闭、底部说明文案与按钮区，角点留出拖拽空间。
 * cropNorm 相对于「contain」后的图片矩形 (ox,oy,dw,dh)。
 */
function computeSafeDefaultCrop(
  m: DisplayMetrics,
  insets: { top: number; bottom: number }
): CropNorm {
  const { ox, oy, dw, dh, cw, ch } = m;
  const handleBleed = CROP_HANDLE / 2 + 8;

  const topSafeY = insets.top + CROP_TOP_BAR_PAD_BELOW_STATUS + CROP_TOP_BTN + handleBleed;
  const bottomSafeY =
    ch - (CROP_HINT_WRAP_BOTTOM + CROP_HINT_TEXT_BLOCK + CROP_SIDE_PAD + handleBleed);

  let t = (topSafeY - oy) / dh;
  let b = (bottomSafeY - oy) / dh;
  let l = (handleBleed + 12 - ox) / dw;
  let r = (cw - handleBleed - 12 - ox) / dw;

  const MIN = CROP_MIN_FRAC;

  t = clamp(t, 0, 1);
  b = clamp(b, MIN, 1);
  l = clamp(l, 0, 1);
  r = clamp(r, MIN, 1);

  if (b - t < MIN) {
    const mid = clamp((t + b) / 2, MIN / 2, 1 - MIN / 2);
    t = mid - MIN / 2;
    b = mid + MIN / 2;
  }
  if (r - l < MIN) {
    const mid = clamp((l + r) / 2, MIN / 2, 1 - MIN / 2);
    l = mid - MIN / 2;
    r = mid + MIN / 2;
  }

  if (t >= b - 1e-6 || l >= r - 1e-6) {
    return FALLBACK_CROP_NORM;
  }

  return { l, t, r, b };
}

function applyCornerPan(anchor: 'tl' | 'tr' | 'bl' | 'br', start: CropNorm, dl: number, dt: number): CropNorm {
  const MIN = CROP_MIN_FRAC;
  let { l, t, r, b } = start;
  switch (anchor) {
    case 'tl':
      l = clamp(l + dl, 0, r - MIN);
      t = clamp(t + dt, 0, b - MIN);
      break;
    case 'tr':
      r = clamp(r + dl, l + MIN, 1);
      t = clamp(t + dt, 0, b - MIN);
      break;
    case 'bl':
      l = clamp(l + dl, 0, r - MIN);
      b = clamp(b + dt, t + MIN, 1);
      break;
    case 'br':
      r = clamp(r + dl, l + MIN, 1);
      b = clamp(b + dt, t + MIN, 1);
      break;
    default:
      break;
  }
  return { l, t, r, b };
}

function useCropCornerGesture(
  anchor: 'tl' | 'tr' | 'bl' | 'br',
  metricsRef: React.MutableRefObject<DisplayMetrics | null>,
  cropRef: React.MutableRefObject<CropNorm>,
  setCropNorm: React.Dispatch<React.SetStateAction<CropNorm>>
) {
  const startCropRef = useRef<CropNorm>(FALLBACK_CROP_NORM);
  return useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onStart(() => {
          startCropRef.current = { ...cropRef.current };
        })
        .onUpdate((e) => {
          const m = metricsRef.current;
          if (!m) return;
          const dl = e.translationX / m.dw;
          const dt = e.translationY / m.dh;
          setCropNorm(() => applyCornerPan(anchor, startCropRef.current, dl, dt));
        }),
    [anchor, cropRef, metricsRef, setCropNorm]
  );
}

export function ScanEntryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<ScanEntryRoute>();
  const entryHint = route.params?.entryHint;
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<InstanceType<typeof CameraView> | null>(null);
  const scannedRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  /** 先进与链接录入一致的弹窗；「拍照」后再进入取景 */
  const [mode, setMode] = useState<'chooser' | 'camera'>('chooser');
  /** expo-camera：0～1，相对设备最大变焦 */
  const [zoom, setZoom] = useState(0);
  const zoomRef = useRef(0);
  const pinchStartZoomRef = useRef(0);
  /** 拍照成功后定格在界面上的预览图（用户调整裁剪框并点「确定」后再识别） */
  const [capturedPreviewUri, setCapturedPreviewUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [cropNorm, setCropNorm] = useState<CropNorm>(FALLBACK_CROP_NORM);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [imageNatural, setImageNatural] = useState<{ w: number; h: number } | null>(null);
  const [cropping, setCropping] = useState(false);
  /** 每张图根据预览尺寸只自动套一次安全默认框，避免拖动后被 layout 覆盖 */
  const appliedCropLayoutKeyRef = useRef('');

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    if (capturedPreviewUri) {
      setCameraReady(false);
    }
  }, [capturedPreviewUri]);

  const clearCapturePreview = useCallback(() => {
    setCapturedPreviewUri(null);
    setCropNorm(FALLBACK_CROP_NORM);
    appliedCropLayoutKeyRef.current = '';
    setImageNatural(null);
    setContainerSize({ w: 0, h: 0 });
  }, []);

  useEffect(() => {
    if (!capturedPreviewUri) {
      setImageNatural(null);
      return;
    }
    Image.getSize(
      capturedPreviewUri,
      (w, h) => {
        if (w > 0 && h > 0) setImageNatural({ w, h });
        else setImageNatural(null);
      },
      () => setImageNatural(null)
    );
  }, [capturedPreviewUri]);

  const displayMetrics = useMemo((): DisplayMetrics | null => {
    const cw = containerSize.w;
    const ch = containerSize.h;
    if (!imageNatural || cw < 8 || ch < 8) return null;
    const { w: iw, h: ih } = imageNatural;
    const scale = Math.min(cw / iw, ch / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const ox = (cw - dw) / 2;
    const oy = (ch - dh) / 2;
    return { ox, oy, dw, dh, iw, ih, cw, ch };
  }, [containerSize, imageNatural]);

  useEffect(() => {
    if (!capturedPreviewUri || !displayMetrics) return;
    const key = `${capturedPreviewUri}|${displayMetrics.iw}x${displayMetrics.ih}|${displayMetrics.cw}x${displayMetrics.ch}`;
    if (appliedCropLayoutKeyRef.current === key) return;
    appliedCropLayoutKeyRef.current = key;
    setCropNorm(computeSafeDefaultCrop(displayMetrics, insets));
  }, [capturedPreviewUri, displayMetrics, insets.top, insets.bottom]);

  const metricsRef = useRef<DisplayMetrics | null>(null);
  metricsRef.current = displayMetrics;

  const cropRef = useRef(cropNorm);
  cropRef.current = cropNorm;

  const onPreviewLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerSize({ w: width, h: height });
  }, []);

  const panTL = useCropCornerGesture('tl', metricsRef, cropRef, setCropNorm);
  const panTR = useCropCornerGesture('tr', metricsRef, cropRef, setCropNorm);
  const panBL = useCropCornerGesture('bl', metricsRef, cropRef, setCropNorm);
  const panBR = useCropCornerGesture('br', metricsRef, cropRef, setCropNorm);

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .runOnJS(true)
        .onStart(() => {
          pinchStartZoomRef.current = zoomRef.current;
        })
        .onUpdate((e) => {
          const next = pinchStartZoomRef.current + (e.scale - 1) * 0.45;
          setZoom(Math.min(1, Math.max(0, next)));
        }),
    []
  );

  const goManual = useCallback(() => {
    navigation.replace('AddItem', undefined);
  }, [navigation]);

  const visionRecognizeFromImageUri = useCallback(
    async (sourceUri: string) => {
      if (busy) return;
      if (!isSiliconflowConfigured()) {
        Alert.alert(
          '未配置 AI 密钥',
          '「拍照/相册识别」需要硅基流动 API Key（.env 中的 EXPO_PUBLIC_SILICONFLOW_API_KEY），并需使用支持视觉的模型（默认 EXPO_PUBLIC_SILICONFLOW_VISION_MODEL）。',
          [
            {
              text: '手动录入',
              onPress: () => {
                clearCapturePreview();
                goManual();
              },
            },
            { text: '关闭', style: 'cancel', onPress: clearCapturePreview },
          ]
        );
        return;
      }
      setBusy(true);
      try {
        const manipulated = await withTimeout(
          ImageManipulator.manipulateAsync(
            sourceUri,
            [{ resize: { width: 960 } }],
            {
              compress: 0.38,
              format: ImageManipulator.SaveFormat.JPEG,
              base64: true,
            }
          ),
          25_000,
          '压缩图片'
        );
        if (!manipulated.base64) {
          throw new Error('图片处理失败，请重试。');
        }

        const dataUri = `data:image/jpeg;base64,${manipulated.base64}`;
        const preset = await parseItemFieldsFromImageDataUri(dataUri);
        navigation.replace('AddItem', {
          preset: { ...preset, localImageUri: manipulated.uri },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : '识别失败';
        InteractionManager.runAfterInteractions(() => {
          Alert.alert('物品识别', msg, [
            {
              text: '手动录入',
              onPress: () => {
                clearCapturePreview();
                goManual();
              },
            },
            { text: '关闭', style: 'cancel', onPress: clearCapturePreview },
          ]);
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, clearCapturePreview, goManual, navigation]
  );

  const captureWithVision = useCallback(async () => {
    if (busy || capturing || cropping) return;
    if (!cameraReady || !cameraRef.current) {
      Alert.alert('请稍候', '请等待相机预览就绪后再试。');
      return;
    }
    setCapturing(true);
    try {
      const cam = cameraRef.current;
      const pic = await withTimeout(
        cam.takePictureAsync({
          base64: false,
          quality: 0.55,
          skipProcessing: false,
        }),
        30_000,
        '拍照'
      );
      if (!pic.uri) {
        throw new Error('未获取到照片，请重试。');
      }
      setCapturedPreviewUri(pic.uri);
    } catch (e) {
      clearCapturePreview();
      const msg = e instanceof Error ? e.message : '拍照失败';
      Alert.alert('拍照', msg);
    } finally {
      setCapturing(false);
    }
  }, [busy, cameraReady, capturing, cropping, clearCapturePreview]);

  const confirmCropAndRecognize = useCallback(async () => {
    if (!capturedPreviewUri || busy || cropping) return;
    setCropping(true);
    try {
      let uploadUri = capturedPreviewUri;
      if (imageNatural) {
        const { w: iw, h: ih } = imageNatural;
        const originX = clamp(Math.floor(cropNorm.l * iw), 0, Math.max(0, iw - 1));
        const originY = clamp(Math.floor(cropNorm.t * ih), 0, Math.max(0, ih - 1));
        let width = Math.max(1, Math.floor((cropNorm.r - cropNorm.l) * iw));
        let height = Math.max(1, Math.floor((cropNorm.b - cropNorm.t) * ih));
        width = Math.min(width, iw - originX);
        height = Math.min(height, ih - originY);
        const cropped = await withTimeout(
          ImageManipulator.manipulateAsync(
            capturedPreviewUri,
            [{ crop: { originX, originY, width, height } }],
            { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
          ),
          15_000,
          '裁剪图片'
        );
        uploadUri = cropped.uri;
      }
      await visionRecognizeFromImageUri(uploadUri);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '裁剪失败';
      InteractionManager.runAfterInteractions(() => {
        Alert.alert('裁剪', msg);
      });
    } finally {
      setCropping(false);
    }
  }, [
    busy,
    capturedPreviewUri,
    cropNorm.b,
    cropNorm.l,
    cropNorm.r,
    cropNorm.t,
    cropping,
    imageNatural,
    visionRecognizeFromImageUri,
  ]);

  const pickFromLibrary = useCallback(async () => {
    if (busy) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('提示', '需要相册权限才能选择照片。请在系统设置中开启。');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });
      if (result.canceled) return;
      const uri = result.assets[0]?.uri;
      if (!uri) {
        Alert.alert('提示', '未选择图片。');
        return;
      }
      await visionRecognizeFromImageUri(uri);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '打开相册失败';
      Alert.alert('相册', msg);
    }
  }, [busy, visionRecognizeFromImageUri]);

  const openCameraMode = useCallback(async () => {
    const res = await requestPermission();
    if (res.granted) {
      setMode('camera');
      return;
    }
    Alert.alert('提示', '需要相机权限才能拍照或扫描条码。');
  }, [requestPermission]);

  const onBarcodeScanned = useCallback(
    (result: { data: string }) => {
      if (scannedRef.current || busy) return;
      scannedRef.current = true;
      const raw = result.data;
      void (async () => {
        setBusy(true);
        try {
          if (!isSiliconflowConfigured()) {
            navigation.replace('AddItem', { preset: presetFromScanWithoutAi(raw) });
            InteractionManager.runAfterInteractions(() => {
              Alert.alert(
                '未配置 AI 密钥',
                '扫描已成功。内容已写入录入页的「备注」；若需自动识别商品名称/分类，请在项目根目录 .env 中配置 EXPO_PUBLIC_SILICONFLOW_API_KEY 后重启 Metro（npx expo start）。',
                [{ text: '知道了' }]
              );
            });
            return;
          }

          let textForAi = raw;
          if (/^https?:\/\//i.test(raw) || raw.includes('http')) {
            try {
              const { html } = await fetchLinkContent(raw);
              textForAi = html.slice(0, 15000);
            } catch {
              textForAi = raw;
            }
          }
          const preset = await parseItemFieldsFromText(textForAi);
          navigation.replace('AddItem', { preset });
        } catch (e) {
          const msg = e instanceof Error ? e.message : '解析失败';
          InteractionManager.runAfterInteractions(() => {
            Alert.alert('提示', msg, [
              {
                text: '仍要手动录入',
                onPress: () =>
                  navigation.replace('AddItem', {
                    preset: { name: raw.slice(0, 80) },
                  }),
              },
              {
                text: '留在本页',
                style: 'cancel',
                onPress: () => {
                  scannedRef.current = false;
                },
              },
              {
                text: '退出扫描',
                onPress: () => safeLeaveToPreviousOrHome(navigation),
              },
            ]);
          });
        } finally {
          setBusy(false);
        }
      })();
    },
    [busy, navigation]
  );

  /** 进入页：与链接录入相同的居中弹窗，仅「拍照」「上传照片」 */
  if (mode === 'chooser') {
    return (
      <KeyboardAvoidingView
        style={[pickStyles.flex, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={pickStyles.overlay}
          onPress={() => safeLeaveToPreviousOrHome(navigation)}
        >
          <View style={pickStyles.card} onStartShouldSetResponder={() => true}>
            {entryHint ? <Text style={pickStyles.entryHint}>{entryHint}</Text> : null}
            <SpringPressable
              style={[pickStyles.primaryBtn, busy && pickStyles.primaryBtnDisabled]}
              shrink={0.98}
              disabled={busy}
              onPress={() => void openCameraMode()}
            >
              <Text style={pickStyles.primaryBtnText}>拍照</Text>
            </SpringPressable>
            <SpringPressable
              style={[pickStyles.primaryBtn, { marginTop: 12 }, busy && pickStyles.primaryBtnDisabled]}
              shrink={0.98}
              disabled={busy}
              onPress={() => void pickFromLibrary()}
            >
              <Text style={pickStyles.primaryBtnText}>上传照片</Text>
            </SpringPressable>
            <Text style={pickStyles.hint}>扫描条码请先点「拍照」进入相机，将码对准画面即可。</Text>
          </View>
        </Pressable>
        {busy ? (
          <View style={styles.busyGlobal}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.busyGlobalText}>稍等，大脑飞速运转中……</Text>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    );
  }

  /** 相机模式（拍照识别 + 条码扫描） */
  if (!permission) {
    return <View style={styles.center} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { paddingTop: insets.top, paddingHorizontal: 24 }]}>
        <Text style={styles.permText}>需要相机权限以扫描条码或拍照。</Text>
        <SpringPressable style={styles.permBtn} onPress={() => void requestPermission()} shrink={0.97}>
          <Text style={styles.permBtnText}>授权相机</Text>
        </SpringPressable>
        <SpringPressable style={styles.secondaryBtn} onPress={() => setMode('chooser')} shrink={0.97}>
          <Text style={styles.secondaryBtnText}>返回</Text>
        </SpringPressable>
      </View>
    );
  }

  const cropPx =
    displayMetrics && imageNatural
      ? {
          L: displayMetrics.ox + cropNorm.l * displayMetrics.dw,
          T: displayMetrics.oy + cropNorm.t * displayMetrics.dh,
          R: displayMetrics.ox + cropNorm.r * displayMetrics.dw,
          B: displayMetrics.oy + cropNorm.b * displayMetrics.dh,
        }
      : null;

  return (
    <View style={styles.root}>
      {capturedPreviewUri ? (
        <View style={styles.previewRoot} onLayout={onPreviewLayout}>
          <Image
            source={{ uri: capturedPreviewUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
          />
          {cropPx && displayMetrics ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              <View
                pointerEvents="none"
                style={[styles.cropDim, { left: 0, top: 0, width: displayMetrics.cw, height: cropPx.T }]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.cropDim,
                  { left: 0, top: cropPx.T, width: cropPx.L, height: cropPx.B - cropPx.T },
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.cropDim,
                  {
                    left: cropPx.R,
                    top: cropPx.T,
                    width: displayMetrics.cw - cropPx.R,
                    height: cropPx.B - cropPx.T,
                  },
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.cropDim,
                  { left: 0, top: cropPx.B, width: displayMetrics.cw, height: displayMetrics.ch - cropPx.B },
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.cropFrame,
                  {
                    left: cropPx.L,
                    top: cropPx.T,
                    width: cropPx.R - cropPx.L,
                    height: cropPx.B - cropPx.T,
                  },
                ]}
              />
              <GestureDetector gesture={panTL}>
                <View
                  style={[
                    styles.cropHandle,
                    { left: cropPx.L - CROP_HANDLE / 2, top: cropPx.T - CROP_HANDLE / 2 },
                  ]}
                />
              </GestureDetector>
              <GestureDetector gesture={panTR}>
                <View
                  style={[
                    styles.cropHandle,
                    { left: cropPx.R - CROP_HANDLE / 2, top: cropPx.T - CROP_HANDLE / 2 },
                  ]}
                />
              </GestureDetector>
              <GestureDetector gesture={panBL}>
                <View
                  style={[
                    styles.cropHandle,
                    { left: cropPx.L - CROP_HANDLE / 2, top: cropPx.B - CROP_HANDLE / 2 },
                  ]}
                />
              </GestureDetector>
              <GestureDetector gesture={panBR}>
                <View
                  style={[
                    styles.cropHandle,
                    { left: cropPx.R - CROP_HANDLE / 2, top: cropPx.B - CROP_HANDLE / 2 },
                  ]}
                />
              </GestureDetector>
            </View>
          ) : null}
          <View style={styles.cropHintWrap} pointerEvents="none">
            <Text style={styles.cropHint}>
              {imageNatural
                ? '拖拽角点调整识别区域，完成后点「确定」上传识别'
                : '载入照片中…'}
            </Text>
          </View>
        </View>
      ) : (
        <GestureDetector gesture={pinchGesture}>
          <View style={StyleSheet.absoluteFill} collapsable={false}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              mode="picture"
              zoom={zoom}
              onCameraReady={() => setCameraReady(true)}
              barcodeScannerSettings={{
                barcodeTypes: [
                  'qr',
                  'ean13',
                  'ean8',
                  'code128',
                  'code39',
                  'code93',
                  'upc_a',
                  'upc_e',
                  'pdf417',
                  'datamatrix',
                  'codabar',
                  'itf14',
                ],
              }}
              onBarcodeScanned={onBarcodeScanned}
            />
          </View>
        </GestureDetector>
      )}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <SpringPressable
          style={styles.roundIconBtn}
          onPress={() => {
            clearCapturePreview();
            setMode('chooser');
          }}
          shrink={0.9}
        >
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </SpringPressable>
        <View style={{ flex: 1 }} />
        <SpringPressable
          style={styles.roundIconBtn}
          onPress={() => {
            clearCapturePreview();
            safeLeaveToPreviousOrHome(navigation);
          }}
          shrink={0.9}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </SpringPressable>
      </View>
      <View
        style={[styles.bottomShutterWrap, { paddingBottom: Math.max(insets.bottom, 24) }]}
        pointerEvents="box-none"
      >
        {capturedPreviewUri ? (
          <View style={styles.cropActionsRow}>
            <SpringPressable
              style={styles.cropGhostBtn}
              shrink={0.96}
              disabled={busy || cropping || capturing}
              onPress={() => clearCapturePreview()}
            >
              <Text style={styles.cropGhostBtnText}>重拍</Text>
            </SpringPressable>
            <SpringPressable
              style={[
                styles.cropPrimaryBtn,
                (!capturedPreviewUri || busy || cropping) && styles.cropPrimaryBtnDisabled,
              ]}
              shrink={0.96}
              disabled={!capturedPreviewUri || busy || cropping}
              onPress={() => void confirmCropAndRecognize()}
            >
              <Text style={styles.cropPrimaryBtnText}>确定</Text>
            </SpringPressable>
          </View>
        ) : (
          <SpringPressable
            accessibilityRole="button"
            accessibilityLabel="拍照"
            onPress={() => void captureWithVision()}
            shrink={0.94}
            disabled={busy || capturing || cropping}
          >
            <View style={styles.shutterOuter}>
              <View style={styles.shutterInner} />
            </View>
          </SpringPressable>
        )}
      </View>
      {busy || cropping ? (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.overlayText}>
            {cropping && !busy ? '正在裁剪…' : '稍等，大脑飞速运转中……'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  busyGlobal: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  busyGlobalText: { marginTop: 12, fontSize: 15, color: colors.text },
  permText: { fontSize: 16, textAlign: 'center', color: colors.text, marginBottom: 20 },
  permBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: radius.surface,
    marginBottom: 12,
  },
  permBtnText: { color: colors.onPrimary, fontFamily: fonts.bold },
  secondaryBtn: { padding: 12 },
  secondaryBtnText: { color: colors.textMuted, fontSize: 15 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  roundIconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.surface,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomShutterWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingTop: 12,
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: radius.surface,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: radius.surface,
    backgroundColor: '#fff',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: { marginTop: 12, color: '#fff', fontSize: 15 },
  previewRoot: { flex: 1, backgroundColor: '#000' },
  cropDim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.52)' },
  cropFrame: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'transparent',
  },
  cropHandle: {
    position: 'absolute',
    width: CROP_HANDLE,
    height: CROP_HANDLE,
    borderRadius: CROP_HANDLE / 2,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  cropHintWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: CROP_HINT_WRAP_BOTTOM,
    alignItems: 'center',
  },
  cropHint: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cropActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 20,
  },
  cropGhostBtn: {
    minWidth: 120,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radius.surface,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
  },
  cropGhostBtnText: { color: '#fff', fontFamily: fonts.semiBold, fontSize: 16 },
  cropPrimaryBtn: {
    minWidth: 120,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radius.surface,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  cropPrimaryBtnDisabled: { opacity: 0.55 },
  cropPrimaryBtnText: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 16 },
});
