# STOW

面向个人及小型团队的 **物品收纳与计划提醒** 应用，基于 React Native 与 [Expo](https://expo.dev) 构建。主要功能包括：首页概览、按仓库浏览物品、多种录入方式（手动录入、链接解析、扫码与拍照识别）、计划待办管理，以及可选的系统日历同步与数据导出。

> 代码仓库：<https://github.com/x-pm/STOW>

---

## 环境要求

- **Node.js**：建议使用 **20 LTS** 或更高版本，与 Expo SDK 54 保持一致。
- **包管理**：本项目使用 **npm**，并已包含 `package-lock.json`。
- **移动端预览**：需安装 [Expo Go](https://expo.dev/go)（支持 Android / iOS）。

---

## 安装依赖

于项目根目录（包含 `package.json` 的目录）执行以下命令：

```bash
git clone https://github.com/x-pm/STOW.git
cd STOW
npm install
```

安装完成后，`postinstall` 脚本将自动执行 **patch-package**，应用 `patches/` 目录中的补丁。更换开发环境或在 CI 中构建时，请完整执行 `npm install`，勿省略该步骤。

---

## 配置环境变量（`.env`）

链接识别、拍照识别及条码配合云端解析等功能依赖 **硅基流动 SiliconFlow** 提供的 API Key。

1. 复制示例文件为本地配置：

   **Windows：**

   ```bash
   copy .env.example .env
   ```

   **macOS / Linux：**

   ```bash
   cp .env.example .env
   ```

2. 编辑 `.env`，至少配置以下变量（密钥格式一般为 `sk-` 开头）：

   ```env
   EXPO_PUBLIC_SILICONFLOW_API_KEY=你的_sk_开头密钥
   ```

3. 其余可选变量（文本模型、视觉模型、链接场景专用模型等）说明见 `.env.example` 内注释，可按需配置。

4. 修改 `.env` 后需 **重启 Metro 开发服务器**；若环境变量未生效，可尝试清除缓存后启动：

   ```bash
   npx expo start -c
   ```

---

## 预览 App 效果

### 1. 启动开发服务器

```bash
npx expo start
```

在终端中按 `a` / `i` 可尝试启动 Android 或 iOS 模拟器（需本机已安装并配置对应开发环境）。

### 2. 真机预览（局域网，Expo Go）

确保移动设备与开发机处于同一无线网络，打开 Expo Go，扫描终端中显示的二维码。

### 3. 真机预览（隧道模式）

当设备与开发机不在同一局域网时，可执行：

```bash
npm run start:tunnel
```

使用隧道模式生成的二维码进行连接（网络延迟可能略高于局域网）。

### 4. Web 预览

```bash
npm run web
```

适用于快速查看界面；部分原生能力（如相机、系统日历等）在浏览器中与真机表现可能不一致。

### 5. 原生工程（可选）

若已通过 `npx expo prebuild` 生成 `android` / `ios` 目录，可执行：

```bash
npm run android
npm run ios
```

> **说明**：在 **Windows** 环境下无法本地编译 iOS 应用；需在 macOS 上使用 Xcode，或通过 Expo Application Services（EAS）进行云端构建。

---

## 目录结构说明

- `src/screens/` — 各业务页面（首页、仓库、计划、录入、扫描、链接等）
- `src/context/` — 本地状态与数据上下文
- `src/services/` — 网络请求、AI 解析、日历同步等服务模块
- `patches/` — `patch-package` 补丁文件，于 `npm install` 后自动应用

---

## 许可证

若仓库中未单独提供许可证文件，则以仓库维护者的声明为准；如需开源分发，可自行补充 `LICENSE` 文件。
