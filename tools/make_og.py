#!/usr/bin/env python3
"""Render og.png (1200x630 X/OpenGraph card) and icon-180.png with Pillow, pixel-art style."""
import os
import random

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
random.seed(9)


def font(size, bold=True):
    for c in ["/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]:
        if os.path.exists(c):
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


def scene():
    # draw at 200x105 then scale x6 with nearest neighbour for chunky pixels
    W, H = 200, 105
    img = Image.new("RGB", (W, H), "#79c8f3")
    d = ImageDraw.Draw(img)
    for y in range(0, 80):
        d.line((0, y, W, y), fill=(121 + int(y * 1.2), 200 + int(y * 0.4), 243))
    d.rectangle((158, 8, 171, 21), fill="#ffe28a")
    for x, y, w in [(10, 12, 18), (70, 20, 24), (130, 10, 16)]:
        d.rectangle((x, y, x + w, y + 5), fill="#fff"); d.rectangle((x + 4, y - 3, x + w - 4, y), fill="#fff")
    for i in range(9):
        bw, bh = 14 + (i * 7) % 12, 20 + (i * 13) % 26
        d.rectangle((i * 23, 70 - bh, i * 23 + bw, 70), fill="#9fb3c9")
    d.rectangle((22, 50, 58, 70), fill="#8a9db3"); d.pieslice((22, 36, 58, 64), 180, 360, fill="#8a9db3")
    d.rectangle((112, 40, 192, 70), fill="#c9b58e")
    for row in range(2):
        for i in range(8):
            d.rectangle((115 + i * 10, 44 + row * 12, 121 + i * 10, 52 + row * 12), fill="#8f7a56")
    for x in [6, 96, 196]:
        d.rectangle((x - 1, 56, x + 1, 72), fill="#5a3d24"); d.rectangle((x - 10, 50, x + 10, 56), fill="#3f7a3c")
    d.rectangle((0, 70, W, H), fill="#5d708d")
    for y in range(74, H, 8):
        for x in range(((y // 8) % 2) * 4, W, 8):
            d.rectangle((x, y, x + 5, y + 4), fill="#6a7d9a")
    # croc
    x, y = 70, 56
    d.rectangle((x - 46, y + 10, x - 28, y + 16), fill="#225a30"); d.rectangle((x - 54, y + 13, x - 44, y + 17), fill="#225a30")
    d.rectangle((x - 32, y + 4, x + 14, y + 22), fill="#398c40"); d.rectangle((x - 30, y + 16, x + 12, y + 22), fill="#a0d779")
    for i in range(5):
        d.rectangle((x - 28 + i * 9, y, x - 24 + i * 9, y + 5), fill="#225a30")
    d.rectangle((x - 24, y + 22, x - 17, y + 30), fill="#225a30"); d.rectangle((x + 2, y + 22, x + 9, y + 30), fill="#225a30")
    d.rectangle((x + 8, y - 2, x + 38, y + 10), fill="#398c40"); d.rectangle((x + 14, y - 6, x + 26, y), fill="#398c40")
    d.rectangle((x + 18, y - 5, x + 22, y - 1), fill="#fff"); d.rectangle((x + 20, y - 4, x + 22, y - 2), fill="#111")
    d.rectangle((x + 10, y + 10, x + 38, y + 22), fill="#c03a4a"); d.rectangle((x + 8, y + 22, x + 40, y + 28), fill="#225a30")
    for i in range(5):
        d.rectangle((x + 12 + i * 6, y + 10, x + 14 + i * 6, y + 13), fill="#fff"); d.rectangle((x + 14 + i * 6, y + 19, x + 16 + i * 6, y + 22), fill="#fff")
    # pigeons
    def pigeon(px, py, col, dark, glasses=False, gold=False, flip=False):
        f = -1 if flip else 1
        rect = d.rectangle
        d.rectangle = lambda xy, fill=None: rect((min(xy[0], xy[2]), min(xy[1], xy[3]), max(xy[0], xy[2]), max(xy[1], xy[3])), fill=fill)
        d.rectangle((px - 8, py - 4, px + 6, py + 4), fill=col); d.rectangle((px - 10, py - 2, px - 6, py + 2), fill=dark)
        d.rectangle((px + 4 * f, py - 8, px + 11 * f, py - 1), fill=col); d.rectangle((px + 8 * f, py - 6, px + 10 * f, py - 4), fill="#111")
        d.rectangle((px + 11 * f, py - 5, px + 15 * f, py - 3), fill="#e7ae58"); d.rectangle((px - 6, py - 10, px + 4, py - 6), fill=dark)
        if glasses:
            d.rectangle((px + 5 * f, py - 7, px + 12 * f, py - 4), fill="#111")
        if gold:
            d.rectangle((px - 12, py - 12, px - 10, py - 10), fill="#fff")
        d.rectangle = rect
    pigeon(120, 22, "#9aa4ad", "#6b7680")
    pigeon(150, 38, "#9aa4ad", "#6b7680", flip=True)
    pigeon(175, 18, "#8d96a0", "#5f6973", glasses=True)
    pigeon(100, 40, "#f6c445", "#b8860b", gold=True)
    pigeon(185, 50, "#9aa4ad", "#6b7680", flip=True)
    # poop
    for px, py in [(118, 40), (152, 55)]:
        d.rectangle((px - 2, py - 3, px + 2, py + 2), fill="#f3f0e6")
    return img


def card():
    W, H = 1200, 630
    base = scene().resize((1200, 630), Image.NEAREST)
    img = base.convert("RGB")
    d = ImageDraw.Draw(img, "RGBA")
    d.rectangle((0, 0, W, 96), fill=(0, 0, 0, 150))
    d.text((40, 18), "COCCODRILLO VS PICCIONE", font=font(54), fill="#a0d779")
    d.rectangle((0, 470, W, 630), fill=(0, 0, 0, 160))
    d.text((40, 488), "ONE CROCODILE. INFINITE PIGEONS. ZERO DIGNITY.", font=font(40), fill="#ffd84a")
    d.text((40, 548), "Hold to charge, release to bite, dodge, survive. Pippo Poppi Games.", font=font(28, bold=False), fill="#fff")
    img.save(os.path.join(ROOT, "og.png"), optimize=True)
    print("wrote og.png")


def icon():
    img = scene().crop((30, 40, 120, 90)).resize((180, 100), Image.NEAREST)
    out = Image.new("RGB", (180, 180), "#79c8f3")
    out.paste(img, (0, 40))
    out.save(os.path.join(ROOT, "icon-180.png"), optimize=True)
    print("wrote icon-180.png")


if __name__ == "__main__":
    card()
    icon()
