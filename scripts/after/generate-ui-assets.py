import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

def generate_ui_assets():
    ui_dir = Path("public/game-assets/2d/after/ui")
    ui_dir.mkdir(parents=True, exist_ok=True)

    # 1. Dialogue Box Background (480x130, dark glass with orange/gold neon border)
    w, h = 480, 130
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Dark translucent backing
    d.rounded_rectangle([4, 4, w - 5, h - 5], radius=10, fill=(18, 14, 20, 235), outline=(245, 155, 30, 255), width=2)
    # Inner border line
    d.rounded_rectangle([8, 8, w - 9, h - 9], radius=7, outline=(60, 45, 75, 200), width=1)
    # Speaker nameplate area on top-left
    d.rounded_rectangle([18, 0, 150, 24], radius=4, fill=(35, 22, 45, 255), outline=(245, 155, 30, 255), width=2)
    # Continue indicator arrow in bottom right
    d.polygon([(w - 28, h - 18), (w - 18, h - 18), (w - 23, h - 12)], fill=(245, 185, 40, 255))
    img.save(ui_dir / "dialogue_box.png")
    print("Saved UI: dialogue_box.png")

    # 2. Portrait Frame (80x80 frame for 2D dialogue portraits)
    img = Image.new("RGBA", (80, 80), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([2, 2, 77, 77], radius=8, fill=(25, 20, 32, 240), outline=(245, 160, 35, 255), width=3)
    d.rounded_rectangle([6, 6, 73, 73], radius=6, outline=(120, 85, 140, 180), width=1)
    # Corner golden pins
    for px, py in [(6, 6), (73, 6), (6, 73), (73, 73)]:
        d.ellipse([px - 2, py - 2, px + 2, py + 2], fill=(255, 215, 60, 255))
    img.save(ui_dir / "portrait_frame.png")
    print("Saved UI: portrait_frame.png")

    # 3. HUD Stamina & Condition Bar (200x32)
    img = Image.new("RGBA", (200, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Frame
    d.rounded_rectangle([2, 6, 197, 26], radius=5, fill=(20, 20, 25, 220), outline=(80, 85, 95, 255), width=2)
    # Stamina bar fill (Green to yellow gradient)
    for x in range(6, 150):
        t = (x - 6) / 144.0
        r = int(50 + t * 180)
        g = int(220 - t * 30)
        b = 50
        d.line([(x, 10), (x, 22)], fill=(r, g, b, 255))
    # Lightning bolt icon on the left
    d.polygon([(14, 8), (8, 16), (13, 16), (11, 24), (18, 14), (13, 14)], fill=(255, 230, 40, 255))
    img.save(ui_dir / "hud_stamina_bar.png")
    print("Saved UI: hud_stamina_bar.png")

    # 4. Inventory Slot Frame (56x56)
    img = Image.new("RGBA", (56, 56), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([3, 3, 52, 52], radius=6, fill=(24, 26, 32, 230), outline=(130, 135, 145, 255), width=2)
    d.rounded_rectangle([7, 7, 48, 48], radius=4, fill=(15, 17, 22, 255))
    img.save(ui_dir / "inventory_slot.png")
    print("Saved UI: inventory_slot.png")

    # 5. Inventory Slot Selected (56x56, highlighted orange)
    img = Image.new("RGBA", (56, 56), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([2, 2, 53, 53], radius=6, fill=(35, 28, 22, 240), outline=(250, 165, 30, 255), width=3)
    d.rounded_rectangle([6, 6, 49, 49], radius=4, fill=(22, 18, 15, 255))
    img.save(ui_dir / "inventory_slot_selected.png")
    print("Saved UI: inventory_slot_selected.png")

    # 6. Target Indicator / Compass Waypoint Pin (48x48)
    img = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Yellow festival sun pointer
    d.polygon([(24, 6), (36, 36), (24, 28), (12, 36)], fill=(255, 215, 30, 255), outline=(180, 120, 10, 255), width=2)
    d.ellipse([21, 16, 27, 22], fill=(220, 40, 30, 255))
    img.save(ui_dir / "target_indicator.png")
    print("Saved UI: target_indicator.png")

    # 7. Title Screen Banner "AFTER: Ostatnia Noc" (512x140)
    img = Image.new("RGBA", (512, 140), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Background badge with gradient / glow
    d.rounded_rectangle([6, 6, 505, 133], radius=14, fill=(16, 12, 22, 245), outline=(245, 160, 30, 255), width=3)
    d.rounded_rectangle([12, 12, 499, 127], radius=10, outline=(90, 60, 120, 200), width=1)
    
    # Title Text
    d.text((44, 24), "AFTER", fill=(255, 220, 40, 255), font_size=42)
    d.text((220, 34), "OSTATNIA NOC", fill=(255, 140, 30, 255), font_size=30)
    d.text((46, 84), "2D FESTIVAL CO-OP ADVENTURE", fill=(200, 215, 240, 255), font_size=15)
    
    # Sunflower icon decoration
    d.ellipse([435, 42, 475, 82], fill=(245, 195, 20, 255), outline=(180, 130, 10, 255), width=2)
    d.ellipse([445, 52, 465, 72], fill=(60, 40, 25, 255))
    
    img.save(ui_dir / "title_banner.png")
    print("Saved UI: title_banner.png")

if __name__ == "__main__":
    generate_ui_assets()
