/**
 * 隧道模式：经 ngrok 连接，绕过校园网 AP 隔离。
 * 注意：隧道模式下勿使用 REACT_NATIVE_PACKAGER_HOSTNAME（会干扰 ngrok）。
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

delete process.env.REACT_NATIVE_PACKAGER_HOSTNAME;
process.env.EXPO_DEV_SERVER_LISTEN_ADDRESS = '0.0.0.0';

console.log(`
[stow] 隧道模式（ngrok → expo.host）
  - 若报 failed to start tunnel / remote gone away / session closed：
    多为国内网络无法稳定连接 ngrok，请改用下方替代方案
  - 可尝试：Clash 开「全局」后再运行本命令（让 ngrok 走代理出海）
  - 替代：手机开热点 + npm run start | Android USB + npm run start:android-usb
`);

const expoArgs = ['expo', 'start', '--tunnel', ...process.argv.slice(2)];
const child = spawn('npx', expoArgs, {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env },
});

child.on('exit', (code) => process.exit(code ?? 0));
