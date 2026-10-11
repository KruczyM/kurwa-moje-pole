import json
import math
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

def create_tiles():
    out_dir = Path("public/game-assets/2d/after/tiles")
    out_dir.mkdir(parents=True, exist_ok=True)
    
    tile_size = 64
    tiles = {}

    # Seed for determinism
    rng = random.Random(42)

    # 1. Lush Festival Grass
    img = Image.new("RGBA", (tile_size, tile_size), (45, 105, 35, 255))
    draw = ImageDraw.Draw(img)
    for x in range(tile_size):
        for y in range(tile_size):
            noise = rng.randint(-12, 12)
            c = (
                max(0, min(255, 45 + noise)),
                max(0, min(255, 105 + noise * 2)),
                max(0, min(255, 35 + noise)),
                255
            )
            img.putpixel((x, y), c)
    # Add grass blades
    for _ in range(35):
        gx = rng.randint(2, tile_size - 4)
        gy = rng.randint(4, tile_size - 2)
        h = rng.randint(4, 9)
        color = (rng.randint(60, 90), rng.randint(130, 175), rng.randint(40, 65), 255)
        draw.line([(gx, gy), (gx + rng.randint(-2, 2), gy - h)], fill=color, width=1)
    tiles["grass"] = img

    # 2. Trampled Camp Grass (dryer, worn)
    img = Image.new("RGBA", (tile_size, tile_size), (85, 110, 45, 255))
    draw = ImageDraw.Draw(img)
    for x in range(tile_size):
        for y in range(tile_size):
            noise = rng.randint(-15, 15)
            c = (
                max(0, min(255, 95 + noise * 2)),
                max(0, min(255, 105 + noise)),
                max(0, min(255, 45 + noise)),
                255
            )
            img.putpixel((x, y), c)
    for _ in range(15):
        gx = rng.randint(2, tile_size - 4)
        gy = rng.randint(4, tile_size - 2)
        draw.line([(gx, gy), (gx + rng.randint(-2, 2), gy - 4)], fill=(120, 130, 60, 255), width=1)
    tiles["grass_trampled"] = img

    # 3. Mud (Festiwalowe Błoto)
    img = Image.new("RGBA", (tile_size, tile_size), (58, 42, 28, 255))
    draw = ImageDraw.Draw(img)
    for x in range(tile_size):
        for y in range(tile_size):
            noise = rng.randint(-16, 16)
            c = (
                max(0, min(255, 58 + noise)),
                max(0, min(255, 42 + noise)),
                max(0, min(255, 28 + noise // 2)),
                255
            )
            img.putpixel((x, y), c)
    # Puddle reflections
    for _ in range(4):
        px = rng.randint(10, tile_size - 20)
        py = rng.randint(10, tile_size - 20)
        pw = rng.randint(10, 22)
        ph = rng.randint(6, 14)
        draw.ellipse([px, py, px + pw, py + ph], fill=(42, 34, 26, 255), outline=(75, 58, 40, 255))
    tiles["mud"] = img

    # 4. Dirt Path
    img = Image.new("RGBA", (tile_size, tile_size), (120, 95, 65, 255))
    draw = ImageDraw.Draw(img)
    for x in range(tile_size):
        for y in range(tile_size):
            noise = rng.randint(-14, 14)
            c = (
                max(0, min(255, 120 + noise)),
                max(0, min(255, 95 + noise)),
                max(0, min(255, 65 + noise)),
                255
            )
            img.putpixel((x, y), c)
    # Small pebbles
    for _ in range(18):
        px = rng.randint(2, tile_size - 4)
        py = rng.randint(2, tile_size - 4)
        draw.point((px, py), fill=(160, 140, 110, 255))
        draw.point((px + 1, py), fill=(70, 50, 30, 255))
    tiles["dirt_path"] = img

    # 5. Concrete Slabs (Betonowe płyty alei)
    img = Image.new("RGBA", (tile_size, tile_size), (150, 152, 155, 255))
    draw = ImageDraw.Draw(img)
    for x in range(tile_size):
        for y in range(tile_size):
            noise = rng.randint(-8, 8)
            c = (
                max(0, min(255, 150 + noise)),
                max(0, min(255, 152 + noise)),
                max(0, min(255, 155 + noise)),
                255
            )
            img.putpixel((x, y), c)
    # Slab seam border
    draw.rectangle([0, 0, tile_size - 1, tile_size - 1], outline=(100, 102, 105, 255))
    draw.rectangle([1, 1, tile_size - 2, tile_size - 2], outline=(180, 182, 185, 255))
    tiles["concrete_slab"] = img

    # 6. Asphalt Road
    img = Image.new("RGBA", (tile_size, tile_size), (55, 56, 60, 255))
    draw = ImageDraw.Draw(img)
    for x in range(tile_size):
        for y in range(tile_size):
            noise = rng.randint(-10, 10)
            c = (
                max(0, min(255, 55 + noise)),
                max(0, min(255, 56 + noise)),
                max(0, min(255, 60 + noise)),
                255
            )
            img.putpixel((x, y), c)
    tiles["asphalt_road"] = img

    # 7. Wooden Boardwalk (Kładki deski)
    img = Image.new("RGBA", (tile_size, tile_size), (135, 95, 55, 255))
    draw = ImageDraw.Draw(img)
    plank_h = 16
    for i in range(tile_size // plank_h):
        y0 = i * plank_h
        y1 = y0 + plank_h - 1
        draw.rectangle([0, y0, tile_size - 1, y1], fill=(140 + rng.randint(-10, 10), 100 + rng.randint(-8, 8), 60 + rng.randint(-6, 6), 255), outline=(75, 50, 25, 255))
        # Nail dots
        draw.point((6, y0 + 4), fill=(40, 30, 20, 255))
        draw.point((tile_size - 8, y0 + 4), fill=(40, 30, 20, 255))
    tiles["wood_planks"] = img

    # 8. Metal Crowd Barrier (Barierka festiwalowa)
    img = Image.new("RGBA", (tile_size, tile_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Barrier frame
    draw.rectangle([4, 20, tile_size - 5, 48], outline=(185, 190, 195, 255), width=3)
    # Vertical rungs
    for rx in range(10, tile_size - 6, 8):
        draw.line([(rx, 22), (rx, 46)], fill=(160, 165, 170, 255), width=2)
    # Barrier feet
    draw.line([(8, 48), (8, 56)], fill=(120, 125, 130, 255), width=4)
    draw.line([(tile_size - 9, 48), (tile_size - 9, 56)], fill=(120, 125, 130, 255), width=4)
    tiles["fence_barrier"] = img

    # 9. Camping Ground Tarp (Niebieska plandeka namiotowa)
    img = Image.new("RGBA", (tile_size, tile_size), (24, 75, 140, 255))
    draw = ImageDraw.Draw(img)
    for x in range(tile_size):
        for y in range(tile_size):
            grid = 8
            border_val = 15 if (x % grid == 0 or y % grid == 0) else 0
            c = (
                max(0, min(255, 24 + border_val)),
                max(0, min(255, 75 + border_val)),
                max(0, min(255, 140 + border_val)),
                255
            )
            img.putpixel((x, y), c)
    # Eyelets at corners
    for cx, cy in [(4, 4), (tile_size - 5, 4), (4, tile_size - 5), (tile_size - 5, tile_size - 5)]:
        draw.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=(200, 200, 200, 255), outline=(50, 50, 50, 255))
    tiles["tent_tarp"] = img

    # 10. Hazard Warning Strip (Żółto-czarna taśma)
    img = Image.new("RGBA", (tile_size, tile_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    stripe_w = 16
    for sx in range(-tile_size, tile_size * 2, stripe_w * 2):
        draw.polygon([
            (sx, 24),
            (sx + stripe_w, 24),
            (sx + stripe_w + 14, 40),
            (sx + 14, 40)
        ], fill=(245, 200, 20, 255))
        draw.polygon([
            (sx + stripe_w, 24),
            (sx + stripe_w * 2, 24),
            (sx + stripe_w * 2 + 14, 40),
            (sx + stripe_w + 14, 40)
        ], fill=(30, 30, 30, 255))
    tiles["hazard_strip"] = img

    # Save individual tiles
    for name, t_img in tiles.items():
        t_img.save(out_dir / f"{name}.png")
        print(f"Saved tile: {name}.png")

    # Build Atlas (Tileset.png)
    atlas_cols = 4
    atlas_rows = math.ceil(len(tiles) / atlas_cols)
    atlas = Image.new("RGBA", (atlas_cols * tile_size, atlas_rows * tile_size), (0, 0, 0, 0))

    meta = {
        "tileSize": tile_size,
        "cols": atlas_cols,
        "rows": atlas_rows,
        "tiles": {}
    }

    for idx, (name, t_img) in enumerate(tiles.items()):
        col = idx % atlas_cols
        row = idx // atlas_cols
        x = col * tile_size
        y = row * tile_size
        atlas.paste(t_img, (x, y))
        meta["tiles"][name] = {
            "index": idx,
            "x": x,
            "y": y,
            "width": tile_size,
            "height": tile_size
        }

    atlas_path = out_dir / "tileset.png"
    atlas.save(atlas_path)
    print(f"Saved tileset atlas: {atlas_path} ({atlas.width}x{atlas.height})")

    meta_path = out_dir / "tileset.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"Saved tileset meta: {meta_path}")

if __name__ == "__main__":
    create_tiles()
