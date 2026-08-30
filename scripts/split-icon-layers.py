"""Split app icon into transparent layers for intro animation."""
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "icon.png"
OUT = ROOT / "assets" / "icon-layers"


def is_blue(px) -> bool:
    r, g, b = px[:3]
    return b > r + 8 and b > g and r < 155 and 60 < b < 195


def is_yellow(px) -> bool:
    r, g, b = px[:3]
    return r > 180 and g > 140 and b < 200 and r > b + 20 and g > b


def is_light_blue(px) -> bool:
    r, g, b = px[:3]
    return b > r + 5 and b > 160 and r > 130 and r < 230 and g > 150


def components(pix, w, h, pred):
    seen = [[False] * w for _ in range(h)]
    comps = []
    for y in range(h):
        for x in range(w):
            if seen[y][x] or not pred(pix[x, y]):
                continue
            q = deque([(x, y)])
            seen[y][x] = True
            pts = []
            minx = maxx = x
            miny = maxy = y
            while q:
                cx, cy = q.popleft()
                pts.append((cx, cy))
                minx, maxx = min(minx, cx), max(maxx, cx)
                miny, maxy = min(miny, cy), max(maxy, cy)
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and pred(pix[nx, ny]):
                        seen[ny][nx] = True
                        q.append((nx, ny))
            comps.append((len(pts), minx, miny, maxx, maxy, pts))
    comps.sort(reverse=True)
    return comps


def blank(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def paint(src_pix, dest, pts):
    dp = dest.load()
    for x, y in pts:
        r, g, b = src_pix[x, y][:3]
        dp[x, y] = (r, g, b, 255)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    pix = im.load()

    blues = components(pix, w, h, is_blue)
    yellows = components(pix, w, h, is_yellow)
    lbs = components(pix, w, h, is_light_blue)

    frame_pts = blues[0][5]
    face_comps = [c for c in blues[1:] if c[0] > 200][:3]
    yellow_big = [c for c in yellows if c[0] > 8000]
    yellow_big.sort(key=lambda c: (c[1] + c[3]) / 2)
    sparks = [c for c in yellows if 200 < c[0] < 5000 and c[2] < h * 0.35]
    mid = max(lbs, key=lambda c: c[0]) if lbs else None

    layers = {
        "frame": blank(w, h),
        "face": blank(w, h),
        "bottle-left": blank(w, h),
        "bottle-mid": blank(w, h),
        "bottle-right": blank(w, h),
        "sparks": blank(w, h),
    }
    paint(pix, layers["frame"], frame_pts)
    for c in face_comps:
        paint(pix, layers["face"], c[5])
    if yellow_big:
        paint(pix, layers["bottle-left"], yellow_big[0][5])
    if len(yellow_big) > 1:
        paint(pix, layers["bottle-right"], yellow_big[1][5])
    if mid:
        paint(pix, layers["bottle-mid"], mid[5])
    for c in sparks:
        paint(pix, layers["sparks"], c[5])

    for name, img in layers.items():
        path = OUT / f"{name}.png"
        img.save(path)
        print("wrote", path.name, img.getbbox())


if __name__ == "__main__":
    main()
