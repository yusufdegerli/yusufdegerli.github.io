#!/usr/bin/env python3
"""Regenerate procedural Doom-64-ish PNGs (stdlib only: zlib + struct).

Usage (from repo root):
    python3 tools/generate_assets.py

Writes:
    assets/textures/wall.png
    assets/textures/floor.png
    assets/textures/ceiling.png
    assets/sprites/coin.png
    assets/sprites/exit.png
    assets/sprites/hand.png
"""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "assets"
TEX = ROOT / "textures"
SPR = ROOT / "sprites"


def write_png(path: Path, w: int, h: int, rgba: bytes | bytearray) -> None:
    assert len(rgba) == w * h * 4

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    raw = bytearray()
    stride = w * 4
    for y in range(h):
        raw.append(0)
        raw.extend(rgba[y * stride : (y + 1) * stride])

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)
    print(f"wrote {path} ({w}x{h})")


def clamp(v: float) -> int:
    return max(0, min(255, int(v)))


def px(buf: bytearray, w: int, x: int, y: int, r, g, b, a=255) -> None:
    i = (y * w + x) * 4
    buf[i : i + 4] = bytes((clamp(r), clamp(g), clamp(b), clamp(a)))


def main() -> None:
    TEX.mkdir(parents=True, exist_ok=True)
    SPR.mkdir(parents=True, exist_ok=True)
    W = 64

    wall = bytearray(W * W * 4)
    for y in range(W):
        for x in range(W):
            row = y // 8
            offset = (row % 2) * 16
            bx = (x + offset) % 32
            by = y % 8
            mortar = bx == 0 or by == 0
            if mortar:
                r, g, b = 40, 28, 32
            else:
                n = ((x * 13 + y * 7) ^ (x * y)) & 15
                r = 120 + n - (row % 3) * 8
                g = 36 + n // 2
                b = 36 + n // 3
                if bx == 1 or by == 1:
                    r, g, b = r * 0.7, g * 0.7, b * 0.7
            if (x + y) % 17 == 0:
                r, g, b = r * 0.85, g * 0.8, b * 1.1
            px(wall, W, x, y, r, g, b)
    write_png(TEX / "wall.png", W, W, wall)

    floor = bytearray(W * W * 4)
    for y in range(W):
        for x in range(W):
            tile = 16
            tx, ty = x % tile, y % tile
            edge = tx == 0 or ty == 0
            n = ((x * 3) ^ (y * 5)) & 7
            if edge:
                r, g, b = 22, 20, 28
            else:
                r, g, b = 48 + n, 42 + n, 52 + n
                if (x // tile + y // tile) % 2:
                    r, g, b = r * 0.85, g * 0.85, b * 0.9
            px(floor, W, x, y, r, g, b)
    write_png(TEX / "floor.png", W, W, floor)

    ceil = bytearray(W * W * 4)
    for y in range(W):
        for x in range(W):
            n = ((x * 11) ^ (y * 3)) & 7
            r, g, b = 28 + n, 18 + n // 2, 48 + n
            if x % 16 == 0 or y % 16 == 0:
                r, g, b = 14, 10, 24
            if (x % 16 == 8) and (y % 16 == 8):
                r, g, b = 60, 40, 90
            px(ceil, W, x, y, r, g, b)
    write_png(TEX / "ceiling.png", W, W, ceil)

    CW = 64
    coin = bytearray(CW * CW * 4)
    cx = cy = CW // 2
    for y in range(CW):
        for x in range(CW):
            dx, dy = x - cx + 0.5, y - cy + 0.5
            d = math.hypot(dx, dy)
            if d < 22:
                t = d / 22
                hl = max(0, 1 - math.hypot(dx + 6, dy + 6) / 28)
                r = 200 + 55 * hl - 40 * t
                g = 160 + 40 * hl - 50 * t
                b = 40 + 20 * hl
                if d > 19:
                    r, g, b = 120, 90, 20
                if abs(dx) < 3 and abs(dy) < 12:
                    r, g, b = r * 0.55, g * 0.55, b * 0.4
                px(coin, CW, x, y, r, g, b, 255)
            elif d < 24:
                px(coin, CW, x, y, 80, 60, 10, int(200 * (24 - d) / 2))
    write_png(SPR / "coin.png", CW, CW, coin)

    exitb = bytearray(CW * CW * 4)
    for y in range(CW):
        for x in range(CW):
            dx, dy = x - cx + 0.5, y - cy + 0.5
            d = math.hypot(dx, dy)
            ang = math.atan2(dy, dx)
            if d < 26:
                ring = abs(math.sin(ang * 3 + d * 0.3))
                core = max(0, 1 - d / 20)
                r = 30 + 40 * ring
                g = 180 * core + 60 * ring
                b = 80 + 100 * core
                a = int(255 * min(1, (26 - d) / 3) * (0.4 + 0.6 * core))
                if d < 8:
                    r, g, b, a = 200, 255, 220, 230
                px(exitb, CW, x, y, r, g, b, a)
    write_png(SPR / "exit.png", CW, CW, exitb)

    HW = HH = 160
    hand = bytearray(HW * HH * 4)

    def draw_ellipse(buf, w, h, ecx, ecy, rx, ry, col, a=255):
        for y in range(max(0, int(ecy - ry)), min(h, int(ecy + ry) + 1)):
            for x in range(max(0, int(ecx - rx)), min(w, int(ecx + rx) + 1)):
                nx = (x - ecx) / rx
                ny = (y - ecy) / ry
                e = nx * nx + ny * ny
                if e <= 1:
                    aa = a if e < 0.85 else int(a * (1 - e) / 0.15)
                    i = (y * w + x) * 4
                    if aa > buf[i + 3]:
                        px(buf, w, x, y, col[0], col[1], col[2], aa)

    skin = (210, 170, 130)
    skin_d = (170, 120, 90)
    skin_s = (230, 200, 170)
    draw_ellipse(hand, HW, HH, 90, 110, 48, 36, skin)
    for i, (fx, fy, frx, fry) in enumerate(
        [
            (55, 70, 12, 28),
            (75, 55, 12, 32),
            (95, 52, 12, 34),
            (115, 60, 11, 28),
            (130, 85, 14, 18),
        ]
    ):
        draw_ellipse(hand, HW, HH, fx, fy, frx, fry, skin if i % 2 == 0 else skin_s)
    draw_ellipse(hand, HW, HH, 90, 95, 40, 12, skin_d, 180)
    write_png(SPR / "hand.png", HW, HH, hand)
    print("done.")


if __name__ == "__main__":
    main()
