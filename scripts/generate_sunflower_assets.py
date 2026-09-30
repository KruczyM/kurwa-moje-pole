"""
Pol'and'Rock Festival 2026 - Sunflower Field Asset & Texture Generator
Generates high-resolution photographic textures:
1. sunflower_head.png (1024x1024 RGBA) - Rich seed disk with Fibonacci spiral & golden ray petals
2. sunflower_leaf.png (512x512 RGBA) - Broad cordate serrated leaf with realistic veining
3. sunflower_soil.png (1024x1024 RGB) - Warm agricultural soil bed with tilled furrows
"""

import math
import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
TEXTURES_DIR = ROOT / "public" / "game-assets" / "world" / "festival" / "textures"
TEXTURES_DIR.mkdir(parents=True, exist_ok=True)

def generate_sunflower_head(path: Path):
    print("Generating sunflower_head.png...")
    size = 1024
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    center = (size / 2.0, size / 2.0)
    cx, cy = center

    # Outer ray petals: 2 layers (back layer 32 petals, front layer 32 petals offset)
    max_r = size * 0.47
    inner_r = size * 0.22

    for layer, (layer_count, r_mult, w_mult, col_base) in enumerate([
        (34, 1.0, 1.0, (230, 155, 10)),
        (34, 0.95, 0.92, (255, 195, 15)),
        (34, 0.88, 0.82, (255, 218, 30)),
    ]):
        offset_angle = (layer * math.pi) / layer_count
        for i in range(layer_count):
            angle = offset_angle + (i / layer_count) * 2 * math.pi
            # Petal spine
            cos_a = math.cos(angle)
            sin_a = math.sin(angle)
            tan_x = -sin_a
            tan_y = cos_a

            tip_r = max_r * r_mult * (1.0 + 0.05 * math.sin(i * 3.7))
            base_w = size * 0.048 * w_mult
            mid_w = size * 0.065 * w_mult

            # Construct curved petal polygon
            p_base_l = (cx + inner_r * 0.9 * cos_a - base_w * tan_x, cy + inner_r * 0.9 * sin_a - base_w * tan_y)
            p_mid_l = (cx + tip_r * 0.55 * cos_a - mid_w * tan_x, cy + tip_r * 0.55 * sin_a - mid_w * tan_y)
            p_tip = (cx + tip_r * cos_a, cy + tip_r * sin_a)
            p_mid_r = (cx + tip_r * 0.55 * cos_a + mid_w * tan_x, cy + tip_r * 0.55 * sin_a + mid_w * tan_y)
            p_base_r = (cx + inner_r * 0.9 * cos_a + base_w * tan_x, cy + inner_r * 0.9 * sin_a + base_w * tan_y)

            # Color variation
            cr = min(255, int(col_base[0] + 15 * math.cos(i * 1.5)))
            cg = min(255, int(col_base[1] + 12 * math.sin(i * 2.1)))
            cb = min(255, int(col_base[2] + 8 * math.cos(i * 0.7)))

            draw.polygon([p_base_l, p_mid_l, p_tip, p_mid_r, p_base_r], fill=(cr, cg, cb, 255))
            # Petal center crease line
            crease_c = (max(0, cr - 35), max(0, cg - 35), max(0, cb - 10), 220)
            draw.line([(cx + inner_r * cos_a, cy + inner_r * sin_a), (cx + tip_r * 0.92 * cos_a, cy + tip_r * 0.92 * sin_a)], fill=crease_c, width=3)

    # Solid dark chocolate seed disk base
    draw.ellipse([cx - inner_r * 1.06, cy - inner_r * 1.06, cx + inner_r * 1.06, cy + inner_r * 1.06], fill=(32, 18, 8, 255))

    # Disk florets: golden spiral (Fibonacci phyllotaxis)
    # Golden angle ~ 137.50776 degrees
    golden_angle = math.radians(137.507764)
    num_seeds = 1250
    c_spread = (inner_r * 1.05) / math.sqrt(num_seeds)

    for n in range(num_seeds):
        r = c_spread * math.sqrt(n)
        theta = n * golden_angle
        sx = cx + r * math.cos(theta)
        sy = cy + r * math.sin(theta)

        # Seed size grows from center to rim
        rel_r = r / inner_r
        seed_rad = 2.4 + 3.6 * rel_r

        # Color: center is deep chocolate espresso, mid is warm chestnut, outer rim has golden floret tips
        if rel_r < 0.30:
            scol = (26, 14, 6, 255)
        elif rel_r < 0.70:
            t = (rel_r - 0.30) / 0.40
            scol = (int(36 + t * 40), int(20 + t * 22), int(10 + t * 8), 255)
        elif rel_r < 0.90:
            t = (rel_r - 0.70) / 0.20
            scol = (int(76 + t * 90), int(42 + t * 55), int(18 + t * 14), 255)
        else:
            t = (rel_r - 0.90) / 0.10
            scol = (int(166 + t * 85), int(97 + t * 75), int(32 + t * 20), 255)

        draw.ellipse([sx - seed_rad, sy - seed_rad, sx + seed_rad, sy + seed_rad], fill=scol)
        draw.ellipse([sx - seed_rad * 0.35, sy - seed_rad * 0.35, sx + seed_rad * 0.35, sy + seed_rad * 0.35], fill=(min(255, scol[0] + 25), min(255, scol[1] + 18), min(255, scol[2] + 8), 255))

    img.save(path, "PNG")
    print(f"Saved: {path}")

