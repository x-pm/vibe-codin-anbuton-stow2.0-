import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { colors } from '../theme/colors';

/** 与设计例图一致：白描猫头（尖耳 / 圆脸 / 三道胡须） */
const STROKE = 3.2;
const VIEW = 96;

const AnimatedG = Animated.createAnimatedComponent(G);

export type DoodleCatInlineProps = {
  /** 渲染边长 */
  size?: number;
};

/**
 * 标题行右侧装饰猫头：白描线稿，与毛玻璃首页例图一致。
 */
export function DoodleCatInline({ size = 48 }: DoodleCatInlineProps) {
  const blink = useRef(new Animated.Value(1)).current;
  const sway = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const blinkLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(2200),
        Animated.timing(blink, {
          toValue: 0.15,
          duration: 90,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(blink, {
          toValue: 1,
          duration: 120,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.delay(1600),
      ])
    );
    const swayLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(sway, {
          toValue: -1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );
    blinkLoop.start();
    swayLoop.start();
    return () => {
      blinkLoop.stop();
      swayLoop.stop();
    };
  }, [blink, sway]);

  const rotate = sway.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-4deg', '4deg'],
  });

  const ink = colors.text;

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      pointerEvents="none"
      accessibilityLabel="猫头装饰"
      accessibilityRole="image"
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`}>
          {/* 左耳 */}
          <Path
            d="M28 42 L18 14 L42 30"
            stroke={ink}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* 右耳 */}
          <Path
            d="M68 42 L78 14 L54 30"
            stroke={ink}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* 脸轮廓 */}
          <Path
            d="M28 42
               C22 58 28 78 48 82
               C68 78 74 58 68 42
               C62 30 34 30 28 42 Z"
            stroke={ink}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* 左胡须 */}
          <Path
            d="M34 54 H14 M34 60 H12 M34 66 H16"
            stroke={ink}
            strokeWidth={STROKE * 0.85}
            strokeLinecap="round"
          />
          {/* 右胡须 */}
          <Path
            d="M62 54 H82 M62 60 H84 M62 66 H80"
            stroke={ink}
            strokeWidth={STROKE * 0.85}
            strokeLinecap="round"
          />
          {/* 眼睛（眨眼） */}
          <AnimatedG opacity={blink}>
            <Circle cx={38} cy={52} r={3.2} fill={ink} />
            <Circle cx={58} cy={52} r={3.2} fill={ink} />
          </AnimatedG>
          {/* 口鼻 w */}
          <Path
            d="M44 62 Q48 68 52 62"
            stroke={ink}
            strokeWidth={STROKE * 0.9}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
