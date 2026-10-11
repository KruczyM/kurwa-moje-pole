import json
from pathlib import Path
from PIL import Image

CHARACTERS = [
    "amper", "antena", "gruczol", "klatwa", "krwiak", "pien", "pierscien", "zawor",
    "ambona", "chlebak", "dziaslo", "hemoroid", "jeczmien", "kobra", "korba", "szerszen"
]

SPRITE_CHARACTERS = CHARACTERS

def pack_sprites():
    chars_dir = Path("public/game-assets/2d/after/characters")
    frame_size = 64
    directions = ["down", "right", "up", "left"]
    cols = 4
    rows = 4

    for char_id in SPRITE_CHARACTERS:
        raw_dir = chars_dir / char_id / "raw"
        if not raw_dir.is_dir():
            print(f"Skipping {char_id}: raw directory not found")
            continue

        sheet = Image.new("RGBA", (cols * frame_size, rows * frame_size), (0, 0, 0, 0))

        for row_idx, dir_name in enumerate(directions):
            for col_idx in range(cols):
                f_path = raw_dir / f"{dir_name}_{col_idx}.png"
                if f_path.is_file():
                    with Image.open(f_path) as frame:
                        sheet.paste(frame, (col_idx * frame_size, row_idx * frame_size))

        out_sheet = chars_dir / char_id / "spritesheet.png"
        sheet.save(out_sheet)
        print(f"Packed spritesheet: {out_sheet} ({sheet.width}x{sheet.height})")

        meta = {
            "character": char_id,
            "frameWidth": frame_size,
            "frameHeight": frame_size,
            "directions": directions,
            "framesPerDirection": cols,
            "rows": {
                "down": 0,
                "right": 1,
                "up": 2,
                "left": 3
            },
            "animationColumns": {
                "idle": [0],
                "walk": [0, 1, 2, 3]
            }
        }
        meta_path = chars_dir / char_id / "meta.json"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)
        print(f"Saved meta: {meta_path}")

if __name__ == "__main__":
    pack_sprites()
