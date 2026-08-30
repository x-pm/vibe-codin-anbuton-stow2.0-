"""高柜：从 Gemini 原图抠出衣柜（透明底、无白边）。用法: python scripts/matte-preview-tall-cabinet.py [源图]"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = Path(
    r"C:\Users\Administrator\.cursor\projects\d-stow-APP\assets"
    r"\c__Users_Administrator_AppData_Roaming_Cursor_User_workspaceStorage_a71758f740cb76e68911aefb5af2fb31_images_Gemini_Generated_Image_71phnl71phnl71ph-a4b433ac-2bb3-4071-bac6-2ef86bfc5c4a.png"
)
OUT = ROOT / "assets" / "preview" / "preview-cabinet-tall.png"


def matte_wardrobe(src: Path) -> Image.Image:
    arr = np.array(Image.open(src).convert("RGB"))
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    min_rgb = np.minimum(np.minimum(r, g), b)

    alpha = np.full(min_rgb.shape, 255, np.uint8)
    alpha[min_rgb >= 238] = 0
    soft = (min_rgb >= 222) & (min_rgb < 238)
    alpha[soft] = np.clip((238 - min_rgb[soft]) * 18, 0, 255).astype(np.uint8)

    mask = alpha > 140
    ys, xs = np.where(mask)
    y0, y1 = ys.min(), ys.max()
    x0, x1 = xs.min(), xs.max()
    pad = 6
    h, w = arr.shape[:2]
    rgba = np.dstack([r, g, b, alpha])
    result = Image.fromarray(rgba).crop(
        (max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad + 1), min(h, y1 + pad + 1))
    )

    data = np.array(result)
    hh = data.shape[0]
    strip = data[int(hh * 0.82) :, :, :]
    light = (strip[:, :, 0] > 215) & (strip[:, :, 1] > 215) & (strip[:, :, 2] > 215)
    strip[light, 3] = 0
    result = Image.fromarray(data)
    bbox = result.getbbox()
    if bbox:
        result = result.crop(bbox)
    return result


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    if not src.is_file():
        raise SystemExit(f"源图不存在: {src}")
    out = matte_wardrobe(src)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT, optimize=True)
    print(f"saved {OUT} size={out.size}")


if __name__ == "__main__":
    main()
