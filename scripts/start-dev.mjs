/**
 * 启动 Expo，并强制 manifest 使用局域网 IP（避免 Clash/TUN 导致 --lan 仍变成 127.0.0.1）。
 */
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

function pickLanIPv4() {
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const [name, addrs] of Object.entries(nets)) {
    if (!addrs) continue;
    for (const net of addrs) {
      if (net.family !== 'IPv4' || net.internal) continue;
      const ip = net.address;
      if (ip.startsWith('127.') || ip.startsWith('169.254.') || ip.startsWith('198.18.')) {
        continue;
      }
      const preferWlan = /wlan|wi-?fi|无线/i.test(name);
      candidates.push({ ip, preferWlan, name });
    }
  }
  candidates.sort((a, b) => Number(b.preferWlan) - Number(a.preferWlan));
  return candidates[0]?.ip ?? null;
}

const lanIp = process.env.REACT_NATIVE_PACKAGER_HOSTNAME?.trim() || pickLanIPv4();
if (lanIp) {
  process.env.REACT_NATIVE_PACKAGER_HOSTNAME = lanIp;
  console.log(`\n[stow] 真机调试地址: http://${lanIp}:8081`);
  console.log(`[stow] 手机 Safari 可先打开: http://${lanIp}:8081/status\n`);
} else {
  console.warn('[stow] 未检测到局域网 IP，真机可能仍超时；请手动在 .env 设置 REACT_NATIVE_PACKAGER_HOSTNAME');
}

process.env.EXPO_DEV_SERVER_LISTEN_ADDRESS = '0.0.0.0';

const expoArgs = ['expo', 'start', '--lan', ...process.argv.slice(2)];
const child = spawn('npx', expoArgs, {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env },
});

child.on('exit', (code) => process.exit(code ?? 0));
