"""
Pol'and'Rock Festival 2026 - Comprehensive Props & Signage Texture Generator
Generates high-fidelity PBR-ready textures for:
- "Zaraz Będzie Czysto" waste corral & recycling bins
- Multi-directional festival wooden signposts
- FOH Sound & Lighting mixing consoles and banners
- Pokojowy Patrol & Medical First-Aid tents and feather flags
- Water curtain (Kurtyna Wodna) signage
- Festival sponsor & stage LED concert visuals
"""

import os
import sys
import math
from PIL import Image, ImageDraw, ImageFont

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def get_font(name, size):
    windir = os.environ.get('WINDIR', 'C:\\Windows')
    font_path = os.path.join(windir, 'Fonts', name)
    if os.path.exists(font_path):
        try:
            return ImageFont.truetype(font_path, size)
        except Exception:
            pass
    try:
        return ImageFont.truetype('arialbd.ttf', size)
    except Exception:
        return ImageFont.load_default()

def draw_wosp_heart(draw, cx, cy, radius, fill_color=(220, 38, 38), outline_color=(255, 255, 255), outline_width=4):
    """Draws iconic WOŚP curved red heart"""
    r = radius
    pts = []
    # Parametric heart curve
    for t_deg in range(0, 360, 5):
        t = math.radians(t_deg)
        x = 16 * (math.sin(t) ** 3)
        y = -(13 * math.cos(t) - 5 * math.cos(2*t) - 2 * math.cos(3*t) - math.cos(4*t))
        scale = r / 16.0
        pts.append((cx + x * scale, cy + y * scale))
    
    if outline_width > 0 and outline_color:
        draw.polygon(pts, fill=outline_color)
        inner_pts = []
        for (px, py) in pts:
            vx, vy = px - cx, py - cy
            dist = math.hypot(vx, vy)
            if dist > 0:
                inner_pts.append((cx + vx * (dist - outline_width) / dist, cy + vy * (dist - outline_width) / dist))
            else:
                inner_pts.append((px, py))
        draw.polygon(inner_pts, fill=fill_color)
    else:
        draw.polygon(pts, fill=fill_color)

