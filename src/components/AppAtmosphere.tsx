import React from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const SKYLINE = require('../../assets/atmosphere/morandi-skyline.png');

/**
 * 全屏建筑底图 + 加深蒙层（白字可读）+ 淡雾（衬毛玻璃）。
 */
export function AppAtmosphere() {
  return (
    <View pointerEvents="none" style={styles.root}>
      <ImageBackground
        source={SKYLINE}
        style={StyleSheet.absoluteFillObject}
        imageStyle={styles.photo}
        resizeMode="cover"
      >
        {/* 整体压暗：白字与玻璃才压得住 */}
        <View style={styles.dim} />
        <LinearGradient
          colors={[
            'rgba(40, 55, 72, 0.35)',
            'rgba(50, 70, 90, 0.25)',
            'rgba(30, 42, 55, 0.55)',
          ]}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={['rgba(217, 201, 146, 0.12)', 'rgba(217, 201, 146, 0)']}
          start={{ x: 1, y: 0 }}
          end={{ x: 0.35, y: 0.4 }}
          style={StyleSheet.absoluteFillObject}
        />
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    backgroundColor: '#3A4A5A',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(35, 48, 62, 0.28)',
  },
});
