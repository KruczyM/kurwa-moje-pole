import math
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

def generate_props_and_items():
    props_dir = Path("public/game-assets/2d/after/props")
    items_dir = props_dir / "items"
    props_dir.mkdir(parents=True, exist_ok=True)
    items_dir.mkdir(parents=True, exist_ok=True)

    # 1. Power Generator (Agregat prądotwórczy) 128x128
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Tubular frame
    d.rounded_rectangle([20, 36, 108, 98], radius=8, outline=(40, 42, 45, 255), width=4)
    # Main engine/tank body (Red)
    d.rounded_rectangle([26, 44, 102, 70], radius=4, fill=(195, 35, 30, 255), outline=(130, 20, 15, 255), width=2)
    # Black engine lower section
    d.rounded_rectangle([28, 68, 100, 92], radius=3, fill=(50, 52, 55, 255), outline=(30, 32, 35, 255), width=2)
    # Fuel cap on top
    d.rectangle([54, 38, 74, 44], fill=(30, 30, 30, 255), outline=(15, 15, 15, 255))
    # Control panel (Yellow gauge + sockets)
    d.rectangle([34, 72, 60, 88], fill=(20, 20, 20, 255))
    d.ellipse([38, 74, 48, 84], fill=(240, 240, 220, 255), outline=(0, 0, 0, 255))
    d.line([(43, 79), (46, 76)], fill=(200, 0, 0, 255), width=1) # Gauge needle
    # Blue sockets
    d.ellipse([66, 74, 74, 82], fill=(40, 90, 210, 255))
    d.ellipse([78, 74, 86, 82], fill=(40, 90, 210, 255))
    # Wheels
    d.ellipse([14, 84, 32, 102], fill=(30, 30, 30, 255), outline=(70, 70, 70, 255), width=2)
    d.ellipse([96, 84, 114, 102], fill=(30, 30, 30, 255), outline=(70, 70, 70, 255), width=2)
    # Handle
    d.line([(20, 44), (10, 36)], fill=(40, 42, 45, 255), width=4)
    img.save(props_dir / "power_generator.png")
    print("Saved prop: power_generator.png")

    # 2. Cable Reel (Bęben kablowy z pomarańczowym kablem) 96x96
    img = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Base stand (Metal triangle)
    d.line([(24, 76), (48, 30), (72, 76)], fill=(120, 125, 130, 255), width=4)
    d.line([(18, 76), (78, 76)], fill=(120, 125, 130, 255), width=4)
    # Cable reel drum (Orange cable coiled)
    d.ellipse([26, 32, 70, 76], fill=(240, 110, 25, 255), outline=(200, 80, 10, 255), width=3)
    # Center hub (Black with yellow sockets)
    d.ellipse([36, 42, 60, 66], fill=(40, 40, 40, 255), outline=(20, 20, 20, 255), width=2)
    d.ellipse([42, 48, 46, 52], fill=(245, 200, 20, 255))
    d.ellipse([50, 48, 54, 52], fill=(245, 200, 20, 255))
    d.ellipse([46, 56, 50, 60], fill=(245, 200, 20, 255))
    # Uncoiled loose cable running on ground
    d.line([(70, 68), (84, 82), (92, 80)], fill=(245, 115, 25, 255), width=3)
    img.save(props_dir / "cable_reel.png")
    print("Saved prop: cable_reel.png")

    # 3. Party Pavilion (Obozowy pawilon ogrodowy z rurkami) 224x224
    img = Image.new("RGBA", (224, 224), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # White metal corner poles
    poles = [(36, 60, 36, 170), (188, 60, 188, 170), (56, 80, 56, 195), (168, 80, 168, 195)]
    for x0, y0, x1, y1 in poles:
        d.line([(x0, y0), (x1, y1)], fill=(210, 215, 220, 255), width=4)
    # Shadow under roof
    d.polygon([(36, 60), (188, 60), (168, 80), (56, 80)], fill=(0, 0, 0, 45))
    # Canopy roof (Striped Blue and White)
    roof_poly = [(112, 18), (200, 62), (170, 95), (54, 95), (24, 62)]
    d.polygon(roof_poly, fill=(240, 245, 250, 255), outline=(180, 185, 190, 255), width=2)
    # Blue stripes on roof
    for sx in range(40, 180, 36):
        d.polygon([(sx, 60), (sx + 16, 60), (sx + 26, 92), (sx + 10, 92)], fill=(30, 90, 180, 255))
        d.polygon([(112, 20), (112 + (sx - 112) // 4, 20), (sx + 16, 60), (sx, 60)], fill=(25, 80, 165, 255))
    # Peak point
    d.ellipse([108, 14, 116, 22], fill=(220, 220, 220, 255))
    img.save(props_dir / "pavilion.png")
    print("Saved prop: pavilion.png")

    # 4. Gastro Stall (Stoisko Kebab / Frytki) 192x160
    img = Image.new("RGBA", (192, 160), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Wooden counter
    d.rectangle([24, 70, 168, 135], fill=(135, 95, 55, 255), outline=(85, 55, 30, 255), width=3)
    # Countertop surface
    d.rectangle([18, 64, 174, 74], fill=(220, 225, 230, 255), outline=(160, 165, 170, 255), width=2)
    # Menu board on front
    d.rectangle([40, 84, 85, 122], fill=(30, 30, 30, 255), outline=(150, 110, 70, 255), width=2)
    d.line([(45, 92), (80, 92)], fill=(240, 240, 200, 255), width=1)
    d.line([(45, 100), (75, 100)], fill=(240, 240, 200, 255), width=1)
    d.line([(45, 108), (78, 108)], fill=(240, 240, 200, 255), width=1)
    # Awning / Canopy (Yellow & Red stripes)
    d.polygon([(12, 25), (180, 25), (170, 60), (22, 60)], fill=(245, 195, 20, 255), outline=(180, 30, 25, 255), width=2)
    for ax in range(20, 170, 28):
        d.polygon([(ax, 25), (ax + 14, 25), (ax + 12, 60), (ax - 2, 60)], fill=(210, 35, 30, 255))
    # Neon Sign: KEBAB
    d.rectangle([50, 8, 142, 28], fill=(18, 18, 20, 255), outline=(245, 200, 20, 255), width=2)
    d.text((64, 11), "★ GASTRO ★", fill=(255, 225, 50, 255))
    img.save(props_dir / "gastro_stall.png")
    print("Saved prop: gastro_stall.png")

    # 5. Beer Crate (Skrzynka na piwo) 80x80
    img = Image.new("RGBA", (80, 80), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([12, 24, 68, 64], radius=4, fill=(180, 30, 30, 255), outline=(110, 15, 15, 255), width=2)
    # Bottles inside (Gold caps)
    for bx in [20, 32, 44, 56]:
        for by in [20, 30]:
            d.ellipse([bx, by, bx + 7, by + 7], fill=(225, 185, 30, 255), outline=(140, 110, 15, 255))
    # Crate handle cutouts
    d.rounded_rectangle([30, 40, 50, 48], radius=3, fill=(0, 0, 0, 0), outline=(110, 15, 15, 255), width=2)
    img.save(props_dir / "beer_crate.png")
    print("Saved prop: beer_crate.png")

    # Quest Items (64x64 or 80x80)
    # 6. Missing Left Shoe (Zgubiony lewy trampkowy but) 64x64
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Rubber sole
    d.polygon([(14, 46), (50, 46), (52, 40), (16, 40)], fill=(235, 235, 240, 255), outline=(160, 160, 170, 255), width=1)
    # Canvas shoe body (Black / dark blue)
    d.polygon([(16, 40), (48, 40), (46, 22), (34, 22), (28, 30), (14, 38)], fill=(30, 35, 50, 255), outline=(15, 20, 30, 255), width=2)
    # White rubber toe cap
    d.ellipse([10, 36, 20, 46], fill=(235, 235, 240, 255), outline=(160, 160, 170, 255))
    # Laces
    d.line([(30, 26), (36, 32)], fill=(240, 240, 240, 255), width=1)
    d.line([(36, 26), (30, 32)], fill=(240, 240, 240, 255), width=1)
    # Loose unlaced string
    d.line([(36, 24), (46, 18), (52, 22)], fill=(240, 240, 240, 255), width=1)
    img.save(items_dir / "missing_shoe.png")
    print("Saved item: missing_shoe.png")

    # 7. Cracked Phone (Telefon z pękniętym ekranem) 64x64
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Case
    d.rounded_rectangle([18, 10, 46, 54], radius=5, fill=(35, 36, 40, 255), outline=(75, 78, 85, 255), width=2)
    # Screen (Glow blue)
    d.rounded_rectangle([21, 14, 43, 50], radius=2, fill=(20, 60, 100, 255))
    # Battery icon (Red - low battery)
    d.rectangle([25, 17, 33, 22], outline=(255, 255, 255, 255))
    d.rectangle([26, 18, 28, 21], fill=(240, 40, 40, 255))
    # Crack lines
    d.line([(24, 26), (34, 34), (30, 44)], fill=(230, 245, 255, 220), width=1)
    d.line([(34, 34), (41, 30)], fill=(230, 245, 255, 200), width=1)
    d.line([(34, 34), (38, 42)], fill=(230, 245, 255, 180), width=1)
    img.save(items_dir / "cracked_phone.png")
    print("Saved item: cracked_phone.png")

    # 8. Powerbank (Ładowarka / Powerbank z kablem) 64x64
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Body
    d.rounded_rectangle([16, 16, 48, 48], radius=6, fill=(45, 48, 55, 255), outline=(90, 95, 105, 255), width=2)
    # Green LED charge indicators
    for lx in [22, 28, 34, 40]:
        d.ellipse([lx, 22, lx + 3, 25], fill=(35, 225, 80, 255))
    # USB port
    d.rectangle([28, 44, 36, 48], fill=(15, 15, 15, 255))
    # White USB cable coming out
    d.line([(32, 48), (32, 54), (44, 56), (46, 52)], fill=(225, 230, 235, 255), width=2)
    img.save(items_dir / "powerbank.png")
    print("Saved item: powerbank.png")

    # 9. Acoustic Guitar (Gitara akustyczna z brakującymi strunami) 80x80
    img = Image.new("RGBA", (80, 80), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Body (Warm wood)
    d.ellipse([18, 32, 48, 68], fill=(215, 140, 55, 255), outline=(130, 75, 20, 255), width=2)
    d.ellipse([24, 22, 44, 44], fill=(210, 135, 50, 255), outline=(130, 75, 20, 255), width=2)
    # Soundhole
    d.ellipse([30, 36, 38, 44], fill=(40, 20, 10, 255), outline=(160, 95, 30, 255), width=1)
    # Neck
    d.rectangle([32, 8, 36, 26], fill=(120, 70, 25, 255), outline=(80, 45, 15, 255))
    # Headstock
    d.rectangle([31, 4, 37, 10], fill=(95, 50, 15, 255))
    # Two strings only!
    d.line([(33, 6), (33, 56)], fill=(220, 220, 220, 220), width=1)
    d.line([(35, 6), (35, 56)], fill=(220, 220, 220, 220), width=1)
    img.save(items_dir / "acoustic_guitar.png")
    print("Saved item: acoustic_guitar.png")

    # 10. Golden Can (Złota puszka 1995) 64x64
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Can body
    d.rounded_rectangle([20, 14, 44, 52], radius=4, fill=(240, 195, 35, 255), outline=(175, 135, 15, 255), width=2)
    # Rim top & bottom
    d.ellipse([21, 12, 43, 18], fill=(215, 218, 222, 255), outline=(150, 155, 160, 255))
    d.ellipse([21, 48, 43, 54], fill=(215, 218, 222, 255), outline=(150, 155, 160, 255))
    # Woodstock Star
    d.polygon([(32, 26), (34, 32), (40, 32), (35, 36), (37, 42), (32, 38), (27, 42), (29, 36), (24, 32), (30, 32)], fill=(255, 245, 150, 255))
    img.save(items_dir / "golden_can.png")
    print("Saved item: golden_can.png")

if __name__ == "__main__":
    generate_props_and_items()
