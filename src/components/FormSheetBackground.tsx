import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

/**
 * 二级页全屏底：先模糊底下大气图，再铺浅蓝半透明蒙层（可读且不完全实色）。
 */
export function FormSheetBackground() {
  /** iOS：全屏 BlurView 会导致 TextInput 能聚焦但软键盘不弹出 */
  const useSolidBg = Platform.OS === 'ios';

  return (
    <View pointerEvents="none" style={styles.root}>
      {Platform.OS === 'web' ? (
        <View style={[styles.fill, styles.webBlur, { backgroundColor: colors.formSheetBg }]} />
      ) : useSolidBg ? (
        <View style={[styles.fill, { backgroundColor: colors.formSheetBg }]} />
      ) : (
        <>
          <BlurView
            pointerEvents="none"
            intensity={56}
            tint="light"
            style={styles.fill}
            blurReductionFactor={1}
            experimentalBlurMethod="dimezisBlurView"
          />
          <View style={[styles.fill, { backgroundColor: colors.formSheetBg }]} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  webBlur: {
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        } as object)
      : null),
  },
});
