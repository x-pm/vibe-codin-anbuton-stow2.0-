import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

const STORAGE_KEY = 'stow.ai.visionConsent.v2';

/** 首次使用拍照/链接 AI 识别前告知数据将发往云端及第三方模型 */
export async function confirmAiProcessingIfNeeded(): Promise<boolean> {
  try {
    const done = await AsyncStorage.getItem(STORAGE_KEY);
    if (done === '1') return true;
  } catch {
    /* */
  }
  return new Promise((resolve) => {
    Alert.alert(
      '人工智能识别',
      '继续后，图片或链接内容将发送至云端，并由第三方人工智能模型（硅基流动）识别物品信息。我们不会将其用于其他途径。可点取消，改为手动录入。',
      [
        { text: '取消', style: 'cancel', onPress: () => resolve(false) },
        {
          text: '同意并继续',
          onPress: () => {
            void AsyncStorage.setItem(STORAGE_KEY, '1');
            resolve(true);
          },
        },
      ]
    );
  });
}
