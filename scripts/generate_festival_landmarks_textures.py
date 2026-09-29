"""
Generate high-fidelity textures for Pol'and'Rock Festival 2026 landmarks:
1. festival_gate_banner.png (2048x1024) - Brama Główna Pol'and'Rock (Main Festival Gate)
2. krishna_village_textures.png (2048x1024) - Pokojowa Wioska Kryszny (Hare Krishna Village)
3. mud_bath_textures.png (1024x1024) - Strefa Kąpieli Błotnej (The Legendary Mud Bath)
4. fire_truck_textures.png (2048x1024) - Wóz Strażacki OSP (Volunteer Fire Engine Water Cannon)
5. delay_tower_banner.png (1024x1024) - Wieża Nagłośnieniowa Delay (Sound & Light Tower)
"""

import math
import os
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
    if outline_color:
        draw.line([(cx - w/2, cy), (cx, cy + h/2), (cx + w/2, cy)], fill=outline_color, width=3)

def draw_sunflower(draw, center, radius, petal_color=(255, 204, 0, 255), core_color=(60, 35, 15, 255)):
    cx, cy = center
    num_petals = 16
    for i in range(num_petals):
        angle = (i / num_petals) * 2 * math.pi
        px = cx + math.cos(angle) * (radius * 0.75)
        py = cy + math.sin(angle) * (radius * 0.75)
        pr = radius * 0.35
        draw.ellipse([px - pr, py - pr, px + pr, py + pr], fill=petal_color)
    draw.ellipse([cx - radius * 0.45, cy - radius * 0.45, cx + radius * 0.45, cy + radius * 0.45], fill=core_color)

def draw_peace_sign(draw, center, radius, color, width=6):
    cx, cy = center
    draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], outline=color, width=width)
    draw.line([(cx, cy - radius), (cx, cy + radius)], fill=color, width=width)
    dx = radius * math.cos(math.pi / 4)
    dy = radius * math.sin(math.pi / 4)
    draw.line([(cx, cy), (cx - dx, cy + dy)], fill=color, width=width)
    draw.line([(cx, cy), (cx + dx, cy + dy)], fill=color, width=width)

