import MaskedView from '@react-native-masked-view/masked-view';
import React, { useId } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colors } from '../theme/colors';

/** 列表专用：羽化带更宽（约直径 28%），比录入页遮罩更软 */
const SOFT_CIRCLE_MASK = require('../../assets/soft-circle-mask-list.png');
const PLACEHOLDER = require('../../assets/icon.png');

type Props = {
  uri?: string;
  /** 直径（含软边外沿） */
  size: number;
  /**
   * 边缘溶入色。仓库大气图深底用深蓝；二级表单浅蓝底用 blueLight。
   */
  fadeTo?: string;
};

/**
 * 列表用软边圆形封面：宽羽化 alpha 遮罩 + 长距离径向溶色。
 *
 * 注意：RadialGradient 的 Stop 不能包在 Fragment 里。
 */
export function SoftCircleThumb({
  uri,
  size,
  fadeTo = colors.bgDeep,
}: Props) {
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const inkId = `ink_${rawId}`;
  const haloId = `halo_${rawId}`;
  /** 外晕更大，虚化外延更远 */
  const halo = Math.round(size * 1.28);
  const coverSource = uri?.trim() ? { uri: uri.trim() } : PLACEHOLDER;

  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Svg
        width={halo}
        height={halo}
        style={[styles.halo, { left: (size - halo) / 2, top: (size - halo) / 2 }]}
      >
        <Defs>
          <RadialGradient id={haloId} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={fadeTo} stopOpacity="0.16" />
            <Stop offset="40%" stopColor={fadeTo} stopOpacity="0.1" />
            <Stop offset="70%" stopColor={fadeTo} stopOpacity="0.04" />
            <Stop offset="100%" stopColor={fadeTo} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={halo / 2} cy={halo / 2} r={halo / 2} fill={`url(#${haloId})`} />
      </Svg>

      <MaskedView
        style={{ width: size, height: size }}
        maskElement={
          <Image
            source={SOFT_CIRCLE_MASK}
            style={{ width: size, height: size }}
            resizeMode="stretch"
          />
        }
      >
        <Image source={coverSource} style={{ width: size, height: size }} resizeMode="cover" />
      </MaskedView>

      {/* 从更靠内开始淡、最外不完全“实心压死”，看起来更像虚化而不是硬晕影 */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <RadialGradient id={inkId} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={fadeTo} stopOpacity="0" />
            <Stop offset="38%" stopColor={fadeTo} stopOpacity="0" />
            <Stop offset="58%" stopColor={fadeTo} stopOpacity="0.12" />
            <Stop offset="74%" stopColor={fadeTo} stopOpacity="0.32" />
            <Stop offset="88%" stopColor={fadeTo} stopOpacity="0.58" />
            <Stop offset="100%" stopColor={fadeTo} stopOpacity="0.82" />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${inkId})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  halo: {
    position: 'absolute',
  },
});
