import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, useWindowDimensions, View } from 'react-native';

type Props = { onFinish: () => void };

const FRAME = require('../../assets/icon-layers/frame.png');
const FACE = require('../../assets/icon-layers/face.png');
const BOTTLE_LEFT = require('../../assets/icon-layers/bottle-left.png');
const BOTTLE_MID = require('../../assets/icon-layers/bottle-mid.png');
const BOTTLE_RIGHT = require('../../assets/icon-layers/bottle-right.png');
const SPARKS = require('../../assets/icon-layers/sparks.png');

/** 冲击过冲，不是匀速 */
const punchOut = Easing.bezier(0.16, 1.32, 0.32, 1);
const settle = Easing.bezier(0.34, 1.4, 0.48, 1);

export function AppIntroVideo({ onFinish }: Props) {
  const { width } = useWindowDimensions();
  const size = Math.min(width * 0.62, 280);
  const slide = size * 0.42;

  const finishedRef = useRef(false);
  const safeFinish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish();
  }, [onFinish]);

  const frameOp = useRef(new Animated.Value(0)).current;
  const frameScale = useRef(new Animated.Value(0.42)).current;
  const sparkOp = useRef(new Animated.Value(0)).current;
  const sparkScale = useRef(new Animated.Value(0.4)).current;
  const faceOp = useRef(new Animated.Value(0)).current;
  const faceScale = useRef(new Animated.Value(0.35)).current;
  const leftX = useRef(new Animated.Value(-slide)).current;
  const rightX = useRef(new Animated.Value(slide)).current;
  const midY = useRef(new Animated.Value(size * 0.28)).current;
  const bottlesOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
    const fallback = setTimeout(() => safeFinish(), 5000);

    const play = Animated.sequence([
      Animated.parallel([
        Animated.timing(frameOp, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(frameScale, {
            toValue: 1.12,
            duration: 340,
            easing: punchOut,
            useNativeDriver: true,
          }),
          Animated.timing(frameScale, {
            toValue: 0.96,
            duration: 160,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(frameScale, {
            toValue: 1,
            duration: 180,
            easing: settle,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.parallel([
        Animated.timing(sparkOp, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(sparkScale, {
            toValue: 1.28,
            duration: 180,
            easing: punchOut,
            useNativeDriver: true,
          }),
          Animated.timing(sparkScale, {
            toValue: 1,
            duration: 200,
            easing: settle,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.parallel([
        Animated.timing(faceOp, {
          toValue: 1,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(faceScale, {
            toValue: 1.22,
            duration: 220,
            easing: punchOut,
            useNativeDriver: true,
          }),
          Animated.timing(faceScale, {
            toValue: 0.94,
            duration: 120,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(faceScale, {
            toValue: 1,
            duration: 160,
            easing: settle,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.parallel([
        Animated.timing(bottlesOp, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(leftX, {
            toValue: size * 0.045,
            duration: 280,
            easing: punchOut,
            useNativeDriver: true,
          }),
          Animated.timing(leftX, {
            toValue: 0,
            duration: 180,
            easing: settle,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(rightX, {
            toValue: -size * 0.045,
            duration: 280,
            easing: punchOut,
            useNativeDriver: true,
          }),
          Animated.timing(rightX, {
            toValue: 0,
            duration: 180,
            easing: settle,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(70),
          Animated.timing(midY, {
            toValue: -size * 0.04,
            duration: 260,
            easing: punchOut,
            useNativeDriver: true,
          }),
          Animated.timing(midY, {
            toValue: 0,
            duration: 170,
            easing: settle,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.delay(520),
    ]);

    play.start(({ finished }) => {
      if (finished) safeFinish();
    });

    return () => {
      clearTimeout(fallback);
      play.stop();
    };
  }, [
    bottlesOp,
    faceOp,
    faceScale,
    frameOp,
    frameScale,
    leftX,
    midY,
    rightX,
    safeFinish,
    size,
    slide,
    sparkOp,
    sparkScale,
  ]);

  const layer = { width: size, height: size, position: 'absolute' as const };

  return (
    <View style={styles.root}>
      <View style={{ width: size, height: size }}>
        <Animated.View
          style={[
            layer,
            { opacity: frameOp, transform: [{ scale: frameScale }] },
          ]}
        >
          <Image source={FRAME} style={styles.img} resizeMode="contain" />
        </Animated.View>
        <Animated.View
          style={[
            layer,
            { opacity: sparkOp, transform: [{ scale: sparkScale }] },
          ]}
        >
          <Image source={SPARKS} style={styles.img} resizeMode="contain" />
        </Animated.View>
        <Animated.View
          style={[
            layer,
            { opacity: faceOp, transform: [{ scale: faceScale }] },
          ]}
        >
          <Image source={FACE} style={styles.img} resizeMode="contain" />
        </Animated.View>
        <Animated.View style={[layer, { opacity: bottlesOp }]}>
          <Animated.View style={[layer, { transform: [{ translateX: leftX }] }]}>
            <Image source={BOTTLE_LEFT} style={styles.img} resizeMode="contain" />
          </Animated.View>
          <Animated.View style={[layer, { transform: [{ translateY: midY }] }]}>
            <Image source={BOTTLE_MID} style={styles.img} resizeMode="contain" />
          </Animated.View>
          <Animated.View style={[layer, { transform: [{ translateX: rightX }] }]}>
            <Image source={BOTTLE_RIGHT} style={styles.img} resizeMode="contain" />
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: { width: '100%', height: '100%' },
});
