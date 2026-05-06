# STOW

面向个人或小团队的 **物品收纳与计划提醒** 应用（React Native + [Expo](https://expo.dev)）。支持首页概览、仓库分组浏览、物品录入（手动 / 链接 / 扫码与拍照）、计划待办及可选的系统日历提醒，并可导出数据。

> 仓库：<https://github.com/x-pm/STOW>

---

## 环境要求

- **Node.js**：建议 **20 LTS** 或以上（与 Expo SDK 54 兼容）。
- **包管理**：本仓库使用 **npm**（含 `package-lock.json`）。
- **手机预览**：安装 [Expo Go](https://expo.dev/go)（Android / iOS）。

---

## 安装依赖

在项目根目录（即包含 `package.json` 的目录）执行：

```bash
git clone https://github.com/x-pm/STOW.git
cd STOW
npm install
```

`postinstall` 会自动执行 **patch-package**，应用 `patches/` 下对上游包的补丁（如需换机器或 CI，请勿跳过 `npm install`）。

---

## 配置环境变量（`.env`）

AI 解析（链接识别、拍照识别、条码配合云端解析等）依赖 **硅基流动 SiliconFlow** 的 API Key。

1. 复制示例文件：

   ```bash
   copy .env.example .env
   ```

   macOS / Linux：

   ```bash
   cp .env.example .env
   ```

2. 编辑 `.env`，至少填写：

   ```env
   EXPO_PUBLIC_SILICONFLOW_API_KEY=你的_sk_开头密钥
   ```

3. 可选变量见 `.env.example` 内注释（文本模型、视觉模型、链接专用模型等）。

4. **修改 `.env` 后请重启 Metro**，必要时清缓存：

   ```bash
   npx expo start -c
   ```

---

## 预览 App 效果

### 1. 启动开发服务器

```bash
npx expo start
```

在终端按 `a` / `i` 可打开 Android 模拟器或 iOS 模拟器（需本机已配置对应环境）。

### 2. 真机 + Expo Go（同一局域网）

手机与电脑同一 Wi‑Fi → 打开 Expo Go → 扫描终端中的二维码。

### 3. 真机 + 隧道（方便外地同事）

```bash
npm run start:tunnel
```

使用隧道生成的二维码扫描即可（不必同一局域网）。

### 4. Web（快速看界面）

```bash
npm run web
```

### 5. 原生工程（可选）

若已执行 `npx expo prebuild` 生成 `android` / `ios`：

```bash
npm run android
npm run ios
```

> **Windows**：无法在本机构建 iOS；可在 macOS 或使用 EAS 云端构建 iOS。

---

## 目录结构（简要）

- `src/screens/` — 各业务页面（首页、仓库、计划、录入、扫描、链接等）
- `src/context/` — 本地数据与状态
- `src/services/` — 网络抓取、AI 解析、日历同步等
- `patches/` — `patch-package` 补丁（安装依赖后自动应用）

---

## 许可证

若未在仓库中另行约定，默认以项目所有者声明为准；如需开源许可证可自行补充 `LICENSE` 文件。

---

## README 与仓库体积

`README.md` 仅为说明文档，体积很小，**不会显著增加 GitHub 存储占用**；不影响依赖安装与构建。
