import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

const UD = false;

type Props = { size?: number };

/**
 * 「物品计划」标题旁装饰：近似 lucide-animated bell 的摇铃角度序列（RN 无 motion）。
 */
export function PlansBellAnimatedIcon({ size = 30 }: Props) {
  const rotDeg = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const ring = Animated.sequence([
      Animated.parallel([
        Animated.timing(pulse, {
          toValue: 1.12,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: UD,
        }),
        Animated.timing(rotDeg, {
          toValue: -18,
          duration: 95,
          easing: Easing.out(Easing.quad),
          useNativeDriver: UD,
        }),
      ]),
      Animated.parallel([
        Animated.timing(rotDeg, {
          toValue: 18,
          duration: 120,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: UD,
        }),
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 120,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: UD,
        }),
      ]),
      Animated.parallel([
        Animated.timing(rotDeg, {
          toValue: -14,
          duration: 115,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: UD,
        }),
        Animated.timing(pulse, {
          toValue: 1.1,
          duration: 115,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: UD,
        }),
      ]),
      Animated.parallel([
        Animated.timing(rotDeg, {
          toValue: 0,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: UD,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: UD,
        }),
      ]),
      Animated.delay(880),
    ]);
    const loop = Animated.loop(ring);
    loop.start();
    return () => loop.stop();
  }, [pulse, rotDeg]);

  const rotate = rotDeg.interpolate({
    inputRange: [-18, -14, 0, 14, 18],
    outputRange: ['-18deg', '-14deg', '0deg', '14deg', '18deg'],
  });

  const box = size + 14;

  return (
    <View
      style={[styles.box, { width: box, height: box }]}
      accessibilityLabel="提醒铃铛"
      accessibilityRole="image"
      collapsable={false}
    >
      <Animated.View style={[styles.inner, { transform: [{ rotate }, { scale: pulse }] }]}>
        <Ionicons name="notifications-outline" size={size} color={colors.text} />
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
