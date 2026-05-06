import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av';
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

type Props = { onFinish: () => void };

/** 全屏铺满（COVER）播放 `assets/logo/opening.mp4`（由 `D:\\stow APP版\\logo\\` 下 mp4 同步复制），结束后进入主界面 */
export function AppIntroVideo({ onFinish }: Props) {
  const finishedRef = useRef(false);
  const safeFinish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish();
  }, [onFinish]);

  useEffect(() => {
    const t = setTimeout(() => safeFinish(), 60_000);
    return () => clearTimeout(t);
  }, [safeFinish]);

  const onStatusUpdate = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) safeFinish();
    },
    [safeFinish]
  );

  const onLoad = useCallback(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <View style={styles.root}>
      <Video
        source={require('../../assets/logo/opening.mp4')}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping={false}
        onLoad={onLoad}
        onPlaybackStatusUpdate={onStatusUpdate}
        onError={() => safeFinish()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff', overflow: 'hidden' },
  /** COVER：等比铺满，上下或左右裁切；与常见播放器一致，画面中心（logo）对齐屏幕中心 */
  video: { ...StyleSheet.absoluteFillObject },
});
