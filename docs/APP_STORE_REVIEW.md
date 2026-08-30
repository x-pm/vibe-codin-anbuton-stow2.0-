# App Store 上架：仓库内已完成 vs 需你本地完成

## 仓库内已做（审核风险）

- **删除账号**：个人页底部「删除账号」→ 云函数删除 `stow_snapshots` 文档，并尝试 `DELETE /auth/v1/user` 注销登录账号，再清本机该账号缓存。
- **隐私政策**：应用内「个人 → 隐私政策」；网页副本见 `docs/privacy-policy.html`（须托管后把 URL 填进 App Store Connect）。
- **去演示占位**：关于/帮助/个性化改为正式说明；默认头像/封面用本地 `assets/icon.png`，不再请求 picsum。
- **AI 披露**：拍照/链接识别首次弹窗说明数据发往腾讯云函数与硅基流动。
- **权限**：已去掉日历 / 提醒事项相关权限；仅保留相机、相册等实际使用的能力。

## 审核备注（粘贴到 App Store Connect「审核备注」）

```
STOW is a personal inventory app (items, locations, reminders).

No account is required to review core features. Scan / paste link / manual entry, inventory, and plans work immediately. An anonymous CloudBase session may be created in the background only for optional AI recognition; data stays on device until the user signs in.

Optional demo account (cloud sync / delete-account only):
- Method: email + password  OR  username + password
- Email / username: （填你准备的审核号）
- Password: （填密码）

Sign in: Profile tab → 退出登录 (or tap login reminder). Phone, email, or username/password. Sign in with Apple is not used.

Account deletion: Profile tab → 删除账号 (Delete Account) at the bottom. Requires a signed-in (non-anonymous) account. This removes cloud snapshot data and signs the user out.

Privacy policy: in-app at Profile → 隐私政策, and the public URL: （填托管后的 https 链接）

AI: optional photo/link recognition sends content to a Tencent Cloud function which calls SiliconFlow vision models. First use shows a consent alert. Users can enter items manually without AI.
```

## 你必须在本机完成（我这边没有你的账号密码）

1. **托管隐私政策**  
   把 `docs/privacy-policy.html` 传到任意可公网访问的 https（个人站点、GitHub Pages、云开发静态托管均可）。  
   App Store Connect → App 隐私 / 审核信息 → 隐私政策 URL。

2. **客服邮箱**  
   在 App Store Connect 填写支持 URL 与邮箱。若要在 App 内显示邮件按钮，把 `src/constants/legal.ts` 的 `SUPPORT_EMAIL` 改成真实邮箱。

3. **审核演示账号（可选，测云同步/删除账号用）**  
   核心功能已可不登录使用。若备注里仍提供演示号：在 CloudBase 用邮箱或用户名注册，里面录入 2～3 件物品 + 1 条计划。

4. **Apple Developer Program**  
   付费加入（约 $99/年）且 Apple ID 能正常登录 [developer.apple.com](https://developer.apple.com)。EAS `projectId` 与 bundleId `app.stow.archive` 已在仓库配好。

5. **生产构建与提交**（需你已 `eas login` 且 Apple 团队可用）

```bash
npx eas build --platform ios --profile production
npx eas submit --platform ios --latest
```

8. **隐私清单 Privacy Manifest**  
   仓库是 Expo 托管流程，**不要**自己在 Xcode 里新建 `PrivacyInfo.xcprivacy`。已在 `app.json` → `expo.ios.privacyManifests` 声明 Required Reason API（UserDefaults / 文件时间戳 / 磁盘空间 / 系统启动时间）。EAS 打 iOS 包时会生成清单。

   提交前确认（任选其一）：
   - EAS 构建日志里搜 `PrivacyInfo`，应能看到写入/打包该文件，不要有 missing reason 报错。
   - 下载 IPA → 改后缀为 `.zip` 解压 → 看 `Payload/STOW.app/PrivacyInfo.xcprivacy` 是否存在。
   - 上传 TestFlight / App Store 后几分钟，若缺 reason，Apple 会发 ITMS-91053 邮件；把邮件里列出的 API 补进 `privacyManifests` 再打一包即可。

   这和 App Store Connect「App 隐私」问卷不是一回事：问卷仍要你在网页上勾选。

6. **重新部署 stowSync**（含 deleteAccount）  
   云开发控制台上传 `cloudfunctions/stowSync/`，或本机已登录 CloudBase CLI 时：

```bash
npx tcb fn deploy stowSync
```

7. **App 隐私问卷**  
   收集：用户内容、标识符（登录）、照片（用户选择）、联系信息（若用手机号/邮箱登录）。不用于追踪广告则「不用于追踪」。勾选 AI 处理用户内容（识别）。不要勾选日历。

8. **隐私清单 Privacy Manifest**  
   仓库是 Expo 托管流程，**不要**自己在 Xcode 里新建 `PrivacyInfo.xcprivacy`。已在 `app.json` → `expo.ios.privacyManifests` 声明 Required Reason API（UserDefaults / 文件时间戳 / 磁盘空间 / 系统启动时间）。EAS 打 iOS 包时会生成清单。

   提交前确认（任选其一）：
   - EAS 构建日志里搜 `PrivacyInfo`，应能看到写入/打包该文件，不要有 missing reason 报错。
   - 下载 IPA → 改后缀为 `.zip` 解压 → 看 `Payload/STOW.app/PrivacyInfo.xcprivacy` 是否存在。
   - 上传 TestFlight / App Store 后几分钟，若缺 reason，Apple 会发 **ITMS-91053** 邮件；把邮件里列出的 API 补进 `privacyManifests` 再打一包即可。

   这和上面的「App 隐私」问卷不是一回事：问卷仍要你在 Connect 网页上勾选。

## 无法在仓库里代替你做的

- 支付 Apple 开发者年费、创建证书/描述文件（EAS 可代管，但仍需你的 Apple 登录）
- 在 Connect 点「提交审核」
- 给审核员准备的真实演示密码
- 公网隐私政策域名（必须 https）
