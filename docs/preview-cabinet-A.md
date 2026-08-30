# 预览柜体 — A版

**A版** 为预览页静态 PNG 方案（**已停用**，由 Spline 3D 替代，见 `preview-cabinet-3d.md`）。

## 特征

- 资源：`assets/preview/preview-furniture.png`
- **正视**：无 `rotateY` / 透视倾斜
- **无阴影**：无外投影、无渐变叠加，仅展示静态图
- **布局**：红线宽度 415/472、左距 23/472（见 `PreviewScreen.tsx`）

## 代码

| 文件 | 说明 |
|------|------|
| `src/components/PreviewCabinetStage.tsx` | A版实现（纯 Image），文件头注释标明 A版 |
| `src/screens/PreviewScreen.tsx` | 调用 `PreviewCabinetStage`，红线比例布局 |

## 非 A版（已废弃尝试）

- **倾斜版**：约 28° `rotateY` + 淡椭圆接触阴影 — 已回退，不作为默认

恢复 A版：将 `PreviewCabinetStage.tsx` 恢复为本文档描述的正视、无阴影纯图实现即可。
