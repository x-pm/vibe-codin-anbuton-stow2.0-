import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';

/** 尽量返回上一页；若无历史（例如栈异常），回到主导航，避免出现 GO_BACK 未处理的报错 */
export function safeLeaveToPreviousOrHome(
  navigation: NativeStackNavigationProp<RootStackParamList>
) {
  if (navigation.canGoBack()) {
    navigation.goBack();
  } else {
    navigation.navigate('MainTabs');
  }
}
