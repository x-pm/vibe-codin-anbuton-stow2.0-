import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

/** 与矢量图标同层动画时避免 native driver 绘制异常 */
const UD = false;

type Props = { size?: number };

/**
 * 「我的物品」标题旁装饰：近似 lucide-animated layers 的两段抬起→弹簧回落（RN 无 motion）。
 */
export function InventoryLayersAnimatedIcon({ size = 30 }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const ty = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const lift = (toScale: number, toY: number, ms: number) =>
      Animated.parallel([
        Animated.timing(scale, {
          toValue: toScale,
          duration: ms,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: UD,
        }),
        Animated.timing(ty, {
          toValue: toY,
          duration: ms,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: UD,
        }),
      ]);

    const settle = () =>
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 5,
          tension: 175,
          useNativeDriver: UD,
        }),
        Animated.spring(ty, {
          toValue: 0,
          friction: 5,
          tension: 175,
          useNativeDriver: UD,
        }),
      ]);

    const loop = Animated.loop(
      Animated.sequence([
        lift(1.15, -10, 360),
        settle(),
        Animated.delay(140),
        lift(1.1, -6, 240),
        settle(),
        Animated.delay(480),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale, ty]);

  const box = size + 14;

  return (
    <View
      style={[styles.box, { width: box, height: box }]}
      accessibilityLabel="分层视图"
      accessibilityRole="image"
      collapsable={false}
    >
      <Animated.View style={[styles.inner, { transform: [{ translateY: ty }, { scale }] }]}>
        <Ionicons name="layers-outline" size={size} color={colors.text} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
