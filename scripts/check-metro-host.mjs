/**
 * 检查 Metro manifest 是否把 bundle 指到 127.0.0.1（真机 Expo Go 会因此超时）。
 * 用法：先启动 Metro，再执行 node scripts/check-metro-host.mjs
 */
const METRO = process.env.METRO_URL ?? 'http://127.0.0.1:8081';

const res = await fetch(METRO);
if (!res.ok) {
  console.error(`Metro 未响应 (${res.status})，请先运行: npm run start`);
  process.exit(1);
}

const manifest = await res.json();
const launchUrl = manifest?.launchAsset?.url ?? '';
const hostUri = manifest?.extra?.expoClient?.hostUri ?? '';

if (/127\.0\.0\.1|localhost/i.test(launchUrl) || /127\.0\.0\.1|localhost/i.test(hostUri)) {
  console.error('\n[失败] Manifest 指向本机回环地址，手机无法访问：');
  console.error('  launchAsset:', launchUrl);
  console.error('  hostUri:    ', hostUri);
  console.error('\n1. 停掉当前 Metro（Ctrl+C）');
  console.error('2. 确认 .env 中有: REACT_NATIVE_PACKAGER_HOSTNAME=你的WLAN的IPv4');
  console.error('3. 重新运行: npm run start:clear');
  console.error('4. 再执行: npm run dev:check');
  console.error('若使用 Clash：开发时关闭 TUN/系统代理，或为 10.x 网段设 DIRECT。\n');
  process.exit(1);
}

console.log('[通过] 真机可访问的开发地址：');
console.log('  hostUri:    ', hostUri);
console.log('  launchAsset:', launchUrl.slice(0, 80) + (launchUrl.length > 80 ? '…' : ''));
