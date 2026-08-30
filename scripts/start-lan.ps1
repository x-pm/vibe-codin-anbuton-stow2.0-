# 真机 Expo Go：强制使用局域网 IP，避免 manifest 指向 127.0.0.1 导致超时
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$ip = (
  Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notmatch '^(127\.|169\.254\.|198\.18\.)' -and
      $_.PrefixOrigin -ne 'WellKnown'
    } |
    Sort-Object -Property InterfaceMetric |
    Select-Object -First 1 -ExpandProperty IPAddress
)

if (-not $ip) {
  Write-Host '未检测到局域网 IPv4，将仅使用 expo --lan'
} else {
  $env:REACT_NATIVE_PACKAGER_HOSTNAME = $ip
  Write-Host "REACT_NATIVE_PACKAGER_HOSTNAME=$ip"
}

$env:EXPO_DEV_SERVER_LISTEN_ADDRESS = '0.0.0.0'

Write-Host @'

提示：
  - 开发时请暂时关闭 Clash/ VPN，或把局域网设为 DIRECT
  - 手机 Safari 打开: http://<上面IP>:8081/status  应能看到 packager-status:running
  - 仍失败请用: npm run start:tunnel

'@

npx expo start --lan @args
