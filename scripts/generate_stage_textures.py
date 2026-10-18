"""
Generate high-fidelity textures for Scena ASP (Namiot ASP / Mala Scena):
1. asp_tent_front_gable.png (2048x1024) - authentic front gable wall banner
2. asp_backdrop.png (1024x1024) - authentic concert stage backdrop
3. asp_rug.png (512x512) - authentic Persian / oriental concert carpet
4. asp_wood_deck.png (1024x1024) - oak stage deck planks
5. asp_letters.png (512x256) - 3D zebra stripes
6. asp_totem.png (512x1024) - Woodstock folk art totems
7. asp_tent_canopy.png (1024x1024) - white translucent PVC membrane with architectural seams
"""

import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

FONTS_DIR = Path('C:/Windows/Fonts')
FONT_ARIAL_BOLD = str(FONTS_DIR / 'arialbd.ttf')
FONT_IMPACT = str(FONTS_DIR / 'impact.ttf')
FONT_SEGOE = str(FONTS_DIR / 'seguisb.ttf')
FONT_ARIAL = str(FONTS_DIR / 'arial.ttf')

def get_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()

def draw_heart(draw, center, size, fill_color, outline_color=None):
    cx, cy = center
    w, h = size
    r = w / 4.0
    draw.ellipse([cx - w/2, cy - h/2, cx, cy], fill=fill_color)
    draw.ellipse([cx, cy - h/2, cx + w/2, cy], fill=fill_color)
    draw.polygon([(cx - w/2 + 2, cy - r/2), (cx + w/2 - 2, cy - r/2), (cx, cy + h/2)], fill=fill_color)

