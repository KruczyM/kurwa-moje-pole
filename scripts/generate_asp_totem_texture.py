"""
Generates ultra-high-resolution, authentic Pol'and'Rock Festival ASP totem column textures
matching media_1790448432265.png:
- Authentic Woodstock psychedelic folk floral graffiti (cobalt, magenta, fiery orange, lime)
- Top: Bold white slab 'ASP' + red heart
- Below ASP: 32. edition badge
- Center: Vertical calligraphic white "Pol'and'Rock" lettering (rotate 90 degrees) reading upwards, exactly matching photo!
- Lower: SIEMA! heart
- Lower pedestal face texture with giant 'ASP', WOŚP heart, and steel rivets
"""
import math
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONTS_DIR = Path('C:/Windows/Fonts')
FONT_IMPACT = str(FONTS_DIR / 'impact.ttf')
FONT_ARIAL_BOLD = str(FONTS_DIR / 'arialbd.ttf')
FONT_SEGOE_SCRIPT = str(FONTS_DIR / 'segoescb.ttf')

def get_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        try:
            return ImageFont.truetype(FONT_ARIAL_BOLD, size)
        except Exception:
            return ImageFont.load_default()

def draw_heart(draw, center, size, fill_color, outline_color=None):
    cx, cy = center
    w, h = size
    r = w / 4.0
    draw.ellipse([cx - w/2, cy - h/2, cx, cy], fill=fill_color)
    draw.ellipse([cx, cy - h/2, cx + w/2, cy], fill=fill_color)
    draw.polygon([(cx - w/2 + 2, cy - r/2), (cx + w/2 - 2, cy - r/2), (cx, cy + h/2)], fill=fill_color)

def generate_psychedelic_pattern(w, h, seed=42):
    """Draws rich, colorful Pol'and'Rock / Woodstock folk art floral graffiti."""
    random.seed(seed)
    base = Image.new('RGBA', (w, h), (14, 18, 36, 255))
    draw = ImageDraw.Draw(base)

    palette = [
        (225, 20, 95, 240),   # Magenta
        (0, 175, 235, 240),   # Cyan
        (255, 125, 10, 240),  # Orange
        (255, 215, 20, 240),  # Yellow
        (35, 195, 75, 240),   # Green
        (145, 30, 185, 240),  # Purple
        (235, 45, 45, 240),   # Red
        (0, 110, 210, 240),   # Royal blue
    ]

    for _ in range(42):
        cx = random.randint(0, w)
        cy = random.randint(0, h)
        radius = random.randint(80, 260)
        col = random.choice(palette)
        num_petals = random.randint(5, 9)
        for p in range(num_petals):
            angle = (2.0 * math.pi * p) / num_petals + random.uniform(-0.1, 0.1)
            px = cx + radius * math.cos(angle)
            py = cy + radius * math.sin(angle)
            pw = random.randint(30, 75)
            ph = random.randint(60, 140)
            draw.ellipse([px - pw, py - ph, px + pw, py + ph], fill=col, outline=(10, 12, 22, 255), width=3)
        draw.ellipse([cx - 35, cy - 35, cx + 35, cy + 35], fill=(255, 230, 50, 255), outline=(10, 12, 22, 255), width=4)
        draw.ellipse([cx - 15, cy - 15, cx + 15, cy + 15], fill=(220, 30, 30, 255))

    for _ in range(32):
        x0 = random.randint(-50, w + 50)
        y0 = random.randint(0, h)
        x1 = x0 + random.randint(-150, 150)
        y1 = y0 + random.randint(150, 400)
        col = random.choice(palette)
        draw.line([(x0, y0), (x1, y1)], fill=col, width=random.randint(12, 28))
        draw.line([(x0, y0), (x1, y1)], fill=(12, 14, 24, 255), width=3)

    return base

