# stowSync — 物品 / 计划 / 资料云同步

控制台部署函数名建议：**`stowSync`**（与 App `.env` 中 `EXPO_PUBLIC_CLOUDBASE_SYNC_FUNCTION` 一致）。

## 控制台一次性配置

1. **文档型数据库**  
   - 新建集合：`stow_snapshots`  
   - 安全规则建议（仅云函数读写，客户端禁止直连）：

```json
{
  "read": false,
  "write": false
}
```

2. **云存储**  
   - 客户端上传路径：`stow/{uid}/items/{itemId}.jpg`、`stow/{uid}/avatar.jpg`  
   - 安全规则示例（按控制台语法微调；核心是只允许操作自己的前缀）：

```json
{
  "read": "doc._openid == auth.uid || resource.openid == auth.uid",
  "write": "doc._openid == auth.uid || resource.openid == auth.uid"
}
```

若控制台使用「仅创建者可读写」基础权限，且上传时自动带上用户身份，通常也可直接用「登录用户可读写」+ 路径约定。

3. **部署本函数**  
   - 将本目录上传为云函数 `stowSync`  
   - 安装依赖 `@cloudbase/node-sdk`  
   - 超时建议 ≥ 15s  

4. **App `.env`**

```env
EXPO_PUBLIC_CLOUDBASE_ENV_ID=你的环境ID
EXPO_PUBLIC_CLOUDBASE_SYNC_FUNCTION=stowSync
```

## 接口

客户端 `POST /v1/functions/stowSync`，Body：

- `{ "action": "pull" }` → `{ ok, empty?, snapshot?, updatedAt? }`
- `{ "action": "push", "snapshot": {...}, "updatedAt": number }` → `{ ok, updatedAt }`
- `{ "action": "deleteAccount" }` → `{ ok, deleted: true }`（删除该 uid 的快照文档）

必须使用**非匿名**用户的 `access_token`。

## 验收

1. 账号 A 录入带图物品 → 集合出现 `_id=A` 文档；存储有 `stow/...`  
2. 换机同账号登录 → 数据恢复  
3. 账号 B 看不到 A 的数据  
4. 仅匿名登录不会写入 `stow_snapshots`
