#!/usr/bin/env python3
"""Key magenta, crop, bottom-align, and export engine-ready PNGs."""
from pathlib import Path
from PIL import Image, ImageFilter, ImageEnhance

SRC = Path(
    "/Users/yusufdegerli/.grok/sessions/%2FUsers%2Fyusufdegerli%2Frogue-like"
    "/01a037e2-8fd5-71c2-97ea-c7aff575fa82/images"
)
FRAMES = Path("/tmp/ashen/frames")
OUT = Path("/Users/yusufdegerli/rogue-like/assets")


def key_magenta(im, tol=62):
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            # Magenta / hot pink key
            if r >= 170 and b >= 150 and g <= 170 and (r + b) - 2 * g > 70:
                px[x, y] = (0, 0, 0, 0)
            elif r >= 200 and b >= 180 and g <= 200 and abs(r - b) < 90:
                px[x, y] = (0, 0, 0, 0)
    return im


def crop_alpha(im, pad=6):
    bbox = im.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(im.width, r + pad)
    b = min(im.height, b + pad)
    return im.crop((l, t, r, b))


def fit_bottom(im, tw, th):
    scale = min(tw / im.width, th / im.height)
    nw, nh = max(1, int(im.width * scale)), max(1, int(im.height * scale))
    scaled = im.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    canvas.paste(scaled, ((tw - nw) // 2, th - nh), scaled)
    return canvas


def export_sprite(src, dest, tw, th, pad=8):
    im = Image.open(src)
    im = key_magenta(im)
    im = crop_alpha(im, pad)
    im = fit_bottom(im, tw, th)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest)
    print("sprite", dest.name, im.size)


def export_tile(src, dest, size=64):
    im = Image.open(src).convert("RGB")
    im = im.resize((size, size), Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest)
    # 2x2 test
    test = Image.new("RGB", (size * 2, size * 2))
    for y in range(2):
        for x in range(2):
            test.paste(im, (x * size, y * size))
    test.save(dest.with_name(dest.stem + "_2x2.png"))
    print("tile", dest.name)


def export_bg(src, dest, size):
    im = Image.open(src).convert("RGB")
    im = im.resize(size, Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest)
    print("bg", dest.name, im.size)


def make_particles():
    fx = OUT / "fx"
    fx.mkdir(parents=True, exist_ok=True)
    # dust
    dust = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    p = dust.load()
    for x, y, a in [(3, 3, 200), (4, 3, 160), (3, 4, 140), (2, 3, 90), (4, 4, 80)]:
        p[x, y] = (180, 168, 140, a)
    dust.save(fx / "dust.png")
    # ember
    ember = Image.new("RGBA", (6, 6), (0, 0, 0, 0))
    p = ember.load()
    p[2, 2] = (255, 180, 60, 255)
    p[3, 2] = (220, 80, 30, 220)
    p[2, 3] = (180, 40, 20, 180)
    ember.save(fx / "ember.png")
    # spark
    spark = Image.new("RGBA", (5, 5), (0, 0, 0, 0))
    p = spark.load()
    p[2, 2] = (255, 240, 200, 255)
    p[1, 2] = (255, 200, 80, 180)
    p[3, 2] = (255, 200, 80, 180)
    p[2, 1] = (255, 200, 80, 180)
    p[2, 3] = (255, 200, 80, 180)
    spark.save(fx / "spark.png")
    # shock ring
    ring = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    p = ring.load()
    cx, cy = 16, 16
    for y in range(32):
        for x in range(32):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if 11 <= d <= 14:
                p[x, y] = (230, 210, 160, 220)
            elif 10 <= d < 11 or 14 < d <= 15:
                p[x, y] = (180, 80, 40, 140)
    ring.save(fx / "shock.png")
    print("fx particles")


def main():
    P = 96
    export_sprite(SRC / "7.jpg", OUT / "sprites/player/idle.png", P, P)
    export_sprite(SRC / "14.jpg", OUT / "sprites/player/run0.png", P, P)
    if (FRAMES / "walk_016.png").exists():
        export_sprite(FRAMES / "walk_016.png", OUT / "sprites/player/run1.png", P, P)
    else:
        export_sprite(SRC / "14.jpg", OUT / "sprites/player/run1.png", P, P)
    export_sprite(SRC / "28.jpg", OUT / "sprites/player/run2.png", P, P)
    if (FRAMES / "walk_024.png").exists():
        export_sprite(FRAMES / "walk_024.png", OUT / "sprites/player/run3.png", P, P)
    else:
        export_sprite(SRC / "28.jpg", OUT / "sprites/player/run3.png", P, P)
    export_sprite(SRC / "13.jpg", OUT / "sprites/player/jump.png", P, P)
    export_sprite(SRC / "16.jpg", OUT / "sprites/player/dash.png", P, P)
    export_sprite(SRC / "20.jpg", OUT / "sprites/player/slam.png", P, P)
    export_sprite(SRC / "15.jpg", OUT / "sprites/player/charge.png", P, P)
    export_sprite(SRC / "22.jpg", OUT / "sprites/player/heavy.png", P, P)
    export_sprite(SRC / "21.jpg", OUT / "sprites/player/attack.png", P, P)
    export_sprite(SRC / "17.jpg", OUT / "sprites/player/block.png", P, P)
    export_sprite(SRC / "24.jpg", OUT / "sprites/player/hurt.png", P, P)

    export_sprite(SRC / "4.jpg", OUT / "sprites/enemies/ghoul_idle.png", 96, 96)
    export_sprite(SRC / "23.jpg", OUT / "sprites/enemies/ghoul_windup.png", 96, 96)
    export_sprite(SRC / "25.jpg", OUT / "sprites/enemies/ghoul_strike.png", 96, 96)
    export_sprite(SRC / "1.jpg", OUT / "sprites/enemies/hound_idle.png", 112, 80)
    export_sprite(SRC / "19.jpg", OUT / "sprites/enemies/hound_windup.png", 112, 80)
    export_sprite(SRC / "27.jpg", OUT / "sprites/enemies/hound_strike.png", 112, 80)
    export_sprite(SRC / "2.jpg", OUT / "sprites/enemies/wight_idle.png", 112, 112)
    export_sprite(SRC / "18.jpg", OUT / "sprites/enemies/wight_windup.png", 112, 112)
    export_sprite(SRC / "26.jpg", OUT / "sprites/enemies/wight_strike.png", 112, 112)

    export_tile(SRC / "5.jpg", OUT / "tiles/flagstone.png", 64)
    export_tile(SRC / "9.jpg", OUT / "tiles/wall.png", 64)
    export_sprite(SRC / "6.jpg", OUT / "tiles/bridge.png", 160, 80, pad=4)
    export_sprite(SRC / "11.jpg", OUT / "tiles/gate.png", 80, 140, pad=4)
    export_sprite(SRC / "10.jpg", OUT / "fx/slash.png", 64, 64, pad=2)
    export_sprite(SRC / "3.jpg", OUT / "ui/panel.png", 256, 128, pad=2)

    export_bg(SRC / "8.jpg", OUT / "bg/far.png", (1280, 720))
    export_bg(SRC / "12.jpg", OUT / "bg/mid.png", (1280, 720))
    make_particles()


if __name__ == "__main__":
    main()
