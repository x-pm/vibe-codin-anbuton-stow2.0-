import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

type Props = {
  children: ReactNode;
  /** 遮罩淡出时长 (ms)；不对内容做 opacity，以免打断毛玻璃 */
  duration?: number;
};

const easeOut = Easing.out(Easing.cubic);

/**
 * 焦点进入时用「遮罩淡出」代替内容 opacity 渐显。
 * 对子树设 opacity / needsOffscreenAlphaCompositing 会导致 BlurView 采不到底图、变成实心块。
 */
export function TabScreenFadeIn({ children, duration = 380 }: Props) {
  const veil = useRef(new Animated.Value(0)).current;
  const [veilMounted, setVeilMounted] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setVeilMounted(true);
      veil.setValue(1);
      const anim = Animated.timing(veil, {
        toValue: 0,
        duration,
        easing: easeOut,
        useNativeDriver: true,
      });
      anim.start(({ finished }) => {
        if (finished) setVeilMounted(false);
      });
      return () => {
        anim.stop();
        setVeilMounted(true);
      };
    }, [veil, duration])
  );

  return (
    <View style={styles.root}>
      {children}
      {veilMounted ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.veil, { opacity: veil }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  /** 与兜底钢蓝接近，淡出时不闪白 */
  veil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3A4A5A',
    zIndex: 50,
  },
});
