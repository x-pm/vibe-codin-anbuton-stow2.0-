/**
 * Android + USB：配合 adb reverse，让 Expo Go 通过 localhost 访问电脑 Metro。
 * 先执行: adb reverse tcp:8081 tcp:8081
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

process.env.REACT_NATIVE_PACKAGER_HOSTNAME = 'localhost';
process.env.EXPO_DEV_SERVER_LISTEN_ADDRESS = '127.0.0.1';

console.log(`
[stow] Android USB 调试
  1. 手机开启「USB 调试」，用数据线连接电脑
  2. 在终端执行: adb reverse tcp:8081 tcp:8081
  3. 本脚本会启动 Metro（manifest 使用 localhost:8081）
  4. Expo Go 扫描终端二维码，或手动输入 exp://127.0.0.1:8081
`);

const expoArgs = ['expo', 'start', '--localhost', ...process.argv.slice(2)];
spawn('npx', expoArgs, {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env },
});
