import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

const UD = false;

type Props = { size?: number };

/** 「我的物品」搜索框左侧放大镜：轻微缩放 + 缓慢摆动，示意可检索 */
export function InventorySearchAnimatedIcon({ size = 18 }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const rot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.22,
            duration: 420,
            easing: Easing.out(Easing.quad),
            useNativeDriver: UD,
          }),
          Animated.timing(rot, {
            toValue: 1,
            duration: 840,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: UD,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 420,
            easing: Easing.in(Easing.quad),
            useNativeDriver: UD,
          }),
          Animated.timing(rot, {
            toValue: 0,
            duration: 840,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: UD,
          }),
        ]),
        Animated.delay(280),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [rot, scale]);

  const rotate = rot.interpolate({
    inputRange: [0, 1],
    outputRange: ['-14deg', '14deg'],
  });

  return (
    <View style={styles.wrap} accessibilityRole="image" accessibilityLabel="搜索">
      <Animated.View style={[styles.inner, { transform: [{ scale }, { rotate }] }]}>
        <Ionicons name="search-outline" size={size} color={colors.textLight} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
    minWidth: 22,
    minHeight: 22,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