# -------------------------------------------------------------
# 1. BRAMA FESTIWALOWA (Main Festival Gate)
# -------------------------------------------------------------
def generate_festival_gate(output_path):
    w, h = 2048, 1024
    img = Image.new('RGBA', (w, h), (25, 28, 35, 255))
    draw = ImageDraw.Draw(img)

    # Top Half: Main Crossbeam Arch Banner (2048 x 512)
    # Vibrant festival background with gradient sunset & festival sunburst
    for y in range(0, 512):
        factor = y / 512.0
        r = int(240 * (1 - factor) + 255 * factor * 0.9)
        g = int(40 * (1 - factor) + 120 * factor)
        b = int(70 * (1 - factor) + 15 * factor)
        draw.line([(0, y), (w, y)], fill=(r, g, b, 255))

    # Sunburst rays in the center
    cx, cy = 1024, 256
    for i in range(24):
        a1 = (i / 24.0) * 2 * math.pi
        a2 = ((i + 0.5) / 24.0) * 2 * math.pi
        p1 = (cx + math.cos(a1) * 1100, cy + math.sin(a1) * 1100)
        p2 = (cx + math.cos(a2) * 1100, cy + math.sin(a2) * 1100)
        draw.polygon([(cx, cy), p1, p2], fill=(255, 220, 50, 40))

    # Top border strip
    draw.rectangle([0, 0, w, 24], fill=(20, 20, 25, 255))
    draw.rectangle([0, 488, w, 512], fill=(20, 20, 25, 255))

    # Sunflowers on corners
    draw_sunflower(draw, (120, 140), 90)
    draw_sunflower(draw, (w - 120, 140), 90)
    draw_sunflower(draw, (360, 380), 75)
    draw_sunflower(draw, (w - 360, 380), 75)

    # Main header text
    f_sub = get_font(FONT_ARIAL_BOLD, 42)
    f_title = get_font(FONT_IMPACT, 128)
    f_sub2 = get_font(FONT_SEGOE, 52)
    f_slogan = get_font(FONT_ARIAL_BOLD, 48)

    draw.text((1024, 60), "NAJPIĘKNIEJSZY FESTIWAL ŚWIATA • CZAPLINEK-BROCZYNO 2026",
              fill=(255, 255, 255, 240), font=f_sub, anchor="mm")
    
    # Shadow and main title
    draw.text((1027, 183), "POL'AND'ROCK FESTIVAL", fill=(10, 10, 10, 255), font=f_title, anchor="mm")
    draw.text((1024, 180), "POL'AND'ROCK FESTIVAL", fill=(255, 245, 220, 255), font=f_title, anchor="mm")

    # WOSP Hearts flanking
    draw_heart(draw, (230, 256), (170, 150), (225, 25, 45, 255), (255, 255, 255, 255))
    draw_heart(draw, (w - 230, 256), (170, 150), (225, 25, 45, 255), (255, 255, 255, 255))
    draw_peace_sign(draw, (500, 256), 65, (255, 255, 255, 240), width=8)
    draw_peace_sign(draw, (w - 500, 256), 65, (255, 255, 255, 240), width=8)

    # Subtitles
    draw.text((1024, 290), "32. EDYCJA • WIELKA ORKIESTRA ŚWIĄTECZNEJ POMOCY",
              fill=(255, 235, 100, 255), font=f_sub2, anchor="mm")

    # Lower ribbon on arch
    draw.rectangle([150, 360, w - 150, 440], fill=(225, 25, 45, 255))
    draw.text((1024, 400), "MIŁOŚĆ • PRZYJAŹŃ • MUZYKA", fill=(255, 255, 255, 255), font=f_slogan, anchor="mm")

    # Bottom Half: Two Vertical Tower Banners (1024 x 512 each: Left Tower [0..1024, 512..1024], Right Tower [1024..2048, 512..1024])
    # Left Tower Banner: "ZARAZ BĘDZIE CIEMNO! ZARAZ BĘDZIE CZYSTO!"
    draw.rectangle([40, 530, 980, 1000], fill=(30, 130, 60, 255)) # Green background
    draw.rectangle([55, 545, 965, 985], outline=(255, 255, 255, 220), width=4)
    draw_heart(draw, (180, 640), (120, 110), (225, 25, 45, 255), (255, 255, 255, 255))
    draw_sunflower(draw, (840, 640), 55)
    f_tower_h = get_font(FONT_IMPACT, 72)
    f_tower_sub = get_font(FONT_ARIAL_BOLD, 44)
    draw.text((512, 640), "ZARAZ BĘDZIE CIEMNO!", fill=(255, 255, 255, 255), font=f_tower_h, anchor="mm")
    draw.text((512, 730), "ZARAZ BĘDZIE CZYSTO!", fill=(255, 240, 70, 255), font=f_tower_h, anchor="mm")
    draw.text((512, 820), "SEGREGUJ ODPADY • DBAJ O LOTNISKO", fill=(255, 255, 255, 255), font=f_tower_sub, anchor="mm")
    draw.text((512, 910), "ZABIERZ ZE SOBĄ SWÓJ NAMIOT I ŚMIECI!", fill=(255, 235, 100, 255), font=f_tower_sub, anchor="mm")

    # Right Tower Banner: "WITAJCIE W DOMU! • POKÓJ I MIŁOŚĆ"
    draw.rectangle([1068, 530, 2008, 1000], fill=(215, 60, 30, 255)) # Festival red/orange background
    draw.rectangle([1083, 545, 1993, 985], outline=(255, 255, 255, 220), width=4)
    draw_peace_sign(draw, (1200, 640), 55, (255, 255, 255, 255), width=7)
    draw_sunflower(draw, (1860, 640), 55)
    draw.text((1538, 640), "WITAJCIE W DOMU!", fill=(255, 255, 255, 255), font=f_tower_h, anchor="mm")
    draw.text((1538, 730), "POKÓJ • MIŁOŚĆ • SZACUNEK", fill=(255, 240, 70, 255), font=f_tower_h, anchor="mm")
    draw.text((1538, 820), "BĄDŹCIE DLA SIEBIE DOBRZY I UŚMIECHNIĘCI", fill=(255, 255, 255, 255), font=f_tower_sub, anchor="mm")
    draw.text((1538, 910), "BEZPIECZEŃSTWO • POKOJOWY PATROL", fill=(255, 235, 100, 255), font=f_tower_sub, anchor="mm")

    img.save(output_path, 'PNG')
    print(f"Generated {output_path}")