def generate_front_gable(output_path):
    w, h = 2048, 1024
    img = Image.new('RGBA', (w, h), (247, 248, 250, 255))
    draw = ImageDraw.Draw(img)

    # Subtle vertical canvas seams every 128 px
    for x in range(0, w, 128):
        draw.line([(x, 0), (x, h)], fill=(234, 236, 240, 255), width=2)

    # Triangle safe zone positioning:
    # Top of triangle at X=1024, Y=0 (when V=1.0 at peak)
    # Bottom at Y=1024 (Z=3.2m lintel)
    # Safe branding area is placed in the center:
    # X in [480, 1568], Y in [280, 780]

    # 1. mBank Segmented Speech Bubble on Left
    mb_x, mb_y = 520, 340
    mb_w, mb_h = 230, 190
    col_w = mb_w // 4
    colors = [
        (224, 16, 32, 255),   # Red
        (242, 114, 0, 255),   # Orange
        (255, 199, 0, 255),   # Yellow
        (0, 166, 81, 255),    # Green
    ]
    for i, col in enumerate(colors):
        x0 = mb_x + i * col_w
        x1 = x0 + col_w
        draw.rectangle([x0, mb_y, x1, mb_y + mb_h], fill=col)

    # Speech bubble tail pointing down-right
    tail_pts = [(mb_x + 3 * col_w, mb_y + mb_h), (mb_x + mb_w, mb_y + mb_h + 38), (mb_x + mb_w, mb_y + mb_h)]
    draw.polygon(tail_pts, fill=colors[3])

    # "mBank" white bold text inside bubble
    f_mbank = get_font(FONT_ARIAL_BOLD, 44)
    draw.text((mb_x + 22, mb_y + 68), "mBank", fill=(255, 255, 255, 255), font=f_mbank)

    # 2. "zaprasza do" above ASP
    f_zaprasza = get_font(FONT_SEGOE, 38)
    draw.text((800, 335), "zaprasza do", fill=(75, 80, 90, 255), font=f_zaprasza)

    # 3. Zebra-striped "ASP" block letters using clean alpha mask
    asp_x, asp_y = 800, 385
    f_asp = get_font(FONT_IMPACT, 175)
    asp_bbox = draw.textbbox((0, 0), "ASP", font=f_asp)
    asp_w = asp_bbox[2] - asp_bbox[0]

    mask = Image.new('L', (w, h), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.text((asp_x, asp_y), "ASP", fill=255, font=f_asp)

    # Cut horizontal stripes out of mask
    stripe_h = 13
    gap_h = 15
    for ys in range(asp_y + 5, asp_y + 200, stripe_h + gap_h):
        mask_draw.rectangle([asp_x - 10, ys, asp_x + asp_w + 10, ys + stripe_h], fill=0)

    # Paste dark charcoal letters via mask
    img.paste((22, 22, 26, 255), (0, 0), mask=mask)

    # 4. Red WOSP Heart to the right of ASP
    draw_heart(draw, (asp_x + asp_w + 80, 475), (130, 130), (224, 20, 35, 255))
    f_heart = get_font(FONT_ARIAL_BOLD, 12)
    draw.text((asp_x + asp_w + 40, 460), "Wielka Orkiestra\nŚwiątecznej Pomocy", fill=(255, 255, 255, 255), font=f_heart, align="center")

    # 5. Cursive "Pol'and'Rock" Script below ASP
    f_rock = get_font(FONT_IMPACT, 140)
    rock_text = "Pol'and'Rock"
    bbox = draw.textbbox((0, 0), rock_text, font=f_rock)
    tw = bbox[2] - bbox[0]
    rx = (w - tw) // 2
    ry = 590
    draw.text((rx, ry), rock_text, fill=(25, 25, 28, 255), font=f_rock)

    # "• FESTIVAL POLAND •"
    f_sub = get_font(FONT_ARIAL_BOLD, 36)
    sub_text = "•  F E S T I V A L   P O L A N D  •"
    sbbox = draw.textbbox((0, 0), sub_text, font=f_sub)
    sw = sbbox[2] - sbbox[0]
    draw.text(((w - sw) // 2, ry + 145), sub_text, fill=(40, 45, 52, 255), font=f_sub)

    # Sponsor badges in corners
    f_mini = get_font(FONT_ARIAL_BOLD, 24)
    draw.text((120, h - 80), "mBank • ASP", fill=(180, 185, 195, 255), font=f_mini)
    draw.text((w - 280, h - 80), "Pol'and'Rock 2026", fill=(180, 185, 195, 255), font=f_mini)

    img.save(output_path)
    print(f"Saved front gable texture to {output_path}")

def generate_backdrop(output_path):
    w, h = 1024, 1024
    # Deep vibrant concert crimson red
    img = Image.new('RGBA', (w, h), (160, 14, 26, 255))
    draw = ImageDraw.Draw(img)

    # 1. Concentric Woodstock Folk Mandala / Sunburst
    cx, cy = w // 2, 215
    num_rays = 36
    for i in range(num_rays):
        angle = (2 * math.pi * i) / num_rays
        rx = cx + 330 * math.cos(angle)
        ry = cy + 330 * math.sin(angle)
        draw.line([(cx, cy), (rx, ry)], fill=(195, 25, 38, 255), width=3)
        draw.ellipse([rx - 10, ry - 10, rx + 10, ry + 10], fill=(225, 50, 60, 255))

    for r in [90, 175, 260]:
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(195, 25, 38, 255), width=3)

    # 2. Zebra-striped "ASP" block letters using clean mask
    f_asp = get_font(FONT_IMPACT, 125)
    asp_bbox = draw.textbbox((0, 0), "ASP", font=f_asp)
    aw = asp_bbox[2] - asp_bbox[0]
    ax = (w - aw) // 2 - 40
    ay = 135

    mask = Image.new('L', (w, h), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.text((ax, ay), "ASP", fill=255, font=f_asp)
    for ys in range(ay + 5, ay + 140, 18):
        mask_draw.rectangle([ax - 10, ys, ax + aw + 10, ys + 8], fill=0)

    # Paste dark charcoal letters via mask
    img.paste((20, 20, 22, 255), (0, 0), mask=mask)

    # Red WOŚP Heart next to ASP
    draw_heart(draw, (ax + aw + 80, 195), (95, 95), (230, 25, 40, 255))

    # 3. Iconic Slogan: "MAŁA SCENA TYLKO Z NAZWY"
    f_slogan = get_font(FONT_IMPACT, 68)
    slogan1 = "MAŁA SCENA"
    slogan2 = "TYLKO Z NAZWY"
    b1 = draw.textbbox((0, 0), slogan1, font=f_slogan)
    b2 = draw.textbbox((0, 0), slogan2, font=f_slogan)
    w1, w2 = b1[2] - b1[0], b2[2] - b2[0]

    # Bold warm yellow letters with deep crimson drop shadow
    draw.text(((w - w1) // 2 + 2, 277), slogan1, fill=(90, 5, 12, 255), font=f_slogan)
    draw.text(((w - w1) // 2, 275), slogan1, fill=(255, 225, 35, 255), font=f_slogan)

    draw.text(((w - w2) // 2 + 2, 342), slogan2, fill=(90, 5, 12, 255), font=f_slogan)
    draw.text(((w - w2) // 2, 340), slogan2, fill=(255, 225, 35, 255), font=f_slogan)

    # 4. Horizontal Lighting Truss Line with Concert Blinders
    truss_y = 430
    draw.rectangle([30, truss_y - 8, w - 30, truss_y + 8], fill=(25, 25, 30, 255))
    num_blinders = 20
    for bi in range(num_blinders):
        bx = 50 + bi * ((w - 100) / (num_blinders - 1))
        draw.ellipse([bx - 12, truss_y - 12, bx + 12, truss_y + 12], fill=(255, 245, 190, 255), outline=(220, 170, 45, 255), width=2)

    # 5. Live Concert LED Video Display Screen (Lower half)
    screen_rect = [40, 460, w - 40, h - 40]
    draw.rectangle(screen_rect, fill=(125, 10, 20, 255), outline=(245, 195, 35, 255), width=4)

    # Video screen content
    f_band = get_font(FONT_IMPACT, 105)
    band_text = "ATMOSPHERE"
    bb = draw.textbbox((0, 0), band_text, font=f_band)
    bw = bb[2] - bb[0]
    draw.text(((w - bw) // 2, 625), band_text, fill=(255, 255, 255, 255), font=f_band)

    f_live = get_font(FONT_ARIAL_BOLD, 32)
    live_text = "POL'AND'ROCK FESTIVAL LIVE 2026"
    lb = draw.textbbox((0, 0), live_text, font=f_live)
    lw = lb[2] - lb[0]
    draw.text(((w - lw) // 2, 750), live_text, fill=(255, 220, 65, 255), font=f_live)

    img.save(output_path)
    print(f"Saved backdrop texture to {output_path}")

def generate_canopy(output_path):
    w, h = 1024, 1024
    img = Image.new('RGBA', (w, h), (246, 248, 250, 255))
    draw = ImageDraw.Draw(img)

    grid_x = 128
    grid_y = 128
    for x in range(0, w, grid_x):
        draw.line([(x, 0), (x, h)], fill=(225, 228, 234, 255), width=4)
        draw.line([(x + 2, 0), (x + 2, h)], fill=(255, 255, 255, 255), width=1)
    for y in range(0, h, grid_y):
        draw.line([(0, y), (w, y)], fill=(230, 233, 238, 255), width=2)

    img.save(output_path)
    print(f"Saved canopy texture to {output_path}")

if __name__ == '__main__':
    stages_dir = Path('source-assets/stages')
    stages_dir.mkdir(parents=True, exist_ok=True)
    generate_front_gable(stages_dir / 'asp_tent_front_gable.png')
    generate_backdrop(stages_dir / 'asp_backdrop.png')
    generate_canopy(stages_dir / 'asp_tent_canopy.png')
