import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { playSaveSuccess } from '../services/sfx';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

type Props = {
  visible: boolean;
  /** 淡出动画结束后调用（用于关闭 visible 或导航） */
  onHidden: () => void;
  message?: string;
};

/**
 * 保存成功轻提示：居中浮现（透明度 + 位移），直角边框。
 */
export function SavedToast({ visible, onHidden, message = '已保存' }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  const onHiddenRef = useRef(onHidden);
  onHiddenRef.current = onHidden;

  useEffect(() => {
    if (!visible) return;

    playSaveSuccess();
    opacity.setValue(0);
    translateY.setValue(16);

    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const finish = () => {
      if (cancelled) return;
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -8,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && !cancelled) onHiddenRef.current();
      });
    };

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished || cancelled) return;
      holdTimer = setTimeout(finish, 1350);
    });

    return () => {
      cancelled = true;
      if (holdTimer) clearTimeout(holdTimer);
      opacity.stopAnimation();
      translateY.stopAnimation();
    };
  }, [visible, opacity, translateY]);

  if (!visible) return null;

  return (
    <View style={styles.root} pointerEvents="none">
      <Animated.View style={[styles.boxWrap, { opacity, transform: [{ translateY }] }]}>
        <View style={styles.box}>
          <Text style={styles.text}>{message}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  boxWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** 直角（90°）边框 */
  box: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    backgroundColor: 'rgba(34,34,34,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 0,
  },
  text: {
    color: colors.surface,
    fontFamily: fonts.semiBold,
    fontSize: 16,
    letterSpacing: 0.5,
  },
});