# -------------------------------------------------------------
# 2. POKOJOWA WIOSKA KRYSZNY (Krishna Village)
# -------------------------------------------------------------
def generate_krishna_village(output_path):
    w, h = 2048, 1024
    img = Image.new('RGBA', (w, h), (245, 130, 32, 255)) # Warm Saffron
    draw = ImageDraw.Draw(img)

    # Top Half: Main Pavilion Front Marquee Banner (2048 x 512)
    # Traditional saffron, ruby, and gold bands
    draw.rectangle([0, 0, w, 512], fill=(228, 88, 18, 255))
    draw.rectangle([0, 30, w, 482], fill=(245, 126, 24, 255))
    draw.rectangle([0, 60, w, 452], fill=(252, 172, 36, 255))

    # Traditional arched scallop fringe at bottom
    for sx in range(0, w, 64):
        draw.pieslice([sx, 460, sx + 64, 524], 0, 180, fill=(185, 42, 15, 255))

    # Saffron lotus mandalas flanking
    def draw_lotus(cx, cy, r):
        for i in range(12):
            ang = (i / 12.0) * 2 * math.pi
            lx = cx + math.cos(ang) * (r * 0.6)
            ly = cy + math.sin(ang) * (r * 0.6)
            draw.ellipse([lx - r*0.3, ly - r*0.3, lx + r*0.3, ly + r*0.3], fill=(255, 235, 120, 255))
        draw.ellipse([cx - r*0.4, cy - r*0.4, cx + r*0.4, cy + r*0.4], fill=(185, 30, 15, 255))

    draw_lotus(180, 256, 120)
    draw_lotus(w - 180, 256, 120)
    draw_lotus(460, 256, 80)
    draw_lotus(w - 460, 256, 80)

    f_title = get_font(FONT_IMPACT, 110)
    f_sub = get_font(FONT_SEGOE, 54)
    f_peace = get_font(FONT_ARIAL_BOLD, 46)

    draw.text((1027, 163), "POKOJOWA WIOSKA KRYSZNY", fill=(90, 20, 5, 255), font=f_title, anchor="mm")
    draw.text((1024, 160), "POKOJOWA WIOSKA KRYSZNY", fill=(255, 255, 255, 255), font=f_title, anchor="mm")

    draw.text((1024, 275), "PEACE • LOVE • HARE KRISHNA FESTIVAL", fill=(140, 25, 5, 255), font=f_sub, anchor="mm")
    draw.text((1024, 370), "GORĄCY WEGAŃSKI POSIŁEK DLA KAŻDEGO • PRASADAM", fill=(255, 255, 255, 255), font=f_peace, anchor="mm")

    # Bottom Half Left: Menu Blackboard (1024 x 512 at [0..1024, 512..1024])
    draw.rectangle([40, 530, 984, 990], fill=(32, 36, 40, 255))
    draw.rectangle([40, 530, 984, 990], outline=(180, 130, 70, 255), width=14) # Wooden frame
    f_menu_title = get_font(FONT_IMPACT, 54)
    f_menu_item = get_font(FONT_ARIAL_BOLD, 38)
    f_menu_price = get_font(FONT_ARIAL_BOLD, 36)

    draw.text((512, 580), "★ MENU POKOJOWEJ WIOSKI KRYSZNY ★", fill=(255, 215, 60, 255), font=f_menu_title, anchor="mm")
    draw.line([(100, 615), (924, 615)], fill=(255, 255, 255, 120), width=2)

    menu_lines = [
        ("• ZESTAW WEGAŃSKI (Gulasz z warzywami + Ryż basmati)", "DUŻA PORCJA"),
        ("• SŁYNNA CIEPŁA CHAŁWA KRYSZNA Z BAKALIAMI", "KULTOWY SMAK"),
        ("• OŚWIEŻAJĄCY NAPÓJ CYTRYNOWO-IMBIROWY", "ZIMNY KUBEK"),
        ("• PIECZONE SŁODKIE KULKI PRASADAM", "SŁODKI DESER"),
    ]
    for idx, (item, note) in enumerate(menu_lines):
        yy = 665 + idx * 72
        draw.text((100, yy), item, fill=(245, 245, 245, 255), font=f_menu_item)
        draw.text((880, yy), note, fill=(255, 200, 60, 255), font=f_menu_price, anchor="ra")

    # Bottom Half Right: Tent Saffron Fabric Texture with Mandala Tiles
    draw.rectangle([1064, 530, 2008, 990], fill=(235, 105, 20, 255))
    for tx in range(1100, 2000, 160):
        for ty in range(560, 960, 140):
            draw_lotus(tx, ty, 42)

    img.save(output_path, 'PNG')
    print(f"Generated {output_path}")

