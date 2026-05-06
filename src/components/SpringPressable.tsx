import React, { useRef, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** 传给外层 Pressable；子级用 absolute 铺满父容器时必须设置，否则 Pressable 会为 0 尺寸、内容不可见 */
  pressableStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
  /** 按下时缩放，略小于 1 */
  shrink?: number;
};

export function SpringPressable({
  children,
  style,
  pressableStyle,
  shrink = 0.97,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const runSpring = (to: number) => {
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      friction: 7,
      tension: 380,
    }).start();
  };

  return (
    <Pressable
      {...rest}
      style={pressableStyle}
      onPressIn={(e) => {
        runSpring(shrink);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        runSpring(1);
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
