import {
  Keyboard,
  Platform,
  type TextInput,
  type TextInputProps,
} from 'react-native';
import type { RefObject } from 'react';

/** 收起软键盘，退出文字输入 */
export function dismissKeyboard() {
  Keyboard.dismiss();
}

const iosKeyboardProps =
  Platform.OS === 'ios'
    ? ({ showSoftInputOnFocus: true } satisfies Pick<TextInputProps, 'showSoftInputOnFocus'>)
    : {};

/**
 * 单行 / 希望右下角为「完成」并收起键盘的通用属性。
 * （未设置时系统默认为换行 return，看起来就不像「确定」）
 */
export const doneReturnKeyProps: Pick<
  TextInputProps,
  'returnKeyType' | 'blurOnSubmit' | 'onSubmitEditing' | 'showSoftInputOnFocus'
> = {
  returnKeyType: 'done',
  blurOnSubmit: true,
  onSubmitEditing: dismissKeyboard,
  ...iosKeyboardProps,
};

/** 搜索框：右下角为「搜索」，提交后收起键盘 */
export const searchReturnKeyProps: Pick<
  TextInputProps,
  'returnKeyType' | 'blurOnSubmit' | 'showSoftInputOnFocus'
> = {
  returnKeyType: 'search',
  blurOnSubmit: true,
  ...iosKeyboardProps,
};

/**
 * Modal / 页面转场后延迟 focus，避免 iOS 上聚焦但软键盘不弹出。
 * 手动点击输入框一般不需要；弹窗 autoFocus 或程序 focus 时使用。
 */
export function focusTextInputAfterTransition(
  ref: RefObject<TextInput | null>,
  delayMs = Platform.OS === 'ios' ? 80 : 0
) {
  if (delayMs <= 0) {
    ref.current?.focus();
    return;
  }
  setTimeout(() => ref.current?.focus(), delayMs);
}
