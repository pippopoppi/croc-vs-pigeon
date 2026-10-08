#!/usr/bin/env python3
"""Compose og.png (1200x630 X/OpenGraph card) and icon-180.png from a captured game frame.

tools/frame.png is a 800x1440 screenshot of the game (two times the 400x720 logical size).
Capture a fresh one with the headless Firefox preview harness when the art changes.
"""
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRAME = os.path.join(ROOT, "tools", "frame.png")


def font(size, bold=True):
    for c in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if os.path.exists(c):
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


def card():
    frame = Image.open(FRAME).convert("RGB")
    fw, fh = frame.size
    k = fw / 800
    band = frame.crop((0, int(620 * k), fw, int(1040 * k))).resize((1200, 630), Image.LANCZOS)
    d = ImageDraw.Draw(band, "RGBA")
    d.rectangle((0, 0, 1200, 110), fill=(10, 20, 30, 170))
    d.text((40, 22), "COCCODRILLO VS PICCIONE", font=font(58), fill="#b9e18c")
    d.rectangle((0, 500, 1200, 630), fill=(10, 20, 30, 185))
    d.text((40, 514), "ONE CROCODILE. INFINITE PIGEONS. ZERO DIGNITY.", font=font(38), fill="#ffd84a")
    d.text((42, 570), "Hold to charge, release to bite, dodge, survive.  Pippo Poppi Games.", font=font(26, bold=False), fill="#fff")
    band.save(os.path.join(ROOT, "og.png"), optimize=True)
    print("wrote og.png")


def icon():
    frame = Image.open(FRAME).convert("RGB")
    k = frame.size[0] / 800
    crop = frame.crop((int(150 * k), int(700 * k), int(470 * k), int(1020 * k))).resize((180, 180), Image.LANCZOS)
    crop.save(os.path.join(ROOT, "icon-180.png"), optimize=True)
    print("wrote icon-180.png")


if __name__ == "__main__":
    card()
    icon()