# -------------------------------------------------------------
# 3. KĄPIELISKO BŁOTNE (The Legendary Mud Bath)
# -------------------------------------------------------------
def generate_mud_bath(output_path):
    w, h = 1024, 1024
    img = Image.new('RGBA', (w, h), (75, 52, 38, 255)) # Rich organic wet mud brown
    draw = ImageDraw.Draw(img)

    # Top Half: Iconic Mud Bath Wooden Signboard (1024 x 512)
    # Weathered wood planks with planks seams
    for y in range(0, 512, 128):
        draw.rectangle([20, y + 10, w - 20, y + 120], fill=(138, 98, 62, 255))
        draw.rectangle([20, y + 10, w - 20, y + 120], outline=(85, 56, 30, 255), width=4)
        # Wood grain lines
        for gx in range(40, w - 40, 80):
            draw.line([(gx, y + 15), (gx + 40, y + 115)], fill=(110, 75, 45, 140), width=2)

    # Painted letters on the wooden sign
    f_mud_main = get_font(FONT_IMPACT, 82)
    f_mud_sub = get_font(FONT_ARIAL_BOLD, 40)
    f_mud_warning = get_font(FONT_ARIAL_BOLD, 32)

    # Mud splatters
    def draw_splatter(cx, cy, r):
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(55, 38, 24, 255))
        for i in range(8):
            ang = i * (math.pi / 4.0)
            sx = cx + math.cos(ang) * (r * 1.5)
            sy = cy + math.sin(ang) * (r * 1.5)
            draw.ellipse([sx - r*0.3, sy - r*0.3, sx + r*0.3, sy + r*0.3], fill=(55, 38, 24, 255))

    draw_splatter(140, 130, 45)
    draw_splatter(w - 140, 130, 45)
    draw_splatter(220, 370, 35)
    draw_splatter(w - 220, 370, 35)

    draw.text((514, 112), "KĄPIELISKO BŁOTNE", fill=(30, 20, 12, 255), font=f_mud_main, anchor="mm")
    draw.text((512, 110), "KĄPIELISKO BŁOTNE", fill=(255, 245, 190, 255), font=f_mud_main, anchor="mm")

    draw.text((512, 220), "POL'AND'ROCK FESTIVAL 2026 • STREFA BŁOTA", fill=(240, 220, 150, 255), font=f_mud_sub, anchor="mm")

    # Warning Box
    draw.rectangle([60, 320, w - 60, 440], fill=(230, 40, 35, 230))
    draw.text((512, 360), "UWAGA: WCHODZISZ NA WŁASNĄ ODPOWIEDZIALNOŚĆ!", fill=(255, 255, 255, 255), font=f_mud_warning, anchor="mm")
    draw.text((512, 405), "GWARANTOWANE: BĘDZIESZ CAŁY W BŁOCIE I SZCZĘŚLIWY!", fill=(255, 245, 100, 255), font=f_mud_warning, anchor="mm")

    # Bottom Half: Mud ripples, wet puddle reflections and warning tape
    # Safety tape stripes at [0..1024, 520..620]
    tape_h = 90
    for x in range(0, w + 100, 60):
        draw.polygon([(x, 520), (x + 30, 520), (x - 30, 520 + tape_h), (x - 60, 520 + tape_h)], fill=(255, 215, 0, 255))
        draw.polygon([(x + 30, 520), (x + 60, 520), (x, 520 + tape_h), (x - 30, 520 + tape_h)], fill=(20, 20, 20, 255))

    # Wet Mud texture pattern for puddle ground
    draw.rectangle([0, 630, w, h], fill=(62, 44, 30, 255))
    for my in range(650, h, 60):
        for mx in range(40, w, 80):
            draw.ellipse([mx - 50, my - 25, mx + 50, my + 25], fill=(48, 32, 20, 255))
            draw.ellipse([mx - 30, my - 15, mx + 30, my + 15], fill=(36, 25, 16, 255))
            draw.ellipse([mx - 15, my - 8, mx + 15, my + 8], fill=(90, 110, 130, 180)) # Sky puddle reflection!

    img.save(output_path, 'PNG')
    print(f"Generated {output_path}")

