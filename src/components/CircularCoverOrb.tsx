import { Ionicons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import React, { useId } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

/** 与设计标注红圈接近的可视直径 */
const CIRCLE = 248;
/** 外圈晕染比圆更大，才能溶进表单浅蓝底，而不是在圆边界戛然而止 */
const HALO = 320;
const PLATE_W = 268;
const PLATE_H = 58;
const STAGE_H = 310;

/** 录入页 FormSheet 观感色（与 blueLight / formSheet 一致） */
const FORM_BG = colors.blueLight;
/** 圆心略深一点的冷灰蓝，仍远浅于幕墙深蓝 */
const FORM_CORE = '#8FA3B8';
const FORM_MID = '#A8B8C9';

const SOFT_CIRCLE_MASK = require('../../assets/soft-circle-mask.png');

type Props = {
  uri?: string;
  onPress: () => void;
  disabled?: boolean;
};

/**
 * 录入封面：圆形照片 / 空态 + 外圈向表单背景色渐隐。
 */
export function CircularCoverOrb({ uri, onPress, disabled }: Props) {
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const haloId = `halo_${rawId}`;
  const emptyId = `empty_${rawId}`;
  const inkId = `ink_${rawId}`;

  const hasPhoto = Boolean(uri?.trim());

  return (
    <Pressable
      style={styles.stage}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={hasPhoto ? '更换物品照片' : '添加物品照片'}
    >
      <View pointerEvents="none" style={styles.plate}>
        {Platform.OS === 'web' ? (
          <View style={[StyleSheet.absoluteFillObject, styles.plateFallback]} />
        ) : (
          <>
            <BlurView
              intensity={Platform.OS === 'ios' ? 48 : 42}
              tint="light"
              style={StyleSheet.absoluteFillObject}
              blurReductionFactor={Platform.OS === 'android' ? 1 : 4}
              experimentalBlurMethod={
                Platform.OS === 'android' ? 'dimezisBlurView' : undefined
              }
            />
            <View style={[StyleSheet.absoluteFillObject, styles.plateTint]} />
          </>
        )}
      </View>

      <View style={styles.orbWrap} pointerEvents="none">
        {/* 大外晕：颜色对齐表单底，外缘透明，避免硬圆环 */}
        <Svg width={HALO} height={HALO} style={styles.haloSvg}>
          <Defs>
            <RadialGradient id={haloId} cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor={FORM_CORE} stopOpacity={hasPhoto ? 0.08 : 0.28} />
              <Stop offset="42%" stopColor={FORM_MID} stopOpacity={hasPhoto ? 0.06 : 0.18} />
              <Stop offset="68%" stopColor={FORM_BG} stopOpacity={hasPhoto ? 0.04 : 0.1} />
              <Stop offset="86%" stopColor={FORM_BG} stopOpacity="0.04" />
              <Stop offset="100%" stopColor={FORM_BG} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={HALO / 2} cy={HALO / 2} r={HALO / 2} fill={`url(#${haloId})`} />
        </Svg>

        {hasPhoto && uri ? (
          <View style={styles.photoBox}>
            <MaskedView
              style={styles.photoBox}
              maskElement={
                <Image
                  source={SOFT_CIRCLE_MASK}
                  style={styles.photo}
                  resizeMode="stretch"
                />
              }
            >
              <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
            </MaskedView>

            {/* 照片边缘溶进表单浅蓝，不用幕墙深蓝硬收边 */}
            <Svg width={CIRCLE} height={CIRCLE} style={StyleSheet.absoluteFillObject}>
              <Defs>
                <RadialGradient id={inkId} cx="50%" cy="50%" rx="50%" ry="50%">
                  <Stop offset="0%" stopColor={FORM_BG} stopOpacity="0" />
                  <Stop offset="55%" stopColor={FORM_BG} stopOpacity="0" />
                  <Stop offset="78%" stopColor={FORM_MID} stopOpacity="0.22" />
                  <Stop offset="92%" stopColor={FORM_BG} stopOpacity="0.55" />
                  <Stop offset="100%" stopColor={FORM_BG} stopOpacity="0.85" />
                </RadialGradient>
              </Defs>
              <Circle
                cx={CIRCLE / 2}
                cy={CIRCLE / 2}
                r={CIRCLE / 2}
                fill={`url(#${inkId})`}
              />
            </Svg>
          </View>
        ) : (
          <View style={styles.emptyOrb}>
            <Svg width={CIRCLE} height={CIRCLE} style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id={emptyId} cx="50%" cy="50%" rx="50%" ry="50%">
                  <Stop offset="0%" stopColor={FORM_CORE} stopOpacity="0.32" />
                  <Stop offset="45%" stopColor={FORM_MID} stopOpacity="0.2" />
                  <Stop offset="72%" stopColor={FORM_BG} stopOpacity="0.1" />
                  <Stop offset="100%" stopColor={FORM_BG} stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Circle
                cx={CIRCLE / 2}
                cy={CIRCLE / 2}
                r={CIRCLE / 2}
                fill={`url(#${emptyId})`}
              />
            </Svg>
            <Ionicons name="camera-outline" size={36} color={colors.textOnGlassMuted} />
            <Text style={styles.emptyHint}>添加物品照片</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: {
    height: STAGE_H,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  plate: {
    position: 'absolute',
    bottom: 6,
    width: PLATE_W,
    height: PLATE_H,
    borderRadius: PLATE_H / 2,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  plateTint: {
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
  },
  plateFallback: {
    backgroundColor: 'rgba(184, 198, 217, 0.42)',
  },
  orbWrap: {
    width: HALO,
    height: HALO,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  haloSvg: {
    position: 'absolute',
  },
  photoBox: {
    width: CIRCLE,
    height: CIRCLE,
  },
  photo: {
    width: CIRCLE,
    height: CIRCLE,
  },
  emptyOrb: {
    width: CIRCLE,
    height: CIRCLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHint: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.textOnGlassMuted,
  },
});
