import {
  NotoSerifSC_200ExtraLight,
  NotoSerifSC_300Light,
  NotoSerifSC_400Regular,
  NotoSerifSC_500Medium,
  NotoSerifSC_600SemiBold,
  NotoSerifSC_700Bold,
  NotoSerifSC_800ExtraBold,
  NotoSerifSC_900Black,
  useFonts,
} from '@expo-google-fonts/noto-serif-sc';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import React, { useLayoutEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppIntroVideo } from './src/components/AppIntroVideo';
import { DataProvider } from './src/context/DataContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { applySerifTextDefaults } from './src/theme/fonts';

void SplashScreen.preventAutoHideAsync().catch(() => {});

const notoSerifScMap = {
  NotoSerifSC_200ExtraLight,
  NotoSerifSC_300Light,
  NotoSerifSC_400Regular,
  NotoSerifSC_500Medium,
  NotoSerifSC_600SemiBold,
  NotoSerifSC_700Bold,
  NotoSerifSC_800ExtraBold,
  NotoSerifSC_900Black,
};

export default function App() {
  const [fontsLoaded] = useFonts(notoSerifScMap);
  const [introDone, setIntroDone] = useState(false);

  useLayoutEffect(() => {
    if (fontsLoaded) applySerifTextDefaults();
  }, [fontsLoaded]);

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
        <DataProvider>
          <AppNavigator />
        </DataProvider>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
