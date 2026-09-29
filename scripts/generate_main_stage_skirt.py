"""
Generate high-fidelity, aspect-ratio-corrected 4096x1024 texture for the front skirt
of Duża Scena (Main Stage) at Pol'and'Rock Festival 2026.

Stage front skirt dimensions in 3D:
Width: 30.0 meters (X in [-15.0, +15.0])
Height: 2.2 meters (Y in [0.0, 2.2])

Contains:
1. Natural blonde pine vertical planks with realistic wood grain, knot variations,
   vertical plank seams, and metallic screw fixings.
2. 80+ authentic Polish town road signs and festival plaques in multiple staggered tiers:
   - Green highway signs (E-4 style, #006837)
   - Blue expressway signs (#003896)
   - White town limit signs (E-17a style, white with black border)
   - Red WOŚP / Pol'and'Rock festival signs (#C8102E)
   - Yellow warning / Woodstock detour signs (#F5A800)
3. Correct horizontal anisotropic compensation factor (30.0/2.2 / (4096/1024) = 3.409x)
   so every sign has razor-sharp, perfectly proportioned, un-distorted typography in-game.
4. Positioned in tiers starting at eye-level down to ground, clearing flight cases.
"""

import math
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONTS_DIR = Path('C:/Windows/Fonts')
FONT_ARIAL_BOLD = str(FONTS_DIR / 'arialbd.ttf')
FONT_SEGOE_BOLD = str(FONTS_DIR / 'segoeuib.ttf')
FONT_IMPACT = str(FONTS_DIR / 'impact.ttf')

# Skirt dimensions
TEX_W = 4096
TEX_H = 1024
STAGE_W = 30.0  # meters
STAGE_H = 2.2   # meters

def get_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()

def draw_heart(draw, center, size, fill_color):
    cx, cy = center
    w, h = size
    r = w / 4.0
    draw.ellipse([cx - w/2, cy - h/2, cx, cy], fill=fill_color)
    draw.ellipse([cx, cy - h/2, cx + w/2, cy], fill=fill_color)
    draw.polygon([(cx - w/2 + 2, cy - r/2), (cx + w/2 - 2, cy - r/2), (cx, cy + h/2)], fill=fill_color)

def generate_wood_background(w, h):
    """Creates warm vertical blonde pine stage skirt planks with seams and grain."""
    img = Image.new('RGBA', (w, h), (218, 185, 142, 255))
    draw = ImageDraw.Draw(img)

    # In 30m, a plank is ~15cm wide -> 200 planks across 4096 px -> ~20.48 px per plank
    plank_px = 20.48
    num_planks = int(math.ceil(w / plank_px))

    random.seed(42)

    for i in range(num_planks):
        x0 = int(round(i * plank_px))
        x1 = int(round((i + 1) * plank_px))
        
        # Tone variation between planks
        shade = random.randint(-18, 18)
        base_r = min(255, max(0, 218 + shade + random.randint(-4, 4)))
        base_g = min(255, max(0, 184 + shade + random.randint(-4, 4)))
        base_b = min(255, max(0, 142 + int(shade * 0.8) + random.randint(-3, 3)))
        draw.rectangle([x0, 0, x1, h], fill=(base_r, base_g, base_b, 255))

        # Vertical wood grain lines inside each plank
        for _ in range(random.randint(4, 9)):
            gx = random.randint(x0, x1 - 1)
            g_shade = random.randint(-12, 10)
            gr = min(255, max(0, base_r + g_shade))
            gg = min(255, max(0, base_g + g_shade))
            gb = min(255, max(0, base_b + g_shade))
            draw.line([(gx, 0), (gx, h)], fill=(gr, gg, gb, 255), width=1)

        # Dark recessed shadow gap between planks
        draw.line([(x0, 0), (x0, h)], fill=(90, 68, 45, 255), width=2)
        # Highlight on the left edge of plank
        draw.line([(x0 + 2, 0), (x0 + 2, h)], fill=(min(255, base_r + 22), min(255, base_g + 20), min(255, base_b + 16), 255), width=1)

        # Fastener screws/rivets top, middle, bottom
        for sy in [int(h * 0.08), int(h * 0.5), int(h * 0.92)]:
            scx = (x0 + x1) // 2
            draw.ellipse([scx - 2, sy - 2, scx + 2, sy + 2], fill=(130, 120, 110, 255), outline=(60, 50, 40, 255))

    return img

