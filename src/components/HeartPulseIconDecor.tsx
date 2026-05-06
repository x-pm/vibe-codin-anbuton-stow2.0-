import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  /** 图标大约边长 */
  size?: number;
};

/**
 * 首页「总收录」卡右侧装饰：近似 lucide-animated heart-pulse 的节律缩放（RN 无 motion/shadcn，用 Animated 等效实现）。
 */
export function HeartPulseIconDecor({ size = 42 }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    /**
     * 使用 JS 驱动：部分机型上 Ionicons + Animated + useNativeDriver:true 会出现子树不绘制（心形消失）。
     * 图标很小，性能可接受。
     */
    const useNativeDriver = false;
    const beat = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.22,
            duration: 380,
            easing: Easing.out(Easing.quad),
            useNativeDriver,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 380,
            easing: Easing.out(Easing.quad),
            useNativeDriver,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 460,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver,
          }),
          Animated.timing(opacity, {
            toValue: 0.62,
            duration: 460,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver,
          }),
        ]),
        Animated.delay(200),
      ])
    );
    beat.start();
    return () => beat.stop();
  }, [opacity, scale]);

  const box = size + 10;

  return (
    <View
      style={[styles.wrap, { width: box, height: box }]}
      accessibilityLabel="馆藏心跳装饰"
      accessibilityRole="image"
      collapsable={false}
    >
      <Animated.View
        style={[
          styles.inner,
          {
            width: box,
            height: box,
            transform: [{ scale }],
            opacity,
          },
        ]}
      >
        <Ionicons name="heart" size={size} color={colors.danger} />
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
