import React from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

const APP_ICON = require('../../assets/icon.png');

type Props = {
  iconSize?: number;
  fontSize?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/** 顶栏品牌：新图标 + 俺不囤 */
export function HeaderAppLogo({
  iconSize = 28,
  fontSize = 20,
  color = colors.text,
  style,
}: Props) {
  return (
    <View style={[styles.row, style]}>
      <Image source={APP_ICON} style={{ width: iconSize, height: iconSize }} resizeMode="contain" />
      <Text style={[styles.name, { fontSize, color }]}>俺不囤</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  name: {
    fontFamily: fonts.bold,
    letterSpacing: 1,
  },
});