def generate_zaraz_bedzie_czysto_corral(out_paths):
    """Corral banner (2048x512) for the waste sorting corral"""
    w, h = 2048, 512
    img = Image.new("RGBA", (w, h), (26, 114, 52, 255)) # Festival eco green
    draw = ImageDraw.Draw(img)

    # Canvas weave / diagonal stripes texture
    for x in range(0, w + h, 24):
        draw.line([(x, 0), (x - h, h)], fill=(34, 139, 65, 120), width=4)

    # Top & bottom contrast borders with Woodstock sunflower motif dots
    draw.rectangle([0, 0, w, 28], fill=(245, 158, 11, 255)) # Sunflower yellow
    draw.rectangle([0, h - 28, w, h], fill=(245, 158, 11, 255))
    for dot_x in range(16, w, 32):
        draw.ellipse([dot_x - 6, 8, dot_x + 6, 20], fill=(220, 38, 38, 255))
        draw.ellipse([dot_x - 6, h - 20, dot_x + 6, h - 8], fill=(220, 38, 38, 255))

    font_huge = get_font("impact.ttf", 92)
    font_bold = get_font("arialbd.ttf", 36)
    font_sub = get_font("segoeuib.ttf", 26)

    # Left & Right WOŚP hearts
    draw_wosp_heart(draw, 140, 256, 105, fill_color=(220, 38, 38), outline_color=(255, 255, 255), outline_width=6)
    draw_wosp_heart(draw, w - 140, 256, 105, fill_color=(220, 38, 38), outline_color=(255, 255, 255), outline_width=6)

    # Center Main Slogan
    title = "ZARAZ BĘDZIE CZYSTO!"
    # Shadow
    draw.text((w // 2 - 2, 82), title, font=font_huge, fill=(15, 60, 28, 255), anchor="mt")
    draw.text((w // 2, 80), title, font=font_huge, fill=(255, 255, 255, 255), anchor="mt")

    sub = "POL'AND'ROCK FESTIVAL 2026 • EKO STREFA RECYKLINGU"
    draw.text((w // 2, 185), sub, font=font_sub, fill=(253, 224, 71, 255), anchor="mt")

    # 4 Recycling Fraction badges across the lower section
    fractions = [
        ("PLASTIK I METAL", (234, 179, 8), (0, 0, 0), "Butelki PET, puszki, kubki"),
        ("PAPIER", (37, 99, 235), (255, 255, 255), "Karton, gazety, opakowania"),
        ("SZKŁO", (22, 101, 52), (255, 255, 255), "Butelki szklane, słoiki"),
        ("ODPADY ZMIESZANE", (51, 65, 85), (255, 255, 255), "Resztki, zatłuszczony papier"),
    ]

    card_w = 340
    card_h = 190
    spacing = 40
    start_x = (w - (4 * card_w + 3 * spacing)) // 2
    card_y = 245

    for idx, (name, bg_col, text_col, desc) in enumerate(fractions):
        cx = start_x + idx * (card_w + spacing)
        # Rounded box
        draw.rounded_rectangle([cx, card_y, cx + card_w, card_y + card_h], radius=16, fill=bg_col, outline=(255, 255, 255), width=3)
        draw.text((cx + card_w // 2, card_y + 35), name, font=font_bold, fill=text_col, anchor="mt")
        # Subtitle
        draw.text((cx + card_w // 2, card_y + 110), desc, font=font_sub, fill=text_col, anchor="mt")

    for path in out_paths:
        img.save(path, "PNG")
    print(f"Generated Zaraz Będzie Czysto banner: {out_paths[0]}")

def generate_trash_sorting_signs(out_paths):
    """Texture atlas (1024x1024) for bin lids and container stickers"""
    w, h = 1024, 1024
    img = Image.new("RGBA", (w, h), (30, 41, 59, 255))
    draw = ImageDraw.Draw(img)

    font_huge = get_font("impact.ttf", 64)
    font_bold = get_font("arialbd.ttf", 32)
    font_small = get_font("segoeuib.ttf", 22)

    quads = [
        ((0, 0, 512, 512), "PLASTIK / METAL", (245, 158, 11), (0, 0, 0), "ŻÓŁTY WOREK"),
        ((512, 0, 1024, 512), "PAPIER", (37, 99, 235), (255, 255, 255), "NIEBIESKI WOREK"),
        ((0, 512, 512, 1024), "SZKŁO", (34, 197, 94), (255, 255, 255), "ZIELONY WOREK"),
        ((512, 512, 1024, 1024), "ZMIESZANE", (71, 85, 105), (255, 255, 255), "CZARNY WOREK")
    ]

    for (x0, y0, x1, y1), name, bg_col, text_col, bag_name in quads:
        cx = (x0 + x1) // 2
        cy = (y0 + y1) // 2
        radius = 210

        # Circular lid decal
        draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=bg_col, outline=(255, 255, 255), width=8)
        draw.ellipse([cx - radius + 15, cy - radius + 15, cx + radius - 15, cy + radius - 15], outline=(0, 0, 0, 100), width=3)

        # Recycling icon arrows (three curved lines / triangles)
        for rot in [0, 120, 240]:
            rad = math.radians(rot)
            ix = cx + 85 * math.cos(rad)
            iy = cy - 45 + 85 * math.sin(rad)
            draw.line([(ix - 15, iy), (ix + 15, iy)], fill=text_col, width=5)

        draw.text((cx, cy + 30), name, font=font_huge, fill=text_col, anchor="mm")
        draw.text((cx, cy + 95), bag_name, font=font_bold, fill=text_col, anchor="mm")
        draw.text((cx, cy + 140), "ZARAZ BĘDZIE CZYSTO!", font=font_small, fill=text_col, anchor="mm")

    for path in out_paths:
        img.save(path, "PNG")
    print(f"Generated Trash Sorting Signs atlas: {out_paths[0]}")

def generate_festival_directional_signs(out_paths):
    """Directional wooden signposts (2048x1024) containing 8 authentic wooden planks with exact 0-1 UV bounds"""
    w, h = 2048, 1024
    # Warm rustic timber background so any UV mipmap / edge bleed samples wood
    img = Image.new("RGBA", (w, h), (78, 54, 34, 255))
    draw = ImageDraw.Draw(img)

    # Wood grain background texture across entire atlas
    for y in range(0, h, 6):
        draw.line([(0, y), (w, y)], fill=(65, 45, 28, 90), width=1)
    for x in range(0, w, 90):
        draw.line([(x, 0), (x + 15, h)], fill=(50, 35, 20, 60), width=1)

    font_plank = get_font("impact.ttf", 84)
    font_sub = get_font("arialbd.ttf", 28)

    planks = [
        # (text, bg_color, text_color, direction_arrow, subtitle)
        ("DUŻA SCENA", (185, 28, 28), (255, 255, 255), "RIGHT", "MAIN STAGE • ROCK & ROLL"),
        ("SCENA ASP", (245, 158, 11), (20, 20, 20), "LEFT", "AKADEMIA SZTUK PRZEPIĘKNYCH"),
        ("WIOSKA KRYSZNY", (234, 88, 12), (255, 255, 255), "RIGHT", "POKOJOWA WIOSKA • CIEPŁY POSIŁEK"),
        ("POKOJOWY PATROL", (220, 38, 38), (254, 240, 138), "LEFT", "PUNKT MEDYCZNY & INFO"),
        ("POLE NAMIOTOWE", (22, 101, 52), (255, 255, 255), "RIGHT", "STREFA CAMPINGU"),
        ("GRZYBEK WODNY", (14, 165, 233), (255, 255, 255), "LEFT", "KURTYNA WODNA • OCHŁODA"),
        ("ZARAZ BĘDZIE CIEMNO!", (17, 24, 39), (250, 204, 21), "RIGHT", "ZAMKNIJ SIĘ! ;)"),
        ("ZARAZ BĘDZIE CZYSTO!", (16, 185, 129), (255, 255, 255), "LEFT", "EKO WYSPA RECYKLINGU"),
    ]

    row_h = 128
    tip_w = 180

    for i, (text, bg_col, text_col, arrow_dir, sub) in enumerate(planks):
        y0 = i * row_h
        y1 = (i + 1) * row_h
        ymid = (y0 + y1) // 2

        # Wood plank polygon filling the row
        if arrow_dir == "RIGHT":
            pts = [
                (0, y0),
                (w - tip_w, y0),
                (w, ymid),
                (w - tip_w, y1),
                (0, y1)
            ]
        else:
            pts = [
                (0, ymid),
                (tip_w, y0),
                (w, y0),
                (w, y1),
                (tip_w, y1)
            ]

        # Draw main plank body
        draw.polygon(pts, fill=bg_col)

        # Wood grain lines & weathered grooves
        for g in range(y0 + 14, y1 - 10, 20):
            draw.line([(0, g), (w, g)], fill=(0, 0, 0, 40), width=2)
            draw.line([(0, g + 2), (w, g + 2)], fill=(255, 255, 255, 25), width=1)

        # Metal nail studs
        if arrow_dir == "RIGHT":
            draw.ellipse([24, y0 + 20, 38, y0 + 34], fill=(30, 30, 30, 220))
            draw.ellipse([24, y1 - 34, 38, y1 - 20], fill=(30, 30, 30, 220))
            draw.ellipse([w - tip_w - 30, y0 + 20, w - tip_w - 16, y0 + 34], fill=(30, 30, 30, 220))
            draw.ellipse([w - tip_w - 30, y1 - 34, w - tip_w - 16, y1 - 20], fill=(30, 30, 30, 220))
        else:
            draw.ellipse([tip_w + 16, y0 + 20, tip_w + 30, y0 + 34], fill=(30, 30, 30, 220))
            draw.ellipse([tip_w + 16, y1 - 34, tip_w + 30, y1 - 20], fill=(30, 30, 30, 220))
            draw.ellipse([w - 38, y0 + 20, w - 24, y0 + 34], fill=(30, 30, 30, 220))
            draw.ellipse([w - 38, y1 - 34, w - 24, y1 - 20], fill=(30, 30, 30, 220))

        # Plank border
        draw.polygon(pts, outline=(255, 255, 255, 210), width=5)

        # Inner outline inset
        inset = 10
        if arrow_dir == "RIGHT":
            in_pts = [
                (inset, y0 + inset),
                (w - tip_w - inset * 0.7, y0 + inset),
                (w - inset * 1.4, ymid),
                (w - tip_w - inset * 0.7, y1 - inset),
                (inset, y1 - inset)
            ]
        else:
            in_pts = [
                (inset * 1.4, ymid),
                (tip_w + inset * 0.7, y0 + inset),
                (w - inset, y0 + inset),
                (w - inset, y1 - inset),
                (tip_w + inset * 0.7, y1 - inset)
            ]
        draw.polygon(in_pts, outline=(0, 0, 0, 60), width=2)

        # Typography
        text_cx = (w - tip_w) // 2 if arrow_dir == "RIGHT" else (w + tip_w) // 2
        # Drop shadow
        draw.text((text_cx + 3, y0 + 24), text, font=font_plank, fill=(0, 0, 0, 200), anchor="mt")
        # Text
        draw.text((text_cx, y0 + 21), text, font=font_plank, fill=text_col, anchor="mt")
        # Subtitle
        draw.text((text_cx, y0 + 94), sub, font=font_sub, fill=text_col, anchor="mt")

        # WOŚP heart icon next to title
        heart_x = text_cx - 380 if arrow_dir == "RIGHT" else text_cx + 380
        draw_wosp_heart(draw, heart_x, ymid, 34, fill_color=(220, 38, 38), outline_color=(255, 255, 255), outline_width=3)

    for path in out_paths:
        img.save(path, "PNG")
    print(f"Generated Festival Directional Signs: {out_paths[0]}")

def generate_foh_console(out_paths):
    """High-detail audio & lighting mixing desk faceplate (1024x1024)"""
    w, h = 1024, 1024
    img = Image.new("RGBA", (w, h), (20, 24, 30, 255))
    draw = ImageDraw.Draw(img)

    font_mono = get_font("arialbd.ttf", 16)
    font_title = get_font("impact.ttf", 36)

    # Upper bridge: 2 big touchscreens and stereo master meters
    draw.rectangle([40, 40, 480, 400], fill=(10, 15, 20), outline=(80, 90, 100), width=4)
    draw.rectangle([544, 40, 984, 400], fill=(10, 15, 20), outline=(80, 90, 100), width=4)

    # Screen 1: FFT spectrum & channel EQ
    draw.text((60, 55), "DIGITAL FOH AUDIO MATRIX - MAIN L/R", font=font_mono, fill=(56, 189, 248))
    # Waveform / spectrum bars
    for bar in range(32):
        bx = 70 + bar * 12
        bh = int(80 + 120 * math.sin(bar * 0.28) * math.cos(bar * 0.15))
        draw.rectangle([bx, 340 - bh, bx + 8, 340], fill=(34, 197, 94))
        if bh > 140:
            draw.rectangle([bx, 340 - bh, bx + 8, 340 - 140], fill=(234, 179, 8))
        if bh > 180:
            draw.rectangle([bx, 340 - bh, bx + 8, 340 - 180], fill=(239, 68, 68))

    # Screen 2: GrandMA Lighting cue list
    draw.text((564, 55), "LIGHTING DESK - CUE LIST: DUŻA SCENA", font=font_mono, fill=(244, 114, 182))
    cues = ["01 INTRO BLACKOUT", "02 STROBE EXPLOSION", "03 SUNBURST BLINDERS 100%", "04 ROCK CHORUS - CYAM/MAG", "05 GUITAR SOLO SPOTLIGHT"]
    for ci, cue in enumerate(cues):
        draw.rectangle([564, 90 + ci * 48, 960, 126 + ci * 48], fill=(30, 41, 59) if ci != 2 else (180, 83, 9), outline=(100, 116, 139))
        draw.text((580, 100 + ci * 48), cue, font=font_mono, fill=(255, 255, 255))

    # Middle section: Rotary knobs & buttons (24 channels)
    num_ch = 16
    ch_w = 56
    start_ch_x = 64
    for c in range(num_ch):
        cx = start_ch_x + c * ch_w
        # 3 rotary EQ pots
        for kr, kcol in enumerate([(59, 130, 246), (16, 185, 129), (239, 68, 68)]):
            ky = 440 + kr * 46
            draw.ellipse([cx - 12, ky - 12, cx + 12, ky + 12], fill=(45, 55, 72), outline=(150, 160, 170), width=2)
            draw.line([(cx, ky), (cx + 8, ky - 8)], fill=kcol, width=3)

        # Mute / Solo buttons
        draw.rectangle([cx - 14, 580, cx + 14, 604], fill=(220, 38, 38) if c % 3 == 0 else (60, 60, 60), outline=(200, 200, 200))
        draw.text((cx, 592), "M", font=font_mono, fill=(255, 255, 255), anchor="mm")
        draw.rectangle([cx - 14, 612, cx + 14, 636], fill=(234, 179, 8) if c == 1 else (60, 60, 60), outline=(200, 200, 200))
        draw.text((cx, 624), "S", font=font_mono, fill=(0, 0, 0) if c == 1 else (255, 255, 255), anchor="mm")

        # Fader slot
        fader_top = 670
        fader_bottom = 950
        draw.rectangle([cx - 3, fader_top, cx + 3, fader_bottom], fill=(10, 10, 12))
        # Fader scale markings
        for mark in range(fader_top, fader_bottom, 30):
            draw.line([(cx - 10, mark), (cx - 5, mark)], fill=(120, 120, 120), width=1)
            draw.line([(cx + 5, mark), (cx + 10, mark)], fill=(120, 120, 120), width=1)

        # Fader knob position (randomized realistic feel)
        fader_pos = fader_bottom - int(70 + 150 * abs(math.sin(c * 0.95)))
        draw.rectangle([cx - 16, fader_pos - 18, cx + 16, fader_pos + 18], fill=(210, 215, 220), outline=(20, 20, 20), width=2)
        draw.line([(cx - 14, fader_pos), (cx + 14, fader_pos)], fill=(220, 38, 38), width=3)

    for path in out_paths:
        img.save(path, "PNG")
    print(f"Generated FOH Audio Console: {out_paths[0]}")

def generate_foh_banner(out_paths):
    """FOH Scaffolding Crew Banner (2048x512)"""
    w, h = 2048, 512
    img = Image.new("RGBA", (w, h), (17, 24, 39, 255))
    draw = ImageDraw.Draw(img)

    font_huge = get_font("impact.ttf", 92)
    font_sub = get_font("arialbd.ttf", 36)

    # Scaffolding cross mesh pattern
    for x in range(0, w + h, 36):
        draw.line([(x, 0), (x - h, h)], fill=(31, 41, 55, 100), width=2)
        draw.line([(x - h, 0), (x, h)], fill=(31, 41, 55, 100), width=2)

    # Red & Yellow warning hazard stripes top & bottom
    stripe_w = 40
    for s in range(0, w, stripe_w * 2):
        draw.polygon([(s, 0), (s + stripe_w, 0), (s + stripe_w - 24, 24), (s - 24, 24)], fill=(234, 179, 8))
        draw.polygon([(s, h - 24), (s + stripe_w, h - 24), (s + stripe_w - 24, h), (s - 24, h)], fill=(234, 179, 8))

    draw_wosp_heart(draw, 160, 256, 95, fill_color=(220, 38, 38), outline_color=(255, 255, 255), outline_width=6)
    draw_wosp_heart(draw, w - 160, 256, 95, fill_color=(220, 38, 38), outline_color=(255, 255, 255), outline_width=6)

    title = "FRONT OF HOUSE • REŻYSERIA DŹWIĘKU I ŚWIATŁA"
    draw.text((w // 2, 130), title, font=font_huge, fill=(255, 255, 255), anchor="mm")

    sub = "POL'AND'ROCK FESTIVAL 2026 • STREFA REALIZATORÓW • WSTĘP TYLKO Z IDENTYFIKATOREM"
    draw.text((w // 2, 270), sub, font=font_sub, fill=(250, 204, 21), anchor="mm")

    badge = "AUDIO • LIGHTING • VIDEO • PYROTECHNICS CONTROL"
    draw.text((w // 2, 370), badge, font=font_sub, fill=(148, 163, 184), anchor="mm")

    for path in out_paths:
        img.save(path, "PNG")
    print(f"Generated FOH Banner: {out_paths[0]}")

def generate_pokojowy_patrol_tent(out_paths):
    """Pokojowy Patrol / Medical Aid tent canopy & wall textures (2048x1024)"""
    w, h = 2048, 1024
    img = Image.new("RGBA", (w, h), (250, 204, 21, 255)) # Patrol Sunshine Yellow
    draw = ImageDraw.Draw(img)

    font_huge = get_font("impact.ttf", 98)
    font_bold = get_font("arialbd.ttf", 44)
    font_sub = get_font("segoeuib.ttf", 32)

    # Top Roof Valance (Crimson Red)
    draw.rectangle([0, 0, w, 220], fill=(220, 38, 38, 255))
    draw_wosp_heart(draw, 140, 110, 80, fill_color=(220, 38, 38), outline_color=(255, 255, 255), outline_width=6)
    draw_wosp_heart(draw, w - 140, 110, 80, fill_color=(220, 38, 38), outline_color=(255, 255, 255), outline_width=6)

    draw.text((w // 2, 110), "POKOJOWY PATROL", font=font_huge, fill=(255, 255, 255), anchor="mm")

    # Center Panel: Medical Cross + Patrol Creed
    # Medical Cross in white circle
    cx, cy = w // 2, 540
    draw.ellipse([cx - 180, cy - 180, cx + 180, cy + 180], fill=(255, 255, 255), outline=(220, 38, 38), width=8)
    # Red Cross
    draw.rectangle([cx - 40, cy - 130, cx + 40, cy + 130], fill=(220, 38, 38))
    draw.rectangle([cx - 130, cy - 40, cx + 130, cy + 40], fill=(220, 38, 38))

    draw.text((w // 4, 460), "PUNKT MEDYCZNY", font=font_bold, fill=(185, 28, 28), anchor="mm")
    draw.text((w // 4, 530), "PIERWSZA POMOC", font=font_bold, fill=(17, 24, 39), anchor="mm")
    draw.text((w // 4, 600), "POMAGAMY BO LUBIMY!", font=font_sub, fill=(185, 28, 28), anchor="mm")

    draw.text((3 * w // 4, 460), "PUNKT INFORMACYJNY", font=font_bold, fill=(185, 28, 28), anchor="mm")
    draw.text((3 * w // 4, 530), "BIURO RZECZY ZNALEZIONYCH", font=font_bold, fill=(17, 24, 39), anchor="mm")
    draw.text((3 * w // 4, 600), "BEZPIECZNY FESTIWAL", font=font_sub, fill=(185, 28, 28), anchor="mm")

    # Lower skirt hazard border
    draw.rectangle([0, h - 70, w, h], fill=(220, 38, 38))
    draw.text((w // 2, h - 35), "POL'AND'ROCK FESTIVAL 2026 • CZAPLINEK-BROCZYNO", font=font_sub, fill=(255, 255, 255), anchor="mm")

    for path in out_paths:
        img.save(path, "PNG")
    print(f"Generated Pokojowy Patrol Tent texture: {out_paths[0]}")

def generate_kurtyna_wodna_sign(out_paths):
    """Water curtain / misting arch sign (1024x512)"""
    w, h = 1024, 512
    img = Image.new("RGBA", (w, h), (14, 165, 233, 255)) # Sky water blue
    draw = ImageDraw.Draw(img)

    font_huge = get_font("impact.ttf", 78)
    font_bold = get_font("arialbd.ttf", 36)

    # Water wave ripples
    for wy in range(0, h, 28):
        pts = [(x, wy + int(10 * math.sin(x * 0.03))) for x in range(0, w, 20)]
        draw.line(pts, fill=(56, 189, 248, 120), width=4)

    # Border
    draw.rectangle([12, 12, w - 12, h - 12], outline=(255, 255, 255), width=8)

    # Water droplet icons
    draw.ellipse([80, 200, 160, 310], fill=(255, 255, 255))
    draw.polygon([(120, 140), (80, 230), (160, 230)], fill=(255, 255, 255))

    draw.ellipse([w - 160, 200, w - 80, 310], fill=(255, 255, 255))
    draw.polygon([(w - 120, 140), (w - 160, 230), (w - 80, 230)], fill=(255, 255, 255))

    draw.text((w // 2, 140), "KURTYNA WODNA", font=font_huge, fill=(255, 255, 255), anchor="mm")
    draw.text((w // 2, 250), "OCHŁOŃ I WRACAJ POD SCENĘ!", font=font_bold, fill=(254, 240, 138), anchor="mm")
    draw.text((w // 2, 340), "POL'AND'ROCK FESTIVAL • WODA ZDATNA DO PICIA", font=font_bold, fill=(255, 255, 255), anchor="mm")

    for path in out_paths:
        img.save(path, "PNG")
    print(f"Generated Kurtyna Wodna sign: {out_paths[0]}")

def generate_stage_led_rock(out_paths):
    """High voltage rock concert LED screen visuals (1024x1024)"""
    w, h = 1024, 1024
    img = Image.new("RGBA", (w, h), (10, 10, 18, 255))
    draw = ImageDraw.Draw(img)

    cx, cy = w // 2, h // 2

    # Psychedelic radial sunburst rays
    num_rays = 36
    for i in range(num_rays):
        angle1 = math.radians(i * (360 / num_rays))
        angle2 = math.radians((i + 0.6) * (360 / num_rays))
        r_far = 800
        p1 = (cx + r_far * math.cos(angle1), cy + r_far * math.sin(angle1))
        p2 = (cx + r_far * math.cos(angle2), cy + r_far * math.sin(angle2))
        color = (239, 68, 68) if i % 3 == 0 else ((245, 158, 11) if i % 3 == 1 else (168, 85, 247))
        draw.polygon([(cx, cy), p1, p2], fill=color)

    # Concentric target rings
    for r in range(400, 80, -70):
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 255, 255), width=6)

    # Central glowing heart & Woodstock emblem
    draw_wosp_heart(draw, cx, cy, 140, fill_color=(220, 38, 38), outline_color=(255, 255, 255), outline_width=8)

    font_heavy = get_font("impact.ttf", 68)
    draw.text((cx, cy - 25), "POL'AND'ROCK", font=font_heavy, fill=(255, 255, 255), anchor="mm")
    draw.text((cx, cy + 35), "LIVE 2026", font=font_heavy, fill=(253, 224, 71), anchor="mm")

    for path in out_paths:
        img.save(path, "PNG")
    print(f"Generated Stage LED Rock visual: {out_paths[0]}")

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    source_dir = os.path.join(root, "source-assets", "festival_props")
    public_dir = os.path.join(root, "public", "game-assets", "world", "festival", "textures")
    os.makedirs(source_dir, exist_ok=True)
    os.makedirs(public_dir, exist_ok=True)

    targets = [
        ("zaraz_bedzie_czysto_corral.png", generate_zaraz_bedzie_czysto_corral),
        ("trash_sorting_signs.png", generate_trash_sorting_signs),
        ("festival_directional_signs.png", generate_festival_directional_signs),
        ("foh_audio_console.png", generate_foh_console),
        ("foh_banner.png", generate_foh_banner),
        ("pokojowy_patrol_tent.png", generate_pokojowy_patrol_tent),
        ("kurtyna_wodna_sign.png", generate_kurtyna_wodna_sign),
        ("stage_led_rock.png", generate_stage_led_rock),
    ]

    for filename, gen_fn in targets:
        paths = [
            os.path.join(source_dir, filename),
            os.path.join(public_dir, filename)
        ]
        gen_fn(paths)

if __name__ == "__main__":
    main()