def generate_sunflower_leaf(path: Path):
    print("Generating sunflower_leaf.png...")
    size = 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Heart/cordate sunflower leaf silhouette
    pts_left = []
    pts_right = []
    steps = 40

    for i in range(steps + 1):
        t = i / steps  # 0 at base, 1 at tip
        y = 480 - t * 430
        if t < 0.25:
            w = 175 * math.sin(t / 0.25 * (math.pi / 2))
        else:
            w = 175 * math.cos((t - 0.25) / 0.75 * (math.pi / 2))

        serration = 6.0 * math.sin(t * 52)
        w = max(0.0, w + serration)

        pts_left.append((256 - w, y))
        pts_right.append((256 + w, y))

    poly = pts_left + list(reversed(pts_right))
    # Leaf lamina base fill
    draw.polygon(poly, fill=(44, 98, 48, 255))

    # Inner leaf shading
    inner_pts_left = [(256 - (256 - p[0]) * 0.88, p[1]) for p in pts_left]
    inner_pts_right = [(256 + (p[0] - 256) * 0.88, p[1]) for p in pts_right]
    draw.polygon(inner_pts_left + list(reversed(inner_pts_right)), fill=(52, 118, 56, 255))

    # Veins layer clipped with mask
    vein_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    vdraw = ImageDraw.Draw(vein_img)
    vein_color = (120, 175, 85, 230)

    # Central primary vein
    vdraw.line([(256, 480), (256, 50)], fill=vein_color, width=7)

    # Lateral secondary veins
    for vi in range(1, 9):
        vy = 450 - vi * 44
        spread = 50 + vi * 11
        y_end = vy - 26
        vdraw.line([(256, vy), (256 - spread, y_end)], fill=vein_color, width=3)
        vdraw.line([(256, vy), (256 + spread, y_end)], fill=vein_color, width=3)

    # Clip veins inside leaf polygon
    mask = Image.new("L", (size, size), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.polygon(poly, fill=255)
    vein_clipped = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    vein_clipped.paste(vein_img, (0, 0), mask)

    img = Image.alpha_composite(img, vein_clipped)

    img.save(path, "PNG")
    print(f"Saved: {path}")

def generate_sunflower_soil(path: Path):
    print("Generating sunflower_soil.png...")
    size = 1024
    # Warm rich agricultural loam / dark fertile soil
    arr = np.zeros((size, size, 3), dtype=np.uint8)

    # Base dark earth: R ~ 62, G ~ 48, B ~ 34
    np.random.seed(42)
    noise_fine = np.random.randint(-12, 12, (size, size))
    noise_coarse = np.random.randint(-20, 20, (size // 8, size // 8))
    # Coarse noise via PIL resize
    coarse_img = Image.fromarray((noise_coarse + 128).astype(np.uint8), mode='L').resize((size, size), Image.Resampling.BILINEAR)
    coarse_arr = np.array(coarse_img, dtype=np.int16) - 128

    # Furrow lines along X axis (plowed sunflower rows)
    row_freq = 32
    y_coords = np.arange(size)[:, None]
    furrows = (np.sin(y_coords * (2 * math.pi / row_freq)) * 14).astype(np.int16)

    r_ch = np.clip(64 + noise_fine + coarse_arr // 2 + furrows, 28, 110)
    g_ch = np.clip(48 + noise_fine * 0.8 + coarse_arr // 2 + furrows * 0.8, 22, 90)
    b_ch = np.clip(32 + noise_fine * 0.6 + coarse_arr // 3 + furrows * 0.6, 14, 68)

    arr[:, :, 0] = r_ch
    arr[:, :, 1] = g_ch
    arr[:, :, 2] = b_ch

    img = Image.fromarray(arr, mode="RGB")
    # Soft sprinkle of fine pebbles / mulch
    draw = ImageDraw.Draw(img)
    colors = [(85, 70, 52), (105, 92, 74), (45, 35, 25)]
    for _ in range(350):
        px = np.random.randint(0, size)
        py = np.random.randint(0, size)
        pr = np.random.randint(2, 5)
        pcol = colors[np.random.randint(0, len(colors))]
        draw.ellipse([px - pr, py - pr, px + pr, py + pr], fill=pcol)

    img.save(path, "PNG")
    print(f"Saved: {path}")

if __name__ == "__main__":
    generate_sunflower_head(TEXTURES_DIR / "sunflower_head.png")
    generate_sunflower_leaf(TEXTURES_DIR / "sunflower_leaf.png")
    generate_sunflower_soil(TEXTURES_DIR / "sunflower_soil.png")
    print("All sunflower textures generated successfully!")
