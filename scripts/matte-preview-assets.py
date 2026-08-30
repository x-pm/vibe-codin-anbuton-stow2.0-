"""批量处理预览模型图：四边去白底 + 裁切。用法: python scripts/matte-preview-assets.py"""
from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

APP_BG = (249, 247, 242)
PAD = 12
PREVIEW_DIR = Path(__file__).resolve().parents[1] / "assets" / "preview"

FILES = [
    "preview-shelf-books-stack-3.png",
    "preview-shelf-books-4.png",
    "preview-shelf-books-2.png",
    "preview-shelf-books-cactus.png",
    "preview-shelf-succulent.png",
    "preview-shelf-books-6.png",
    "preview-cabinet-tall.png",
]


def matte_in_place(path: Path) -> None:
    im = Image.open(path).convert("RGBA")
    data = np.array(im)
    h, w = data.shape[:2]
    visited = np.zeros((h, w), dtype=bool)

    def is_bg(x: int, y: int) -> bool:
        r, g, b, _ = data[y, x]
        return r >= 250 and g >= 250 and b >= 250

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
        if not is_bg(x, y):
            continue
        visited[y, x] = True
        data[y, x, 3] = 0
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    white = (
        (data[:, :, 3] > 0)
        & (data[:, :, 0] >= 250)
        & (data[:, :, 1] >= 250)
        & (data[:, :, 2] >= 250)
    )
    data[white, 0:3] = APP_BG

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

    result.save(path, optimize=True)
    print(f"{path.name} -> {result.size}")


def main() -> None:
    for name in FILES:
        path = PREVIEW_DIR / name
        if not path.is_file():
            raise SystemExit(f"missing: {path}")
        matte_in_place(path)


if __name__ == "__main__":
    main()
