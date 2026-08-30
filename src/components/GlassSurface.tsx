import { BlurView } from 'expo-blur';
import React, { type ReactNode } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

/**
 * 极浅蓝半透明：主要靠 BlurView 透底图；蒙层只轻微提亮。
 */
export const glassTint = {
  surface: 'rgba(255, 255, 255, 0.08)',
  cream: 'rgba(232, 240, 248, 0.08)',
  search: 'rgba(255, 255, 255, 0.10)',
  mutedCard: 'rgba(220, 232, 244, 0.08)',
  grey: 'rgba(240, 244, 248, 0.08)',
  /** 表单输入条：近白不透明，保证可读 */
  form: 'rgba(248, 250, 252, 0.98)',
  /** 搜索条：不用 BlurView，避免 iOS 软键盘不弹出 */
  searchSolid: 'rgba(255, 255, 255, 0.88)',
} as const;

export type GlassTintKey = keyof typeof glassTint;

/** 输入类表面不走 BlurView（iOS 下 BlurView 会导致聚焦但软键盘不出现） */
const SOLID_TINTS = new Set<GlassTintKey>(['form', 'search']);

type Props = ViewProps & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  tint?: GlassTintKey | string;
  intensity?: number;
  rim?: boolean;
};

/**
 * 毛玻璃：BlurView 铺底 + 极淡蒙层。不要放进带 opacity/离屏合成的父级里。
 */
export function GlassSurface({
  children,
  style,
  tint = 'surface',
  intensity = 28,
  rim = false,
  ...rest
}: Props) {
  const tintKey = tint in glassTint ? (tint as GlassTintKey) : null;
  const overlay = tintKey ? glassTint[tintKey] : tint;
  const solidSurface =
    tintKey != null && SOLID_TINTS.has(tintKey);
  const solidBg =
    tintKey === 'form'
      ? '#F8FAFC'
      : tintKey === 'search'
        ? glassTint.searchSolid
        : overlay;

  return (
    <View {...rest} style={[styles.clip, style]} collapsable={false}>
      {Platform.OS === 'web' ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            styles.webGlass,
            { backgroundColor: solidSurface ? solidBg : overlay },
          ]}
        />
      ) : solidSurface ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { backgroundColor: solidBg }]}
        />
      ) : (
        <>
          <BlurView
            pointerEvents="none"
            intensity={intensity}
            tint="light"
            style={StyleSheet.absoluteFillObject}
            blurReductionFactor={Platform.OS === 'android' ? 1 : 4}
            experimentalBlurMethod={
              Platform.OS === 'android' ? 'dimezisBlurView' : undefined
            }
          />
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, { backgroundColor: overlay }]}
          />
        </>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  webGlass: {
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        } as object)
      : null),
  },
});
