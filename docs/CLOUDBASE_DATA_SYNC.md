# 腾讯云业务数据同步 — 部署清单

App 侧代码已接入。你需要在云开发控制台完成下列步骤后，同步才会真正生效。

## 1. 文档库

- 新建集合：`stow_snapshots`
- 权限建议：客户端读/写均为 **false**（只允许云函数访问）

## 2. 云存储

- 确认已开通云存储
- 客户端上传路径：`stow/{uid}/items/{itemId}.jpg`、`stow/{uid}/avatar.jpg`
- 权限：已登录用户可读写自己的对象（详见 `cloudfunctions/stowSync/README.md`）

## 3. 部署云函数

- 函数名：**`stowSync`**（与 `.env` 中 `EXPO_PUBLIC_CLOUDBASE_SYNC_FUNCTION` 一致）
- 代码目录：`cloudfunctions/stowSync/`
- 依赖：`@cloudbase/node-sdk`
- 超时：建议 ≥ 15 秒

## 4. App 环境变量

```env
EXPO_PUBLIC_CLOUDBASE_ENV_ID=你的环境ID
EXPO_PUBLIC_CLOUDBASE_SYNC_FUNCTION=stowSync
```

AI 函数仍用 `EXPO_PUBLIC_CLOUDBASE_FUNCTION_NAME`（默认 `stowyun`），与同步函数分开。

## 5. 验收

1. 手机号登录 → 录入带图物品 → 等待约 2 秒  
2. 控制台查看 `stow_snapshots` 是否出现当前用户文档；云存储是否有 `stow/...`  
3. 退出再登录（或清 Expo Go 缓存后重登）→ 物品与图片应恢复  
4. 另一账号登录 → 不应看到上一账号数据  

未部署 `stowSync` 时，App 仍可本机使用；控制台 / Metro 日志可能出现 `[stow] cloud reconcile failed` / `cloud push failed`，属预期。

## 6. 删除账号

个人页「删除账号」会调用本函数 `action: deleteAccount`，删除该用户的 `stow_snapshots` 文档，并尝试注销 CloudBase 登录账号。部署后请用测试号走一遍删除流程再上架。
