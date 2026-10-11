import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

def generate_map_previews():
    root = Path("public/game-assets/2d/after")
    maps_dir = root / "maps"
    maps_dir.mkdir(parents=True, exist_ok=True)

    tiles_dir = root / "tiles"
    props_dir = root / "props"
    chars_dir = root / "characters"
    ui_dir = root / "ui"
    portraits_dir = root / "portraits"

    # Load tile textures
    grass = Image.open(tiles_dir / "grass.png")
    grass_trampled = Image.open(tiles_dir / "grass_trampled.png")
    mud = Image.open(tiles_dir / "mud.png")
    wood = Image.open(tiles_dir / "wood_planks.png")
    concrete = Image.open(tiles_dir / "concrete_slab.png")
    asphalt = Image.open(tiles_dir / "asphalt_road.png")
    fence = Image.open(tiles_dir / "fence_barrier.png")
    tarp = Image.open(tiles_dir / "tent_tarp.png")

    # Load props
    flag = Image.open(props_dir / "camp_flag.png")
    toitoi = Image.open(props_dir / "toitoi.png")
    tent_small = Image.open(props_dir / "tent_small.png")
    tent_large = Image.open(props_dir / "tent_large.png")
    pavilion = Image.open(props_dir / "pavilion.png")
    chair = Image.open(props_dir / "camping_chair.png")
    table = Image.open(props_dir / "picnic_table.png")
    generator = Image.open(props_dir / "power_generator.png")
    cable = Image.open(props_dir / "cable_reel.png")
    gastro = Image.open(props_dir / "gastro_stall.png")
    shoe = Image.open(props_dir / "items/missing_shoe.png")
    phone = Image.open(props_dir / "items/cracked_phone.png")
    can = Image.open(props_dir / "items/golden_can.png")

    # Load characters (extract single 64x64 frame)
    amper_sheet = Image.open(chars_dir / "amper/spritesheet.png")
    amper_front = amper_sheet.crop((0, 0, 64, 64)) # Down idle
    amper_walk = amper_sheet.crop((128, 64, 192, 128)) # Right walk

    chlebak_sheet = Image.open(chars_dir / "chlebak/spritesheet.png")
    chlebak_front = chlebak_sheet.crop((0, 0, 64, 64))

    klatwa_sheet = Image.open(chars_dir / "klatwa/spritesheet.png")
    klatwa_left = klatwa_sheet.crop((0, 192, 64, 256))

    gruczol_sheet = Image.open(chars_dir / "gruczol/spritesheet.png")
    gruczol_front = gruczol_sheet.crop((0, 0, 64, 64))

    # --- MAP 1: OBÓZ KURWA MOJE POLE (800x480) ---
    map_w, map_h = 800, 480
    camp_map = Image.new("RGBA", (map_w, map_h), (35, 80, 25, 255))

    # 1. Tile grid background
    ts = 64
    for gx in range(0, map_w, ts):
        for gy in range(0, map_h, ts):
            # Camp central area is trampled grass, outskirts lush grass
            dist_to_center = math.hypot(gx - 400, gy - 240)
            if dist_to_center < 180:
                t = grass_trampled
            elif gx > 620:
                t = mud # Mud pit on the right
            else:
                t = grass
            camp_map.paste(t, (gx, gy))

    # Wooden boardwalk path across camp
    for px in range(120, 680, ts):
        camp_map.paste(wood, (px, 250))

    # Tent tarps under camping spots
    camp_map.paste(tarp, (80, 120))
    camp_map.paste(tarp, (80 + ts, 120))
    camp_map.paste(tarp, (480, 100))

    # 2. Place Props
    # Pavilion in upper central
    camp_map.paste(pavilion, (280, 60), pavilion)

    # Tents
    camp_map.paste(tent_large, (60, 80), tent_large)
    camp_map.paste(tent_small, (500, 80), tent_small)

    # Picnic table & chairs inside pavilion area
    camp_map.paste(table, (310, 150), table)
    camp_map.paste(chair, (280, 165), chair)
    camp_map.paste(chair, (410, 165), chair)

    # Camp Flag prominently at camp entrance
    camp_map.paste(flag, (200, 200), flag)

    # Power generator & cable reel
    camp_map.paste(generator, (490, 240), generator)
    camp_map.paste(cable, (440, 260), cable)

    # Toi Toi at the camp border
    camp_map.paste(toitoi, (680, 160), toitoi)
    camp_map.paste(fence, (660, 230), fence)

    # Quest items on ground
    camp_map.paste(shoe, (580, 310), shoe)
    camp_map.paste(can, (340, 175), can)

    # 3. Place Characters
    camp_map.paste(chlebak_front, (350, 200), chlebak_front) # Chlebak hanging out near table
    camp_map.paste(klatwa_left, (160, 130), klatwa_left)    # Klątwa by tent
    camp_map.paste(amper_walk, (270, 260), amper_walk)      # Amper (player) walking on boardwalk

    # 4. HUD Overlay
    hud_bar = Image.open(ui_dir / "hud_stamina_bar.png")
    target_pin = Image.open(ui_dir / "target_indicator.png")
    inv_slot = Image.open(ui_dir / "inventory_slot.png")
    inv_slot_sel = Image.open(ui_dir / "inventory_slot_selected.png")
    diag_box = Image.open(ui_dir / "dialogue_box.png")
    portrait_frame = Image.open(ui_dir / "portrait_frame.png")
    amper_portrait = Image.open(portraits_dir / "amper.png").resize((70, 70))

    camp_map.paste(hud_bar, (20, 20), hud_bar)
    camp_map.paste(target_pin, (230, 12), target_pin)

    # Inventory slots on bottom right
    for s_idx in range(4):
        slot_img = inv_slot_sel if s_idx == 0 else inv_slot
        sx = 530 + s_idx * 62
        sy = 410
        camp_map.paste(slot_img, (sx, sy), slot_img)
    # Put phone in first slot
    phone_icon = phone.resize((36, 36))
    camp_map.paste(phone_icon, (540, 420), phone_icon)

    # Dialogue box active on bottom left
    # Scale down dialogue box slightly to fit nicely
    db_scaled = diag_box.resize((480, 115))
    camp_map.paste(db_scaled, (20, 350), db_scaled)
    camp_map.paste(portrait_frame, (32, 370), portrait_frame)
    camp_map.paste(amper_portrait, (37, 375), amper_portrait)

    # Text with Windows Segoe UI font supporting Polish characters
    try:
        font_title = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 15)
        font_body = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 14)
        font_sub = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 12)
    except Exception:
        font_title = font_body = font_sub = None

    d = ImageDraw.Draw(camp_map)
    d.text((42, 353), "AMPER", fill=(255, 215, 40, 255), font=font_title)
    d.text((120, 375), "Ej, gdzie jest nasza flaga? Jeszcze godzinę temu", fill=(245, 245, 245, 255), font=font_body)
    d.text((120, 396), "wisiała na głównym maszcie przy pawilonie!", fill=(245, 245, 245, 255), font=font_body)
    d.text((120, 422), "[E] Kontynuuj rozmowę   [Shift] Bieg", fill=(240, 180, 50, 255), font=font_sub)

    out_camp = maps_dir / "camp_zone_preview.png"
    camp_map.save(out_camp)
    print(f"Saved complete zone preview: {out_camp} ({camp_map.width}x{camp_map.height})")

    # --- MAP 2: NOCNY PASAŻ (800x480) ---
    night_map = Image.new("RGBA", (map_w, map_h), (25, 26, 30, 255))
    for gx in range(0, map_w, ts):
        for gy in range(0, map_h, ts):
            t = asphalt if gy > 180 else concrete
            night_map.paste(t, (gx, gy))

    # Barrier line
    for bx in range(0, map_w, ts):
        night_map.paste(fence, (bx, 140), fence)

    # Gastro stalls along the boulevard
    night_map.paste(gastro, (80, 40), gastro)
    night_map.paste(gastro, (340, 40), gastro)
    night_map.paste(gastro, (600, 40), gastro)

    # Generators & crates
    night_map.paste(generator, (40, 220), generator)
    night_map.paste(cable, (110, 230), cable)

    # Characters in night strip
    night_map.paste(gruczol_front, (210, 210), gruczol_front)
    night_map.paste(amper_front, (420, 230), amper_front)
    night_map.paste(chlebak_front, (480, 220), chlebak_front)

    # Night lights ambience overlay
    night_dark = Image.new("RGBA", (map_w, map_h), (10, 8, 25, 75))
    night_map.alpha_composite(night_dark)

    out_night = maps_dir / "night_strip_preview.png"
    night_map.save(out_night)
    print(f"Saved complete zone preview: {out_night} ({night_map.width}x{night_map.height})")

if __name__ == "__main__":
    generate_map_previews()
