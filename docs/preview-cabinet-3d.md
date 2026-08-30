# 预览页 — 等距柜体参考图

## 资源

- 源图：`assets/preview/source-desk-wardrobe-set.png`（最新参考图经 `matte-preview-cabinet.py` 生成 `preview-cabinet-3d.png`）
- 展示：`assets/preview/preview-cabinet-3d.png`
- 抠图：`scripts/matte-preview-cabinet.py` 仅从**四边**泛洪去除纯白外底，不阈值整张图，避免裁掉木色/摆件

## 布局（红框）

`PreviewScreen.tsx`：

- 水平：左 `23`、宽 `415`（472 稿）
- 垂直：顶 `263`、高 `436`（1024 稿，与标注红框一致）
- `PreviewModelCarousel`：屏宽翻页 + 红框 `modelWidth` 在页内居中（完整 contain，不裁左侧）；勿对首个模型用 cover
- 圆点区：模型红框底到 Tab 上沿（设计稿 y 699–952），滑动同步高亮
- 模型列表：`src/constants/previewModels.ts`（当前 9 个：书桌、抽屉柜、高柜、木框书/多肉等）
- 批量抠图：`python scripts/matte-preview-assets.py`

## 注意

- 勿对资源做「全图浅色去底」类处理，会漏掉浅木色细节
- 场景内背景墙白块为插画自带，与 App 底色 `#F9F7F2` 接近
