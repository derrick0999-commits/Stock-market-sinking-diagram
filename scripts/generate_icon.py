#!/usr/bin/env python3
"""Generate iOS home screen icon: blue sky, white clouds, bold 5386."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
TEXT = "5386"


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size))
    draw = ImageDraw.Draw(img)

    for y in range(size):
        t = y / max(size - 1, 1)
        r = int(95 + (210 - 95) * (1 - t))
        g = int(175 + (240 - 175) * (1 - t))
        b = int(245 + (255 - 245) * (1 - t))
        draw.line([(0, y), (size, y)], fill=(r, g, b))

    # clouds
    cloud_y = int(size * 0.72)
    cloud_h = int(size * 0.22)
    for cx, cw in [(0.12, 0.28), (0.32, 0.34), (0.55, 0.36), (0.74, 0.30)]:
        x = int(size * cx)
        w = int(size * cw)
        h = cloud_h
        draw.ellipse((x, cloud_y, x + w, cloud_y + h), fill=(255, 255, 255))
        draw.ellipse((x + w // 4, cloud_y - h // 3, x + w, cloud_y + h // 2), fill=(255, 255, 255))

    font_size = int(size * 0.34)
    try:
        font = ImageFont.truetype(FONT_PATH, font_size)
    except OSError:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), TEXT, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (size - tw) // 2
    y = int(size * 0.22)

    outline = max(2, size // 90)
    for dx in range(-outline, outline + 1):
        for dy in range(-outline, outline + 1):
            if dx * dx + dy * dy <= outline * outline:
                draw.text((x + dx, y + dy), TEXT, font=font, fill=(15, 70, 130))

    draw.text((x, y), TEXT, font=font, fill=(255, 255, 255))
    return img


def main() -> None:
    master = draw_icon(1024)
    outputs = {
        ROOT / "apple-touch-icon.png": 180,
        ROOT / "apple-touch-icon-precomposed.png": 180,
        ROOT / "favicon.png": 32,
    }
    for path, size in outputs.items():
        master.resize((size, size), Image.Resampling.LANCZOS).save(path, optimize=True)
        print(f"Wrote {path} ({size}x{size})")


if __name__ == "__main__":
    main()