# -------------------------------------------------------------
# 4. WÓZ STRAŻACKI OSP (Fire Truck)
# -------------------------------------------------------------
def generate_fire_truck(output_path):
    w, h = 2048, 1024
    img = Image.new('RGBA', (w, h), (210, 25, 25, 255)) # Fire Engine Red
    draw = ImageDraw.Draw(img)

    # 1. Left Half: Vehicle Body Side Livery (1024 x 512 at [0..1024, 0..512])
    # White diagonal side stripe
    draw.polygon([(150, 0), (320, 0), (180, 512), (10, 512)], fill=(255, 255, 255, 255))
    draw.polygon([(360, 0), (410, 0), (270, 512), (220, 512)], fill=(255, 255, 255, 255))

    f_fire_title = get_font(FONT_IMPACT, 100)
    f_fire_station = get_font(FONT_ARIAL_BOLD, 64)
    f_fire_num = get_font(FONT_IMPACT, 110)

    draw.text((650, 130), "STRAŻ", fill=(255, 255, 255, 255), font=f_fire_title, anchor="mm")
    draw.text((650, 230), "OSP CZAPLINEK", fill=(255, 235, 100, 255), font=f_fire_station, anchor="mm")
    draw.text((650, 360), "998 • 112", fill=(255, 255, 255, 255), font=f_fire_num, anchor="mm")
    draw_heart(draw, (920, 230), (140, 120), (255, 255, 255, 255), (210, 25, 25, 255))
    draw_heart(draw, (920, 230), (120, 100), (225, 25, 45, 255))

    # 2. Right Half: Aluminum Shutter Doors (Equipment Lockers) (1024 x 512 at [1024..2048, 0..512])
    draw.rectangle([1044, 20, 2028, 492], fill=(195, 200, 208, 255))
    for sy in range(30, 490, 18):
        draw.line([(1050, sy), (2020, sy)], fill=(140, 145, 155, 255), width=2)
        draw.line([(1050, sy + 6), (2020, sy + 6)], fill=(230, 235, 242, 255), width=2)
    # Shutter handles
    draw.rectangle([1480, 230, 1580, 260], fill=(50, 50, 55, 255))
    draw.rectangle([1500, 240, 1560, 250], fill=(100, 100, 110, 255))

    # 3. Bottom Half: Truck Front Grille, Headlights, License Plate, and Yellow/Red Warning Chevrons
    # Chevrons on bumper at [0..1024, 530..690]
    chevr_h = 160
    for cx in range(-100, 1100, 120):
        draw.polygon([(cx, 530), (cx + 60, 530), (cx + 120, 530 + chevr_h), (cx + 60, 530 + chevr_h)], fill=(255, 215, 0, 255))
        draw.polygon([(cx + 60, 530), (cx + 120, 530), (cx + 180, 530 + chevr_h), (cx + 120, 530 + chevr_h)], fill=(220, 30, 20, 255))

    # Truck Radiator Grille at [1064, 530, 2008, 850]
    draw.rectangle([1064, 530, 2008, 850], fill=(30, 32, 35, 255))
    for gy in range(545, 840, 20):
        draw.line([(1080, gy), (1990, gy)], fill=(80, 85, 95, 255), width=5)
    
    # Chrome Emblems and Headlights
    draw.rectangle([1090, 560, 1210, 680], fill=(240, 245, 255, 255)) # Left headlight
    draw.ellipse([1110, 580, 1190, 660], fill=(255, 255, 210, 255))
    draw.rectangle([1860, 560, 1980, 680], fill=(240, 245, 255, 255)) # Right headlight
    draw.ellipse([1880, 580, 1960, 660], fill=(255, 255, 210, 255))

    # License Plate
    draw.rectangle([1380, 740, 1690, 810], fill=(250, 250, 250, 255))
    draw.rectangle([1380, 740, 1690, 810], outline=(10, 10, 10, 255), width=4)
    draw.rectangle([1384, 744, 1430, 806], fill=(0, 51, 153, 255)) # EU blue band
    f_plate = get_font(FONT_ARIAL_BOLD, 46)
    draw.text((1560, 775), "ZKO 2026", fill=(10, 10, 10, 255), font=f_plate, anchor="mm")

    # Blue lightbar texture at [0..1024, 720..1000]
    for bx in range(0, 1024, 256):
        draw.rectangle([bx + 10, 740, bx + 246, 960], fill=(15, 95, 230, 255))
        draw.rectangle([bx + 30, 760, bx + 226, 940], fill=(60, 160, 255, 255))
        draw.ellipse([bx + 70, 800, bx + 186, 900], fill=(220, 240, 255, 255))

    img.save(output_path, 'PNG')
    print(f"Generated {output_path}")

