import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, type ReactNode } from 'react';
import { Animated, Easing } from 'react-native';

type Props = {
  children: ReactNode;
  /** 渐显时长 (ms) */
  duration?: number;
};

const easeOut = Easing.out(Easing.cubic);

/**
 * 路由获得焦点时内容从透明淡入（Tab 切换、从 Stack 返回上一级等会触发 useFocusEffect）。
 */
export function TabScreenFadeIn({ children, duration = 380 }: Props) {
  const opacity = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      opacity.setValue(0);
      const anim = Animated.timing(opacity, {
        toValue: 1,
        duration,
        easing: easeOut,
        useNativeDriver: true,
      });
      anim.start();
      return () => anim.stop();
    }, [opacity, duration])
  );

  return (
    <Animated.View style={{ flex: 1, opacity }} needsOffscreenAlphaCompositing>
      {children}
    </Animated.View>
  );
}
