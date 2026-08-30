import {
  NotoSerifSC_400Regular,
  NotoSerifSC_500Medium,
  NotoSerifSC_600SemiBold,
  NotoSerifSC_700Bold,
  NotoSerifSC_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/noto-serif-sc';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppIntroVideo } from './src/components/AppIntroVideo';
import { AuthProvider } from './src/context/AuthContext';
import { DataProvider } from './src/context/DataContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import {
  ensureCloudbaseLogin,
  isCloudbaseConfigured,
} from './src/services/cloudbase';
import { applySerifTextDefaults } from './src/theme/fonts';

void SplashScreen.preventAutoHideAsync().catch(() => {});

/** 仅加载界面实际用到的字重，减少 Expo Go 首启下载量 */
const notoSerifScMap = {
  NotoSerifSC_400Regular,
  NotoSerifSC_500Medium,
  NotoSerifSC_600SemiBold,
  NotoSerifSC_700Bold,
  NotoSerifSC_800ExtraBold,
};

export default function App() {
  const [fontsLoaded] = useFonts(notoSerifScMap);
  const [introDone, setIntroDone] = useState(false);

  useLayoutEffect(() => {
    if (fontsLoaded) applySerifTextDefaults();
  }, [fontsLoaded]);

  /** 进主界面后预登录云开发（匿名），避免首次识别才登录 */
  useEffect(() => {
    if (!introDone || !isCloudbaseConfigured()) return;
    void ensureCloudbaseLogin().catch((e) => {
      console.warn('[cloudbase] anonymous login failed', e);
    });
  }, [introDone]);

  /** 字体加载期间保持与 splash 同色，由原生闪屏覆盖，避免闪一下自定义 Loading */
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#ffffff' }} />;
  }

  if (!introDone) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AppIntroVideo onFinish={() => setIntroDone(true)} />
          <StatusBar style="dark" />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <DataProvider>
            <AppNavigator />
          </DataProvider>
        </AuthProvider>
        <StatusBar style="light" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
