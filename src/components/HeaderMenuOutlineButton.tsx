import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet } from 'react-native';
import { SpringPressable } from './SpringPressable';
import { colors } from '../theme/colors';

type Props = {
  onPress?: () => void;
};

/**
 * 与「我的」页顶栏一致的左上角菜单线图标占位（宽 40 + padding）。
 */
export function HeaderMenuOutlineButton({ onPress }: Props) {
  return (
    <SpringPressable
      onPress={onPress ?? (() => {})}
      style={styles.iconBtn}
      shrink={0.9}
      accessibilityRole="button"
      accessibilityLabel="菜单"
    >
      <Ionicons name="menu-outline" size={24} color={colors.text} />
    </SpringPressable>
  );
}

const styles = StyleSheet.create({
  iconBtn: { padding: 4, width: 40 },
});