def generate_asp_totem_textures(output_tower_path, output_pedestal_path):
    # 1. Main Tower Texture (1024 x 2048)
    tw, th = 1024, 2048
    tower_img = generate_psychedelic_pattern(tw, th, seed=1995)

    vignette = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
    v_draw = ImageDraw.Draw(vignette)
    for y in range(th):
        alpha = int(45 + 55 * math.sin(math.pi * y / th))
        v_draw.line([(0, y), (tw, y)], fill=(8, 12, 24, alpha))
    tower_img = Image.alpha_composite(tower_img, vignette)
    draw = ImageDraw.Draw(tower_img)

    # --- TOP HEADER: "ASP" + HEART ---
    f_asp = get_font(FONT_IMPACT, 175)
    asp_bbox = draw.textbbox((0, 0), "ASP", font=f_asp)
    asp_w = asp_bbox[2] - asp_bbox[0]
    asp_x = (tw - asp_w) // 2 - 55
    asp_y = 65

    for dx, dy in [(7, 7), (6, 6), (5, 5), (4, 4), (3, 3), (2, 2)]:
        draw.text((asp_x + dx, asp_y + dy), "ASP", fill=(10, 10, 15, 255), font=f_asp)
    for ox in range(-6, 7):
        for oy in range(-6, 7):
            draw.text((asp_x + ox, asp_y + oy), "ASP", fill=(15, 15, 20, 255), font=f_asp)
    draw.text((asp_x, asp_y), "ASP", fill=(255, 255, 255, 255), font=f_asp)

    heart_x = asp_x + asp_w + 75
    heart_y = asp_y + 95
    draw_heart(draw, (heart_x, heart_y), (110, 110), (230, 20, 35, 255))
    f_heart_label = get_font(FONT_ARIAL_BOLD, 10)
    draw.text((heart_x - 30, heart_y - 12), "Wielka Orkiestra\nŚwiątecznej Pomocy", fill=(255, 255, 255, 255), font=f_heart_label, align="center")

    # --- EDITION BADGE ---
    badge_y = 285
    badge_r = 75
    draw.ellipse([tw//2 - badge_r, badge_y - badge_r, tw//2 + badge_r, badge_y + badge_r], fill=(255, 220, 30, 255), outline=(20, 20, 25, 255), width=5)
    draw.ellipse([tw//2 - badge_r + 8, badge_y - badge_r + 8, tw//2 + badge_r - 8, badge_y + badge_r - 8], fill=(225, 15, 30, 255))
    f_badge_num = get_font(FONT_IMPACT, 72)
    draw.text((tw//2 - 45, badge_y - 50), "32.", fill=(255, 255, 255, 255), font=f_badge_num)
    f_badge_sub = get_font(FONT_ARIAL_BOLD, 13)
    draw.text((tw//2 - 58, badge_y + 26), "POL'AND'ROCK", fill=(255, 235, 50, 255), font=f_badge_sub)

    # --- VERTICAL CALLIGRAPHIC SCRIPT "Pol'and'Rock" (Matches media_1790448432265.png!) ---
    # Rendered horizontally, then rotated 90 degrees counter-clockwise
    script_layer_w, script_layer_h = 1350, 290
    script_layer = Image.new('RGBA', (script_layer_w, script_layer_h), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(script_layer)

    f_script = get_font(FONT_SEGOE_SCRIPT, 140)
    text_str = "Pol'and'Rock"
    s_bbox = s_draw.textbbox((0, 0), text_str, font=f_script)
    s_tx = 40
    s_ty = (script_layer_h - (s_bbox[3] - s_bbox[1])) // 2 - 20

    for dx, dy in [(7, 7), (5, 5), (3, 3)]:
        s_draw.text((s_tx + dx, s_ty + dy), text_str, fill=(10, 12, 18, 255), font=f_script)
    for ox in range(-7, 8):
        for oy in range(-7, 8):
            s_draw.text((s_tx + ox, s_ty + oy), text_str, fill=(12, 15, 22, 255), font=f_script)
    s_draw.text((s_tx, s_ty), text_str, fill=(255, 255, 255, 255), font=f_script)
    s_draw.arc([s_tx + 30, s_ty + 130, s_tx + 1050, s_ty + 200], start=0, end=180, fill=(255, 255, 255, 255), width=8)

    # Rotate 90 degrees counter-clockwise so 'Pol' is near the bottom and 'Rock' near the top!
    rotated_script = script_layer.rotate(90, expand=True)

    rx = (tw - rotated_script.width) // 2
    ry = 385
    tower_img.alpha_composite(rotated_script, (rx, ry))

    draw = ImageDraw.Draw(tower_img)

    # --- LOWER HEART ---
    lower_heart_y = ry + rotated_script.height + 75
    draw_heart(draw, (tw // 2, lower_heart_y), (145, 145), (230, 20, 35, 255))
    draw.text((tw//2 - 46, lower_heart_y - 18), "SIEMA!", fill=(255, 255, 255, 255), font=get_font(FONT_IMPACT, 36))

    # Top & bottom black-and-yellow stage hazard trim
    trim_h = 28
    for x in range(0, tw, 40):
        draw.polygon([(x, 0), (x + 20, 0), (x, trim_h), (x - 20, trim_h)], fill=(255, 215, 0, 255))
        draw.polygon([(x + 20, 0), (x + 40, 0), (x + 20, trim_h), (x, trim_h)], fill=(20, 20, 25, 255))
        draw.polygon([(x, th - trim_h), (x + 20, th - trim_h), (x, th), (x - 20, th)], fill=(255, 215, 0, 255))
        draw.polygon([(x + 20, th - trim_h), (x + 40, th - trim_h), (x + 20, th), (x, th)], fill=(20, 20, 25, 255))

    tower_img.save(output_tower_path)
    print(f"Saved enhanced tower totem texture to {output_tower_path}")

    # 2. Pedestal Base Texture (1024 x 1024)
    pw, ph = 1024, 1024
    base_img = generate_psychedelic_pattern(pw, ph, seed=2024)
    b_draw = ImageDraw.Draw(base_img)

    f_ped_asp = get_font(FONT_IMPACT, 260)
    b_asp_bbox = b_draw.textbbox((0, 0), "ASP", font=f_ped_asp)
    b_asp_w = b_asp_bbox[2] - b_asp_bbox[0]
    b_asp_x = (pw - b_asp_w) // 2 - 80
    b_asp_y = (ph - 260) // 2

    for dx, dy in [(8, 8), (6, 6), (4, 4)]:
        b_draw.text((b_asp_x + dx, b_asp_y + dy), "ASP", fill=(10, 12, 18, 255), font=f_ped_asp)
    for ox in range(-7, 8):
        for oy in range(-7, 8):
            b_draw.text((b_asp_x + ox, b_asp_y + oy), "ASP", fill=(15, 18, 25, 255), font=f_ped_asp)
    b_draw.text((b_asp_x, b_asp_y), "ASP", fill=(255, 255, 255, 255), font=f_ped_asp)

    p_heart_x = b_asp_x + b_asp_w + 110
    p_heart_y = b_asp_y + 130
    draw_heart(b_draw, (p_heart_x, p_heart_y), (160, 160), (225, 20, 35, 255))
    b_draw.text((p_heart_x - 50, p_heart_y - 20), "Wielka Orkiestra\nŚwiątecznej Pomocy", fill=(255, 255, 255, 255), font=get_font(FONT_ARIAL_BOLD, 14), align="center")

    for cx in [35, pw - 35]:
        for cy in [35, ph - 35]:
            b_draw.ellipse([cx - 18, cy - 18, cx + 18, cy + 18], fill=(200, 205, 215, 255), outline=(50, 55, 65, 255), width=3)
            b_draw.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=(90, 95, 105, 255))

    base_img.save(output_pedestal_path)
    print(f"Saved pedestal base texture to {output_pedestal_path}")

if __name__ == '__main__':
    stages_dir = Path('source-assets/stages')
    stages_dir.mkdir(parents=True, exist_ok=True)
    generate_asp_totem_textures(stages_dir / 'asp_totem.png', stages_dir / 'asp_totem_pedestal.png')
