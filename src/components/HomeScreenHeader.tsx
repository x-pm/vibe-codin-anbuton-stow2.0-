import React from 'react';
import { StyleSheet, View } from 'react-native';
import { HeaderAppLogo } from './HeaderAppLogo';

/** 首页顶栏：图标 + 俺不囤 */
export function HomeScreenHeader() {
  return (
    <View style={styles.topRow}>
      <HeaderAppLogo iconSize={30} fontSize={22} />
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    minHeight: 40,
  },
});
