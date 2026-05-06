import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

const HOME_DAY_NIGHT_ICON_SIZE = 36;
const HOME_DAY_NIGHT_ICON_BOX_EXTRA = 12;

/** 问候行左侧太阳/月亮占位边长（与组件外层 View 一致），供副标题与主标题左对齐 */
export const HOME_DAY_NIGHT_ICON_BOX_PX = HOME_DAY_NIGHT_ICON_SIZE + HOME_DAY_NIGHT_ICON_BOX_EXTRA;

/** 8:00:00–18:00:59 为日间（太阳），18:01:00–次日 7:59:59 为夜间（月亮） */
export function isHomeSunlitWindow(d: Date): boolean {
  const s = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  return s >= 8 * 3600 && s < 18 * 3600 + 60;
}

type Props = { at: Date };

/**
 * 日间/夜间装饰图标（RN 无 shadcn + motion；用 Ionicons + Animated 近似 lucide sun / moon 的轻微律动）。
 */
export function HomeDayNightIcon({ at }: Props) {
  const isSun = useMemo(() => isHomeSunlitWindow(at), [at]);
  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.88)).current;
  const wobble = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pulse.setValue(1);
    glow.setValue(0.88);
    wobble.setValue(0);
    const useNativeDriver = false;

    if (isSun) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulse, {
              toValue: 1.16,
              duration: 620,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver,
            }),
            Animated.timing(glow, {
              toValue: 1,
              duration: 620,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver,
            }),
            Animated.timing(wobble, {
              toValue: 1,
              duration: 1100,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulse, {
              toValue: 1,
              duration: 620,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver,
            }),
            Animated.timing(glow, {
              toValue: 0.78,
              duration: 620,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver,
            }),
            Animated.timing(wobble, {
              toValue: 0,
              duration: 1100,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver,
            }),
          ]),
        ])
      );
      loop.start();
      return () => loop.stop();
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse, {
            toValue: 1.12,
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver,
          }),
          Animated.timing(glow, {
            toValue: 1,
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver,
          }),
          Animated.timing(wobble, {
            toValue: 1,
            duration: 2800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver,
          }),
          Animated.timing(glow, {
            toValue: 0.58,
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver,
          }),
          Animated.timing(wobble, {
            toValue: 0,
            duration: 2800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver,
          }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glow, isSun, pulse, wobble]);

  const size = HOME_DAY_NIGHT_ICON_SIZE;
  const box = HOME_DAY_NIGHT_ICON_BOX_PX;
  const rotateSun = wobble.interpolate({
    inputRange: [0, 1],
    outputRange: ['-14deg', '14deg'],
  });
  const rotateMoon = wobble.interpolate({
    inputRange: [0, 1],
    outputRange: ['-11deg', '11deg'],
  });

  return (
    <View
      style={[styles.wrap, { width: box, height: box }]}
      accessibilityLabel={isSun ? '日间' : '夜间'}
      accessibilityRole="image"
      collapsable={false}
    >
      <Animated.View
        style={[
          styles.inner,
          {
            width: box,
            height: box,
            opacity: glow,
            transform: isSun
              ? [{ scale: pulse }, { rotate: rotateSun }]
              : [{ scale: pulse }, { rotate: rotateMoon }],
          },
        ]}
      >
        {isSun ? (
          <Ionicons name="sunny" size={size} color="#D4A03A" />
        ) : (
          <Ionicons name="moon" size={size} color={colors.textMuted} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