def render_sign_buffer(text, sign_type, width_m, height_m):
    """
    Renders an undistorted, razor-sharp road sign buffer with authentic typography.
    Dimensions in meters: width_m x height_m.
    Internal DPI: 600 px/meter for extreme sharpness.
    """
    scale = 600.0
    bw = int(round(width_m * scale))
    bh = int(round(height_m * scale))

    # Styling presets
    if sign_type == 'green':      # Standard Polish road sign (Drogowskaz E-4)
        bg_col = (0, 104, 55, 255)       # Deep highway green
        border_col = (255, 255, 255, 255) # Pure white
        text_col = (255, 255, 255, 255)
        outer_border = (0, 60, 30, 255)
    elif sign_type == 'blue':     # Express / Highway sign
        bg_col = (0, 70, 160, 255)       # Expressway blue
        border_col = (255, 255, 255, 255)
        text_col = (255, 255, 255, 255)
        outer_border = (0, 35, 90, 255)
    elif sign_type == 'white':    # E-17a Town border entrance sign
        bg_col = (248, 249, 250, 255)    # White reflective
        border_col = (20, 95, 45, 255)    # Green inner border
        text_col = (15, 18, 22, 255)      # Deep black
        outer_border = (30, 35, 40, 255)
    elif sign_type == 'red':      # Festival special / WOŚP
        bg_col = (200, 16, 46, 255)      # WOŚP festival red
        border_col = (255, 255, 255, 255)
        text_col = (255, 255, 255, 255)
        outer_border = (120, 8, 25, 255)
    elif sign_type == 'yellow':   # Detour / Woodstock rock sign
        bg_col = (245, 168, 0, 255)      # Warning amber yellow
        border_col = (20, 20, 24, 255)
        text_col = (20, 20, 24, 255)
        outer_border = (180, 120, 0, 255)
    else:
        bg_col = (0, 104, 55, 255)
        border_col = (255, 255, 255, 255)
        text_col = (255, 255, 255, 255)
        outer_border = (0, 60, 30, 255)

    img = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    corner_r = int(round(bh * 0.16))

    # 1. Sign Base Rounded Rectangle
    draw.rounded_rectangle([0, 0, bw - 1, bh - 1], radius=corner_r, fill=bg_col, outline=outer_border, width=int(round(bh * 0.02)))

    # 2. Authentic inner border inset
    inset = int(round(bh * 0.08))
    border_w = max(2, int(round(bh * 0.045)))
    inner_r = max(2, corner_r - inset)
    draw.rounded_rectangle([inset, inset, bw - 1 - inset, bh - 1 - inset], radius=inner_r, outline=border_col, width=border_w)

    # 3. Corner Mounting Screws/Rivets
    screw_r = int(round(bh * 0.045))
    s_inset = int(round(bh * 0.11))
    corners = [
        (s_inset, s_inset),
        (bw - 1 - s_inset, s_inset),
        (s_inset, bh - 1 - s_inset),
        (bw - 1 - s_inset, bh - 1 - s_inset)
    ]
    for scx, scy in corners:
        draw.ellipse([scx - screw_r, scy - screw_r, scx + screw_r, scy + screw_r], fill=(210, 215, 220, 255), outline=(70, 75, 80, 255), width=1)
        # Screw slit
        draw.line([(scx - screw_r + 2, scy), (scx + screw_r - 2, scy)], fill=(80, 85, 90, 255), width=2)

    # 4. Text Rendering
    # Select font size that comfortably fits inside the sign
    font_path = FONT_ARIAL_BOLD
    target_text_w = bw - 2 * (s_inset + screw_r + 14)
    target_text_h = bh - 2 * inset - 10

    # Start with ideal font size and scale down if needed
    font_size = int(round(bh * 0.50))
    font = get_font(font_path, font_size)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]

    while (tw > target_text_w or th > target_text_h) and font_size > 12:
        font_size -= 2
        font = get_font(font_path, font_size)
        bbox = draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]

    tx = (bw - tw) // 2
    # Vertical centering with cap-height adjustment
    ty = (bh - th) // 2 - int(round(font_size * 0.08))

    # Subtle drop shadow for high contrast text readability
    if sign_type in ('green', 'blue', 'red'):
        draw.text((tx + 2, ty + 2), text, fill=(0, 0, 0, 160), font=font)
    draw.text((tx, ty), text, fill=text_col, font=font)

    # Optional WOŚP Heart on red / festival signs
    if sign_type == 'red' and width_m >= 1.3:
        heart_w = int(round(bh * 0.35))
        draw_heart(draw, (s_inset + screw_r + heart_w // 2 + 10, bh // 2), (heart_w, heart_w), (255, 255, 255, 255))
        draw_heart(draw, (bw - 1 - (s_inset + screw_r + heart_w // 2 + 10), bh // 2), (heart_w, heart_w), (255, 255, 255, 255))

    return img

def paste_sign_to_skirt(skirt_img, sign_buf, x_center_m, y_center_m, width_m, height_m):
    """
    Pastes a sign onto the 4096x1024 skirt texture at real world coordinates.
    Compensates for the 3.409x horizontal stretching in the 3D model!
    """
    # Real-world coordinate mapping:
    # X in [-15.0, +15.0] -> U in [0.0, 1.0] -> pixel X in [0, 4096]
    # Y in [0.0, 2.2]     -> V in [0.0, 1.0] -> pixel Y in [1024, 0]
    
    px_per_m_x = TEX_W / STAGE_W   # 4096 / 30.0 = 136.533
    px_per_m_y = TEX_H / STAGE_H   # 1024 / 2.2  = 465.455

    target_w_px = max(4, int(round(width_m * px_per_m_x)))
    target_h_px = max(4, int(round(height_m * px_per_m_y)))

    # Resample sign buffer using high-fidelity Lanczos
    sign_resized = sign_buf.resize((target_w_px, target_h_px), Image.Resampling.LANCZOS)

    # Center position in texture pixels
    u = (x_center_m + STAGE_W / 2.0) / STAGE_W
    v = y_center_m / STAGE_H
    
    cx_px = int(round(u * TEX_W))
    cy_px = int(round((1.0 - v) * TEX_H))

    x0 = cx_px - target_w_px // 2
    y0 = cy_px - target_h_px // 2

    # Draw contact drop shadow on the wood behind the sign
    shadow_pad = 12
    shadow_img = Image.new('RGBA', (target_w_px + shadow_pad * 2, target_h_px + shadow_pad * 2), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow_img)
    s_draw.rectangle([shadow_pad - 1, shadow_pad + 2, shadow_pad + target_w_px, shadow_pad + target_h_px + 3], fill=(0, 0, 0, 95))
    shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(radius=3))
    
    skirt_img.paste(shadow_img, (x0 - shadow_pad, y0 - shadow_pad), mask=shadow_img)
    skirt_img.paste(sign_resized, (x0, y0), mask=sign_resized)

def build_main_stage_skirt_texture(output_path):
    print(f"Generating authentic Duża Scena skirt texture: {output_path}")
    skirt_img = generate_wood_background(TEX_W, TEX_H)

    # Authentic towns and plaques catalogue for Pol'and'Rock
    # Tier 1 (Top Tier, Y=1.72m, height 0.33m) - 22 major cities & iconic sites
    tier1_items = [
        ("CZYMANOWO", "green", 1.25),
        ("SZCZECIN", "green", 1.15),
        ("KOSTRZYN NAD ODRĄ", "green", 1.65),
        ("GDAŃSK", "blue", 1.05),
        ("WARSZAWA", "green", 1.20),
        ("POL'AND'ROCK", "red", 1.45),
        ("KRAKÓW", "green", 1.10),
        ("WROCŁAW", "blue", 1.15),
        ("CZAPLINEK", "green", 1.25),
        ("POZNAŃ", "green", 1.10),
        ("ŻARY", "green", 0.95),
        ("ŁÓDŹ", "blue", 0.95),
        ("KATOWICE", "green", 1.15),
        ("LUBLIN", "green", 1.05),
        ("WOODSTOCK POLAND", "red", 1.55),
        ("TORUŃ", "green", 1.00),
        ("BYDGOSZCZ", "blue", 1.15),
        ("BIAŁYSTOK", "green", 1.15),
        ("ZIELONA GÓRA", "green", 1.35),
        ("GORZÓW WLKP.", "green", 1.35),
        ("KIELCE", "blue", 1.00),
        ("OLSZTYN", "green", 1.10),
    ]

    # Tier 2 (Middle-High Tier, Y=1.28m, height 0.32m) - 24 regional capitals and towns
    tier2_items = [
        ("BROCZYNO", "white", 1.15),
        ("OPOLE", "blue", 1.00),
        ("CZĘSTOCHOWA", "green", 1.35),
        ("GDYNIA", "blue", 1.05),
        ("RZESZÓW", "green", 1.10),
        ("RADOM", "green", 1.00),
        ("SOSNOWIEC", "blue", 1.15),
        ("GLIWICE", "green", 1.05),
        ("BIELSKO-BIAŁA", "green", 1.35),
        ("ZABRZE", "blue", 1.05),
        ("BYTOM", "green", 1.00),
        ("MIŁOŚĆ PRZYJAŹŃ MUZYKA", "red", 1.70),
        ("RYBNIK", "green", 1.05),
        ("DĄBROWA GÓRN.", "blue", 1.30),
        ("PŁOCK", "green", 1.00),
        ("ELBLĄG", "green", 1.05),
        ("WAŁBRZYCH", "blue", 1.15),
        ("WŁOCŁAWEK", "green", 1.20),
        ("TARNÓW", "green", 1.05),
        ("CHORZÓW", "blue", 1.10),
        ("KOSZALIN", "green", 1.15),
        ("KALISZ", "green", 1.00),
        ("LEGNICA", "blue", 1.05),
        ("GRUDZIĄDZ", "green", 1.15),
    ]

    # Tier 3 (Middle-Low Tier, Y=0.84m, height 0.30m) - 25 vibrant festival towns
    tier3_items = [
        ("SŁUPSK", "green", 1.00),
        ("JASTRZĘBIE-ZDRÓJ", "blue", 1.40),
        ("JAWORZNO", "green", 1.10),
        ("NOWY SĄCZ", "green", 1.15),
        ("JELENIA GÓRA", "blue", 1.25),
        ("SIEDLCE", "green", 1.05),
        ("MYSŁOWICE", "green", 1.10),
        ("KONIN", "blue", 0.95),
        ("PIŁA", "green", 0.95),
        ("ZARAZ BĘDZIE CZYSTO", "yellow", 1.60),
        ("PIOTRKÓW TRYB.", "green", 1.30),
        ("INOWROCŁAW", "blue", 1.20),
        ("OSTRÓW WLKP.", "green", 1.25),
        ("SUWAŁKI", "green", 1.05),
        ("STARGARD", "blue", 1.10),
        ("GNIEZNO", "green", 1.05),
        ("OSTROWIEC ŚW.", "green", 1.25),
        ("ZAMOŚĆ", "blue", 1.05),
        ("LESZNO", "green", 1.00),
        ("CHEŁM", "green", 0.95),
        ("PRZEMYŚL", "blue", 1.10),
        ("KROSNO", "green", 1.00),
        ("ŚWIDNICA", "green", 1.10),
        ("EŁK", "blue", 0.85),
    ]

    # Tier 4 (Lower Tier in gaps & near ground, Y=0.40m, height 0.28m) - 20 authentic Woodstock towns
    tier4_items = [
        ("KOŁOBRZEG", "blue", 1.10),
        ("ŚWINOUJŚCIE", "green", 1.20),
        ("POKOJOWY PATROL", "red", 1.45),
        ("SANOK", "green", 0.95),
        ("ZAKOPANE", "white", 1.10),
        ("HEL", "green", 0.85),
        ("MIĘDZYZDROJE", "blue", 1.25),
        ("ZŁOCIENIEC", "green", 1.10),
        ("POŁCZYN-ZDRÓJ", "green", 1.25),
        ("SIEMANKO!", "red", 1.15),
        ("DRAWSKO POM.", "blue", 1.25),
        ("KŁOBUCK", "green", 1.05),
        ("ŻAGAŃ", "green", 1.00),
        ("ŚWIEBODZIN", "blue", 1.15),
        ("SŁUBICE", "green", 1.05),
        ("BOLESŁAWIEC", "green", 1.20),
        ("GŁOGÓW", "blue", 1.05),
        ("SZCZECINEK", "green", 1.15),
        ("MIROSŁAWIEC", "green", 1.15),
        ("JAROCIN", "yellow", 1.10),
    ]

    tiers = [
        (tier1_items, 1.72, 0.33),
        (tier2_items, 1.28, 0.31),
        (tier3_items, 0.84, 0.29),
        (tier4_items, 0.40, 0.27),
    ]

    for tier_idx, (items, y_center, h_m) in enumerate(tiers):
        # Calculate total width of items in this tier
        total_items_w = sum(w for _, _, w in items)
        available_span = 28.6  # from -14.3m to +14.3m
        num_gaps = len(items) + 1
        gap_w = max(0.06, (available_span - total_items_w) / num_gaps)

        # Stagger starting offset slightly between tiers
        stagger = (tier_idx % 2) * (gap_w * 0.5)
        cur_x = -14.3 + gap_w + stagger

        for text, stype, w_m in items:
            cx = cur_x + w_m / 2.0
            if cx + w_m / 2.0 > 14.6:
                break
            sign_buf = render_sign_buffer(text, stype, w_m, h_m)
            paste_sign_to_skirt(skirt_img, sign_buf, cx, y_center, w_m, h_m)
            cur_x += w_m + gap_w

    skirt_img.save(output_path, quality=95)
    print(f"Successfully generated {output_path} ({TEX_W}x{TEX_H}) with {sum(len(t[0]) for t in tiers)} authentic signs!")

if __name__ == '__main__':
    out_file = Path('source-assets/stages/main_stage_skirt.png')
    out_file.parent.mkdir(parents=True, exist_ok=True)
    build_main_stage_skirt_texture(out_file)
