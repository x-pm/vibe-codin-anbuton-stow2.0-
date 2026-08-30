# STOW App 设计说明

> 面向个人及小型团队的物品收纳与计划提醒应用。本文档描述 **stow-expo**（移动端）的产品定位、架构、数据模型与功能设计，依据当前代码库整理。  
> 代码仓库：<https://github.com/x-pm/STOW>

---

## 1. 产品定位

| 维度 | 说明 |
|------|------|
| 目标用户 | 个人用户、小型团队 |
| 核心价值 | 记录与管理物理物品；为物品关联待办/提醒计划；支持多种快速录入方式 |
| 数据策略 | **本地优先**：物品、计划、分组、资料均保存在本机，无自建业务后端 |
| 平台 | iOS / Android（Expo）；可选 Web 预览（部分原生能力受限） |

与 Web 参考原型（`stow前端参考代码（studio）` + Firebase）不同，**App 版不依赖 Firebase 登录与云端 Firestore**。

---

## 2. 技术栈

| 类别 | 选型 |
|------|------|
| 语言 | TypeScript |
| 框架 | React Native 0.81 + Expo SDK 54 + React 19 |
| 导航 | React Navigation 7（Bottom Tabs + Native Stack） |
| 状态 | React Context（`DataContext`、`InventoryBulkTabContext`） |
| 持久化 | `@react-native-async-storage/async-storage` |
| AI | 硅基流动 SiliconFlow（OpenAI 兼容 Chat Completions） |
| 原生能力 | expo-camera、expo-image-picker、expo-file-system、expo-sharing 等 |
| 导出 | `xlsx` + `expo-sharing` |
| 字体 | Noto Serif SC（思源宋体同源） |

---

## 3. 架构概览

```
App.tsx
├── 字体加载 + 启动片头（AppIntroVideo）
└── DataProvider
    └── AppNavigator
        ├── MainTabs（首页 / 我的物品 / 物品计划 / 我的）
        └── Stack 子页（详情、录入、扫描、链接、设置、导出等）
```

**分层约定**

| 目录 | 职责 |
|------|------|
| `src/screens/` | 页面与业务流程 |
| `src/components/` | 可复用 UI、动效图标、按压反馈 |
| `src/context/` | 全局状态 |
| `src/services/` | 网络/AI、链接抓取、日历同步、本地快照 |
| `src/navigation/` | 路由类型、导航器、安全跳转 |
| `src/theme/` | 颜色、字体、圆角 |
| `src/types/` | 领域模型 |
| `src/utils/` | 编号、分组、导出、计划展示等纯函数 |

**外部依赖（非自建后端）**

- **SiliconFlow**：条码/拍照/链接场景的文本与视觉解析
- **目标网页**：链接录入时由客户端 `fetch` 拉取 HTML（见 `fetchLink.ts`）

---

## 4. 信息架构与导航

### 4.1 底部 Tab（`MainTabParamList`）

| Tab | 页面 | 说明 |
|-----|------|------|
| 首页 | `HomeScreen` | 问候、快捷录入、搜索、计划预览 |
| 我的物品 | `InventoryScreen` | 按分组浏览、批量多选 |
| 物品计划 | `PlansScreen` | 全部待办/已完成计划 |
| 我的 | `ProfileScreen` | 资料、设置入口 |

Tab 栏为**纯文字标签**（无图标 Tab）；物品列表多选时 Tab 栏切换为批量操作条（全选 / 移组 / 删除）。

### 4.2 Stack 子页（`RootStackParamList`）

| 路由 | 页面 | 说明 |
|------|------|------|
| `InventoryGroup` | 分组内物品列表 | 参数 `groupName` |
| `ItemDetail` | 物品详情 | 支持编辑、数量调整；可从相似物品提示进入 |
| `AddItem` | 手动录入 | 可带 `preset`（扫描/链接预填） |
| `ScanEntry` | 扫描录入 | 透明 Modal；条码 / 拍照 / 相册 |
| `LinkEntry` | 链接录入 | 透明 Modal；粘贴商品链接 |
| `EditProfile` | 编辑昵称与头像 | |
| `DataExport` | 数据导出 | Excel（xlsx） |
| `AccountSettings` / `About` / `Help` / `PrivacyPolicy` | 静态说明页 | 共用 `LegalTextScreen` |

