import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

/** 与参考图一致的炭笔色线条 */
const INK = '#333333';
const STROKE = 4.2;
const STROKE_SOFT = 3.2;

const VIEW_W = 128;
const VIEW_H = 132;

/** 尾巴摆动支点（身尾相接处，viewBox 坐标） */
const TAIL_PIVOT = { x: 38, y: 72 };
/** 头部轻摆支点（脸中心偏上） */
const HEAD_PIVOT = { x: 70, y: 48 };

const AnimatedG = Animated.createAnimatedComponent(G);

export type DoodleCatInlineProps = {
  /** 渲染宽度（高度按 viewBox 比例） */
  size?: number;
};

/**
 * 手绘小猫：头、尾微动；固定占位，不可拖动；用于标题行右侧装饰。
 */
export function DoodleCatInline({ size = 52 }: DoodleCatInlineProps) {
  const tailPhase = useRef(new Animated.Value(0)).current;
  const headPhase = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const tailLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(tailPhase, {
          toValue: 1,
          duration: 520,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(tailPhase, {
          toValue: -1,
          duration: 520,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );
    const headLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(headPhase, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(headPhase, {
          toValue: -1,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ])
    );
    tailLoop.start();
    headLoop.start();
    return () => {
      tailLoop.stop();
      headLoop.stop();
    };
  }, [tailPhase, headPhase]);

  const tailRotate = tailPhase.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-14deg', '14deg'],
  });

  const headRotate = headPhase.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-5deg', '5deg'],
  });

  const w = size;
  const h = (size * VIEW_H) / VIEW_W;

  return (
    <View
      style={[styles.wrap, { width: w, height: h }]}
      pointerEvents="none"
      accessibilityLabel="手绘小猫"
      accessibilityRole="image"
    >
      <Svg width={w} height={h} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        <Path
          d="M24 20v9 M19.5 24.5h9 M40 11v7 M36.5 14.5h7"
          stroke={INK}
          strokeWidth={STROKE_SOFT}
          strokeLinecap="round"
        />
        <AnimatedG
          transform={[
            { translateX: TAIL_PIVOT.x },
            { translateY: TAIL_PIVOT.y },
            { rotate: tailRotate },
            { translateX: -TAIL_PIVOT.x },
            { translateY: -TAIL_PIVOT.y },
          ]}
        >
          <Path
            d="M36 78 C12 76 4 52 16 38 C22 32 34 44 38 60"
            stroke={INK}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </AnimatedG>
        <Path
          d="M46 42
                   C38 54 34 72 38 90
                   C36 102 44 114 52 116
                   Q58 120 64 114
                   Q70 120 76 114
                   Q86 116 90 100
                   C96 82 92 58 80 44
                   C72 34 58 32 46 42"
          stroke={INK}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <AnimatedG
          transform={[
            { translateX: HEAD_PIVOT.x },
            { translateY: HEAD_PIVOT.y },
            { rotate: headRotate },
            { translateX: -HEAD_PIVOT.x },
            { translateY: -HEAD_PIVOT.y },
          ]}
        >
          <Path
            d="M52 34 Q46 16 58 26"
            stroke={INK}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M76 26 Q88 14 94 32"
            stroke={INK}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M54 52 L44 52 M54 60 L44 60"
            stroke={INK}
            strokeWidth={STROKE_SOFT}
            strokeLinecap="round"
          />
          <Circle cx={62} cy={46} r={3.6} fill={INK} />
          <Circle cx={78} cy={46} r={3.6} fill={INK} />
          <Path
            d="M64 54 Q67 58 70 54 Q73 58 76 54"
            stroke={INK}
            strokeWidth={STROKE_SOFT}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </AnimatedG>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexShrink: 0,
  },
});
