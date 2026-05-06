import { StyleSheet, Text, TextInput } from 'react-native';

/**
 * 思源宋体简体：Google Fonts「Noto Serif SC」，SIL Open Font License，
 * 与 Adobe / Google「思源宋体」同源设计。
 *
 * React Native 下自定义字体需按字重选用对应 fontFamily，不能单靠 fontWeight 合成。
 */
export const fonts = {
  extraLight: 'NotoSerifSC_200ExtraLight',
  light: 'NotoSerifSC_300Light',
  regular: 'NotoSerifSC_400Regular',
  medium: 'NotoSerifSC_500Medium',
  semiBold: 'NotoSerifSC_600SemiBold',
  bold: 'NotoSerifSC_700Bold',
  extraBold: 'NotoSerifSC_800ExtraBold',
  black: 'NotoSerifSC_900Black',
} as const;

let serifDefaultsApplied = false;

type WithDefaultProps = { defaultProps?: { style?: unknown } };

/** 在 useFonts 成功后调用一次：全局 Text / TextInput 默认使用思源宋体 Regular */
export function applySerifTextDefaults(): void {
  if (serifDefaultsApplied) return;
  serifDefaultsApplied = true;
  const base = { fontFamily: fonts.regular };

  const T = Text as unknown as WithDefaultProps;
  T.defaultProps = {
    ...(T.defaultProps ?? {}),
    style: StyleSheet.compose(base, T.defaultProps?.style as never) as unknown,
  };
  const TI = TextInput as unknown as WithDefaultProps;
  TI.defaultProps = {
    ...(TI.defaultProps ?? {}),
    style: StyleSheet.compose(base, TI.defaultProps?.style as never) as unknown,
  };
}
