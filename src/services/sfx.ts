import { Audio } from 'expo-av';

export type SfxKind = 'tap' | 'success' | 'complete';

const sources: Record<SfxKind, number> = {
  tap: require('../../assets/sfx/tap.wav'),
  success: require('../../assets/sfx/success.wav'),
  complete: require('../../assets/sfx/complete.wav'),
};

let audioReady = false;
const cache = new Map<SfxKind, Audio.Sound>();
let playChain: Promise<void> = Promise.resolve();

async function ensureAudioMode() {
  if (audioReady) return;
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
  audioReady = true;
}

async function getSound(kind: SfxKind): Promise<Audio.Sound> {
  const hit = cache.get(kind);
  if (hit) return hit;
  const { sound } = await Audio.Sound.createAsync(sources[kind], {
    shouldPlay: false,
    volume: kind === 'tap' ? 0.55 : 0.7,
  });
  cache.set(kind, sound);
  return sound;
}

/** 播放短音效；失败时静默，不影响交互 */
export function playSfx(kind: SfxKind): void {
  playChain = playChain
    .then(async () => {
      try {
        await ensureAudioMode();
        const sound = await getSound(kind);
        await sound.setPositionAsync(0);
        await sound.playAsync();
      } catch {
        // Expo Go / 静音策略等环境下忽略
      }
    })
    .catch(() => {});
}

export function playNavTap() {
  playSfx('tap');
}

export function playSaveSuccess() {
  playSfx('success');
}

export function playPlanComplete() {
  playSfx('complete');
}