**转场**：Stack 默认 `fade`；`AddItem` 为底部滑入 Modal（iOS）；`ScanEntry` / `LinkEntry` 为透明 Modal。

---

## 5. 领域模型

定义于 `src/types/models.ts`。

### 5.1 `InventoryItem`（物品）

| 字段 | 说明 |
|------|------|
| `id` | 时间戳字符串 |
| `name` | 名称 |
| `category` / `group` | 分类与仓库分组（录入时通常一致） |
| `inventoryNumber` / `codeLabel` | 仓库内连续编号（如 001），由 `assignInventoryNumbers` 维护 |
| `quantity` | 数量，最小 1 |
| `imageUri` | 本地或远程图片 |
| `location` / `locationDetail` | 存放位置 |
| `notes` / `tags` / `sku` | 备注、标签、条码货号 |

### 5.2 `ItemPlan`（计划）

| 字段 | 说明 |
|------|------|
| `title` / `detail` / `footer` | 标题、详情、页脚文案 |
| `tag` / `tagBg` | 标签文案与背景色（购物/过期/维护等） |
| `completed` | 完成后首页预览隐藏，计划页灰字+删除线 |

### 5.3 `ItemFormPreset`（录入预填）

扫描、链接、AI 解析后传入 `AddItem`：`name`、`sku`、`location`、`category`、`group`、`remarks`、`quantity`、`imageUrl`、`localImageUri` 等。

### 5.4 默认分组

`电子产品`、`衣物`、`耗材`、`文献`、`工具`（`DataContext.DEFAULT_ITEM_GROUPS`）。

---

## 6. 核心功能

### 6.1 首页（`HomeScreen`）

- 时段问候与品牌区（`HeaderBrandMark`、`HomeDayNightIcon`）
- **三种录入入口**：扫描录入、链接录入、手动录入
- 物品搜索（名称、分类、分组、编号、SKU、位置）
- **未完成计划预览**：点击圆圈完成 → 动画后标记完成并从预览移除
- 跳转物品详情、计划 Tab、个人 Tab

### 6.2 我的物品（`InventoryScreen` + `InventoryGroupScreen`）

- 按分组展示物品卡片
- **批量模式**：多选后底部 Tab 变为操作条（全选、移入分组、删除）
- 支持删除整个分组及其下物品

### 6.3 物品详情与录入

- **详情**（`ItemDetailScreen`）：查看/编辑、改数量、删除
- **手动录入**（`AddItemScreen`）：分组 chips、数量步进、相似物品提示（`itemSimilarity`）
- **扫描**（`ScanEntryScreen`）：相机扫条码、拍照/相册识别；无 API Key 时仍可扫入备注
- **链接**（`LinkEntryScreen`）：抓取 HTML → 规则/meta 提取 + 可选 AI 精炼

### 6.4 物品计划（`PlansScreen`）

- 列表展示全部计划（含已完成态）
- 创建/编辑计划（`PlanDatePickerPanel`）

### 6.5 我的（`ProfileScreen`）

- 昵称与头像（默认占位图）
- 入口：个性化设置、数据导出/备份、关于、帮助
- **退出登录**：`logoutClear` 清空本地快照并恢复默认资料（无云端账号）

### 6.6 数据导出（`DataExportScreen` + `exportStowXlsx.ts`）

- 导出 xlsx：工作表「我的物品」「待办计划」
- 通过 `expo-sharing` 分享文件

---

## 7. 服务层设计

### 7.1 本地持久化（`stowLocalPersist.ts`）

- 存储键：`@stow/local_snapshot_v1`
- 快照内容：`items`、`plans`、`groups`、`profileDisplayName`、`profileAvatarUri`
- `DataProvider` 启动时加载；状态变更后 **300ms 防抖** 写回

### 7.2 AI 解析（`aiParse.ts`）

- 基址：`https://api.siliconflow.cn/v1`（可 `EXPO_PUBLIC_SILICONFLOW_BASE_URL` 覆盖）
- 场景：
  - 通用文本/视觉（扫描、条码备注）
  - 链接专用文本/视觉模型（商品名 ≤7 字、imageUrl 与候选列表对齐等）
