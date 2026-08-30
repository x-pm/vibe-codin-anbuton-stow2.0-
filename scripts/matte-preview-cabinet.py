"""从原图四边泛洪去除纯白外底，保留完整柜体。用法: python scripts/matte-preview-cabinet.py <源图>"""
from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / "assets" / "preview" / "preview-cabinet-3d.png"
PAD = 12
SRC_REF = (
    Path(__file__).resolve().parents[1]
    / "assets"
    / "preview"
    / "source-desk-wardrobe-set.png"
)


def _is_outer_bg(r: int, g: int, b: int) -> bool:
    m = min(r, g, b)
    if m < 248:
        return False
    return max(r, g, b) - m <= 10


def _is_shadow_fill(r: int, g: int, b: int) -> bool:
    """投影/残留浅灰（中性色），不侵蚀有色木面与摆件"""
    m = min(r, g, b)
    if m < 236:
        return False
    return max(r, g, b) - m <= 14


def matte_edge_white(src: Path) -> Image.Image:
    im = Image.open(src).convert("RGBA")
    data = np.array(im)
    h, w = data.shape[:2]
    visited = np.zeros((h, w), dtype=bool)

    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))

    while q:
        x, y = q.popleft()
        if x < 0 or x >= w or y < 0 or y >= h or visited[y, x]:
            continue
        r, g, b, _ = data[y, x]
        if not _is_outer_bg(r, g, b):
            continue
        visited[y, x] = True
        data[y, x, 3] = 0
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    # 从已透明区域向内吃掉家具下方的孤立投影
    fill_q: deque[tuple[int, int]] = deque()
    for y in range(h):
        for x in range(w):
            if data[y, x, 3] == 0:
                fill_q.append((x, y))
    filled = np.zeros((h, w), dtype=bool)
    while fill_q:
        x, y = fill_q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if nx < 0 or nx >= w or ny < 0 or ny >= h or filled[ny, nx]:
                continue
            if data[ny, nx, 3] == 0:
                continue
            r, g, b, _ = data[ny, nx]
            if not _is_shadow_fill(r, g, b):
                continue
            filled[ny, nx] = True
            data[ny, nx, 3] = 0
            fill_q.append((nx, ny))

    hh = h
    strip = data[int(hh * 0.8) :, :, :]
    light = (
        (strip[:, :, 0] >= 230)
        & (strip[:, :, 1] >= 230)
        & (strip[:, :, 2] >= 230)
        & (np.abs(strip[:, :, 0].astype(int) - strip[:, :, 1]) <= 12)
        & (np.abs(strip[:, :, 1].astype(int) - strip[:, :, 2]) <= 12)
    )
    strip[light, 3] = 0

    result = Image.fromarray(data)
    bbox = result.getbbox()
    if bbox:
        x0, y0, x1, y1 = bbox
        bbox = (
            max(0, x0 - PAD),
            max(0, y0 - PAD),
            min(w, x1 + PAD),
            min(h, y1 + PAD),
        )
        result = result.crop(bbox)
    return center_opaque_region(result)


def center_opaque_region(im: Image.Image, margin: int = PAD) -> Image.Image:
    """裁切后按不透明区域几何中心重新铺画布，避免主体偏一侧"""
    arr = np.array(im)
    mask = arr[:, :, 3] > 128
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return im
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    content = im.crop((x0, y0, x1 + 1, y1 + 1))
    cw, ch = content.size
    canvas = Image.new("RGBA", (cw + margin * 2, ch + margin * 2), (0, 0, 0, 0))
    canvas.paste(content, (margin, margin), content)
    return canvas


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if src is None or not src.is_file():
        raise SystemExit("请传入源图路径")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    if src.resolve() != SRC_REF.resolve():
        import shutil

        shutil.copy2(src, SRC_REF)
    out = matte_edge_white(src)
    out.save(OUT, optimize=True)
    print(f"saved {OUT} size={out.size}")


if __name__ == "__main__":
    main()
