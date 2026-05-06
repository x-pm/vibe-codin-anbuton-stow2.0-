import React, { useCallback, useRef, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  pressableStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
  /** 按下时缩放比例 */
  shrink?: number;
  /** 按下过渡时长 (ms) */
  pressInDuration?: number;
  /** 松开过渡时长 (ms) */
  pressOutDuration?: number;
};

const easeOut = Easing.out(Easing.cubic);

export function EasePressable({
  children,
  style,
  pressableStyle,
  shrink = 0.97,
  pressInDuration = 95,
  pressOutDuration = 210,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const runTo = useCallback(
    (to: number, duration: number) => {
      Animated.timing(scale, {
        toValue: to,
        duration,
        easing: easeOut,
        useNativeDriver: true,
      }).start();
    },
    [scale]
  );

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      style={pressableStyle}
      onPressIn={(e) => {
        if (!disabled) runTo(shrink, pressInDuration);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!disabled) runTo(1, pressOutDuration);
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
