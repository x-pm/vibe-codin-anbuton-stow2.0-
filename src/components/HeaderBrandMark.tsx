import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { SpringPressable } from './SpringPressable';

const brandMark = require('../../assets/brand-mark.png');

type Props = {
  /** 不传则不可点（仅展示） */
  onPress?: () => void;
  shrink?: number;
  /** 外圈直径，默认 40 */
  size?: number;
};

/**
 * 顶栏右上角品牌：正圆裁剪、纯黑底；黑底白标整图 `contain` 居中，图块黑底避免透明缝。
 */
export function HeaderBrandMark({ onPress, shrink = 0.92, size = 40 }: Props) {
  const r = size / 2;
  const breathe = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1.14,
          duration: 780,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 1,
          duration: 780,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.delay(320),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  const inner = (
    <Animated.View style={{ transform: [{ scale: breathe }] }} collapsable={false}>
      <View style={[styles.disc, { width: size, height: size, borderRadius: r }]}>
        <Image
          source={brandMark}
          style={{ width: size, height: size, backgroundColor: '#000000' }}
          resizeMode="contain"
        />
      </View>
    </Animated.View>
  );

  if (onPress) {
    return (
      <SpringPressable onPress={onPress} style={styles.wrap} shrink={shrink} accessibilityLabel="打开我的">
        {inner}
      </SpringPressable>
    );
  }

  return <View style={styles.wrap}>{inner}</View>;
}

const styles = StyleSheet.create({
  wrap: { padding: 2 },
  disc: {
    backgroundColor: '#000000',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
