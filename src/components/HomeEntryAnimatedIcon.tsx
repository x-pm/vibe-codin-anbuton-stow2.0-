import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

export type HomeEntryIconVariant = 'scan' | 'link' | 'manual';

/** Ionicons + Animated 与矢量图标兼容时用 JS 驱动 */
const USE_NATIVE_DRIVER = false;

/**
 * 首页三类录入入口的装饰图标：扫描（轻微缩放+摆动）、链接（横向牵连感）、手动（书写的往复倾角）。
 */
export function HomeEntryAnimatedIcon({ variant }: { variant: HomeEntryIconVariant }) {
  const scale = useRef(new Animated.Value(1)).current;
  const rot = useRef(new Animated.Value(0)).current;
  const tx = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scale.setValue(1);
    rot.setValue(0);
    tx.setValue(0);

    let loop: Animated.CompositeAnimation;

    if (variant === 'scan') {
      loop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 1.2,
              duration: 440,
              easing: Easing.out(Easing.quad),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(rot, {
              toValue: 1,
              duration: 880,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]),
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 1,
              duration: 440,
              easing: Easing.in(Easing.quad),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(rot, {
              toValue: 0,
              duration: 880,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]),
          Animated.delay(240),
        ])
      );
    } else if (variant === 'link') {
      loop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 1.14,
              duration: 360,
              easing: Easing.out(Easing.quad),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(tx, {
              toValue: 12,
              duration: 360,
              easing: Easing.out(Easing.quad),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]),
          Animated.parallel([
            Animated.timing(tx, {
              toValue: -12,
              duration: 680,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(scale, {
              toValue: 1.06,
              duration: 680,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]),
          Animated.parallel([
            Animated.timing(tx, {
              toValue: 0,
              duration: 360,
              easing: Easing.in(Easing.quad),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(scale, {
              toValue: 1,
              duration: 360,
              easing: Easing.in(Easing.quad),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]),
          Animated.delay(340),
        ])
      );
    } else {
      loop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 1.14,
              duration: 560,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(rot, {
              toValue: 1,
              duration: 560,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]),
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 1.06,
              duration: 560,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(rot, {
              toValue: -1,
              duration: 560,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]),
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 1,
              duration: 560,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(rot, {
              toValue: 0,
              duration: 560,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]),
          Animated.delay(380),
        ])
      );
    }

    loop.start();
    return () => loop.stop();
  }, [rot, scale, tx, variant]);

  const rotateScan = rot.interpolate({
    inputRange: [0, 1],
    outputRange: ['-12deg', '12deg'],
  });
  const rotatePen = rot.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-18deg', '0deg', '18deg'],
  });

  /** 方格入口用大图标；首页「手动录入」横条与 14px 标题字等高，用紧凑格 */
  const size = variant === 'manual' ? 19 : 36;
  const boxPx = variant === 'manual' ? 26 : 48;
  const color = variant === 'scan' ? colors.onPrimary : colors.text;

  const transform =
    variant === 'scan'
      ? [{ scale }, { rotate: rotateScan }]
      : variant === 'link'
        ? [{ scale }, { translateX: tx }]
        : [{ scale }, { rotate: rotatePen }];

  const name =
    variant === 'scan' ? ('camera-outline' as const) : variant === 'link' ? ('link-outline' as const) : ('create-outline' as const);

  return (
    <View style={[styles.box, { width: boxPx, height: boxPx }]} collapsable={false}>
      <Animated.View style={[styles.inner, { transform }]}>
        <Ionicons name={name} size={size} color={color} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    overflow: 'visible',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