- 环境变量见 `.env.example`（`EXPO_PUBLIC_SILICONFLOW_API_KEY` 等）
- 未配置 Key 时：链接/扫描仍可走非 AI 流程或仅保存原始内容

### 7.3 链接抓取（`fetchLink.ts` + `linkMetaExtract.ts`）

- 从分享文案中提取 URL，移动端 `fetch` HTML
- 剥离 script/style，截断长度后供 AI 或规则解析
- Web 参考版用 Express `/api/fetch-link` 代理；**App 版在客户端直接请求**

---

## 8. UI / UX 设计规范

### 8.1 色彩（`src/theme/colors.ts`）

| Token | 值 | 用途 |
|-------|-----|------|
| `bg` | `#F9F7F2` | 页面背景（暖米白） |
| `surface` | `#FFFFFF` | 卡片、Tab 栏 |
| `text` / `textMuted` / `textLight` | 黑 / 灰阶 | 正文层级 |
| `primary` | `#000000` | 强调、按钮 |
| `danger` | `#C62828` |  destructive |
| `gold` | `#8B7355` | 点缀 |
| 计划标签色 | `tagShopping` / `tagExpire` / `tagMaintain` | 计划类型区分 |

### 8.2 字体（`src/theme/fonts.ts`）

- 全局默认：**Noto Serif SC Regular**
- 字重通过独立 `fontFamily` 映射（RN 不能单靠 `fontWeight` 合成）

### 8.3 圆角（`src/theme/radius.ts`）

- 默认 **直角**（`surface: 0`）
- 例外：头像、顶栏品牌按钮等使用正圆（`circle40`、`circle112` 等）

### 8.4 交互组件

- `SpringPressable` / `EasePressable`：按压缩放反馈
- `TabScreenFadeIn`：Tab/Stack 焦点页淡入（物品/计划 Tab 约 520ms）
- 首页计划完成：灰化 + 对钩 + 下滑淡出动画

### 8.5 启动体验

1. 原生 Splash → 加载 Noto Serif SC 字体  
2. `AppIntroVideo` 片头  
3. 进入 `DataProvider` + 主导航  

---

## 9. 状态管理（`DataContext`）

对外 API（`useAppData()`）主要包括：

| 类别 | 方法 |
|------|------|
| 物品 | `addItem`、`updateItem`、`updateItemQuantity`、`removeItem`、`removeItemsByIds`、`moveItemsToGroup` |
| 分组 | `groups`、`addGroup`、`removeGroupsByName` |
| 计划 | `addPlan`、`updatePlan`、`completePlan`、`removePlansByIds` |
| 资料 | `profileDisplayName`、`profileAvatarUri`、`updateProfile` |
| 其它 | `totalCount`（按件数汇总）、`logoutClear` |

物品编号在增删后由 `assignInventoryNumbers` 重新分配，保证 `codeLabel` 连续。

---

## 10. 配置与构建

| 项 | 说明 |
|----|------|
| Node | 建议 20 LTS+ |
| 包管理 | npm + `package-lock.json` |
| 环境变量 | 根目录 `.env`（从 `.env.example` 复制） |
| 补丁 | `patch-package`，`postinstall` 自动应用 `patches/` |
| 应用标识 | `app.stow.archive`（iOS/Android） |
| EAS | `app.json` → `extra.eas.projectId` |

常用命令：`npx expo start`、`npm run android` / `ios`、`npm run start:tunnel`。

---

## 11. 目录结构（精简）

```
stow-expo/
├── App.tsx
├── app.json
├── DESIGN.md          ← 本文档
├── README.md
├── src/
│   ├── screens/       # 各业务页
│   ├── components/
│   ├── context/
│   ├── navigation/
│   ├── services/
│   ├── theme/
│   ├── types/
│   └── utils/
├── assets/
├── patches/
└── android/           # expo prebuild 产物
```

---

## 12. 明确非目标（当前版本）

- 无用户账号体系与多端云同步
- 无自建 REST/GraphQL 业务 API
- 链接抓取受目标站反爬与 CORS/网络环境影响，不保证所有电商链接可解析
- AI 能力依赖第三方配额与模型可用性

---

## 13. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-05-28 | 初版：根据 stow-expo 代码库生成，工作区此前无 DESIGN.md |