# -------------------------------------------------------------
# 5. WIEŻA DELAY (Sound & Light Delay Tower)
# -------------------------------------------------------------
def generate_delay_tower(output_path):
    w, h = 1024, 1024
    img = Image.new('RGBA', (w, h), (35, 38, 44, 255))
    draw = ImageDraw.Draw(img)

    # 1. Top Half: Scaffolding Mesh Banner (1024 x 512)
    # Dark high-tech festival scrim banner with sound wave graphic
    draw.rectangle([20, 20, w - 20, 492], fill=(22, 24, 30, 255))
    draw.rectangle([20, 20, w - 20, 492], outline=(255, 255, 255, 140), width=4)

    # Sound wave graphic in center
    for x in range(60, w - 60, 16):
        dist = abs(x - 512) / 450.0
        wave_h = math.sin((x / 30.0)) * math.cos(dist * 2) * 140 * (1.0 - dist)
        cy = 280
        draw.line([(x, cy - wave_h), (x, cy + wave_h)], fill=(255, 180, 40, 220), width=8)

    f_delay_title = get_font(FONT_IMPACT, 76)
    f_delay_sub = get_font(FONT_ARIAL_BOLD, 36)
    f_delay_code = get_font(FONT_IMPACT, 96)

    draw.text((512, 90), "POL'AND'ROCK FESTIVAL 2026", fill=(255, 255, 255, 255), font=f_delay_title, anchor="mm")
    draw.text((512, 160), "PROFESSIONAL AUDIO REINFORCEMENT DELAY SYSTEM", fill=(255, 200, 50, 255), font=f_delay_sub, anchor="mm")
    draw.text((512, 420), "DELAY TOWER 01 • SEKTOR B", fill=(255, 255, 255, 255), font=f_delay_code, anchor="mm")

    # 2. Bottom Half Left: Line Array Speaker Grille (512 x 512 at [0..512, 512..1024])
    draw.rectangle([10, 522, 502, 1014], fill=(20, 20, 22, 255))
    # Speaker grille mesh pattern
    for y in range(530, 1000, 12):
        for x in range(20, 490, 12):
            draw.point((x, y), fill=(70, 75, 85, 255))
    # Brand logo badge in center
    draw.rectangle([210, 740, 300, 790], fill=(220, 25, 25, 255))
    f_badge = get_font(FONT_ARIAL_BOLD, 24)
    draw.text((255, 765), "JBL", fill=(255, 255, 255, 255), font=f_badge, anchor="mm")

    # 3. Bottom Half Right: Technical Power / Rigging Warning Plate
    draw.rectangle([522, 522, 1014, 1014], fill=(245, 215, 30, 255)) # Safety Yellow
    draw.rectangle([536, 536, 1000, 1000], outline=(15, 15, 15, 255), width=8)
    # Hazard triangle
    draw.polygon([(768, 590), (668, 770), (868, 770)], fill=(20, 20, 20, 255))
    draw.polygon([(768, 620), (690, 755), (846, 755)], fill=(245, 215, 30, 255))
    # Lightning bolt inside
    draw.polygon([(772, 640), (745, 695), (770, 695), (755, 745), (795, 680), (770, 680)], fill=(20, 20, 20, 255))

    f_warn_title = get_font(FONT_IMPACT, 44)
    f_warn_text = get_font(FONT_ARIAL_BOLD, 26)
    draw.text((768, 830), "UWAGA! WYSOKIE NAPIĘCIE", fill=(10, 10, 10, 255), font=f_warn_title, anchor="mm")
    draw.text((768, 885), "ROZDZIELNIA MOCY 400V 125A", fill=(10, 10, 10, 255), font=f_warn_text, anchor="mm")
    draw.text((768, 935), "NIE ZBLIŻAĆ SIĘ • TYLKO OBSŁUGA", fill=(180, 20, 20, 255), font=f_warn_text, anchor="mm")

    img.save(output_path, 'PNG')
    print(f"Generated {output_path}")

if __name__ == '__main__':
    repo_root = Path(__file__).resolve().parents[1]
    out_dir_source = repo_root / 'source-assets' / 'festival_props'
    out_dir_public = repo_root / 'public' / 'game-assets' / 'world' / 'festival' / 'textures'
    out_dir_source.mkdir(parents=True, exist_ok=True)
    out_dir_public.mkdir(parents=True, exist_ok=True)

    targets = [
        ('festival_gate_banner.png', generate_festival_gate),
        ('krishna_village_textures.png', generate_krishna_village),
        ('mud_bath_textures.png', generate_mud_bath),
        ('fire_truck_textures.png', generate_fire_truck),
        ('delay_tower_banner.png', generate_delay_tower),
    ]

    for fname, func in targets:
        path_src = out_dir_source / fname
        path_pub = out_dir_public / fname
        func(path_src)
        # Copy to public textures
        import shutil
        shutil.copy2(path_src, path_pub)
        print(f"Copied to {path_pub}")
