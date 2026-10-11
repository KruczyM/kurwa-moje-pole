import os
from pathlib import Path
from PIL import Image
from rembg import remove

ROOT_DIR = Path(".").resolve()
INPUT_CHARS_DIR = ROOT_DIR / "Hunyuan3D-2GP/input_characters"
PORTRAITS_DIR = ROOT_DIR / "public/game-assets/2d/after/portraits"
PORTRAITS_DIR.mkdir(parents=True, exist_ok=True)

# 10 characters that have source front.png photos in input_characters
AVAILABLE_CHARS = [
    "ambona", "chlebak", "dziaslo", "hemoroid", "jeczmien",
    "klatwa", "kobra", "korba", "szerszen", "zawor"
]

def make_source_portrait(char_id):
    front_path = INPUT_CHARS_DIR / char_id / "front.png"
    if not front_path.is_file():
        print(f"Skipping {char_id}: front.png not found")
        return None

    print(f"Processing source portrait for: {char_id}...")
    with Image.open(front_path) as raw_img:
        # Convert to RGB if needed before rembg
        rgb_img = raw_img.convert("RGB")
        # Remove background using rembg
        no_bg = remove(rgb_img)

    # Find bounding box of non-transparent pixels
    bbox = no_bg.getbbox()
    if not bbox:
        print(f"Failed to find bbox for {char_id}")
        return None

    char_cropped = no_bg.crop(bbox)
    w, h = char_cropped.size

    # Isolate head region in top 28% of height to find head center and width
    head_sample_h = int(h * 0.28)
    head_sample = char_cropped.crop((0, 0, w, head_sample_h))
    head_sample_bbox = head_sample.getbbox()

    if head_sample_bbox:
        head_cx = (head_sample_bbox[0] + head_sample_bbox[2]) // 2
        head_w = head_sample_bbox[2] - head_sample_bbox[0]
        # Frame bust to 1.5x head width, height down to 36% of character
        bust_half_w = int(head_w * 0.8)
        bust_box = (
            max(0, head_cx - bust_half_w),
            head_sample_bbox[1],
            min(w, head_cx + bust_half_w),
            min(h, int(h * 0.36))
        )
        bust = char_cropped.crop(bust_box)
    else:
        bust = char_cropped.crop((int(w * 0.3), 0, int(w * 0.7), int(h * 0.38)))

    # Trim any empty transparent margins around bust
    bust_bbox = bust.getbbox()
    if bust_bbox:
        bust = bust.crop(bust_bbox)

    bw, bh = bust.size

    # Scale to fill ~235px of the 256x256 canvas
    target_dim = 236
    scale = target_dim / max(bw, bh)
    new_w = int(bw * scale)
    new_h = int(bh * scale)

    bust_resized = bust.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # Composite onto 256x256 transparent canvas
    out_img = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    paste_x = (256 - new_w) // 2
    paste_y = (256 - new_h) // 2 + 6  # slight downward grounding

    out_img.paste(bust_resized, (paste_x, paste_y), bust_resized)

    out_file = PORTRAITS_DIR / f"{char_id}.png"
    out_img.save(out_file, "PNG")
    print(f"Successfully saved {char_id} portrait -> {out_file}")
    return out_file

def main():
    print("=== Generating 2D Source Portraits from Base Photos ===")
    processed = []
    for char_id in AVAILABLE_CHARS:
        res = make_source_portrait(char_id)
        if res:
            processed.append(char_id)

    print(f"\nDone! Processed {len(processed)} portraits: {processed}")

if __name__ == "__main__":
    main()
