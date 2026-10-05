import os
import glob
import shutil
from pathlib import Path
from PIL import Image
from rembg import remove, new_session

targets = {
    "grunge_flannel_rocker": "008_grunge_flannel_rocker",
    "feather_headband_hippie": "015_feather_headband_hippie",
    "blue_alien_girl": "050_blue_alien_girl",
    "muddy_sneakers_rocker": "052_muddy_sneakers_rocker",
    "vintage_denim_shorts": "070_vintage_denim_shorts",
    "rave_bucket_hat": "072_rave_bucket_hat",
    "girl_with_guitar": "078_girl_with_guitar",
    "neon_raver": "087_neon_raver",
    "peace_hippie": "089_peace_hippie"
}

brain_dir = Path(r"C:\Users\krucz\.gemini\antigravity\brain")
input_dir = Path(r"E:\kodowanie\gra\Hunyuan3D-2GP\input_characters")
output_dir = Path(r"E:\kodowanie\gra\Hunyuan3D-2GP\output\characters_mv")

session = new_session('isnet-general-use')

for name, folder_name in targets.items():
    search_pattern = f"**/{name}_*.jpg"
    files = list(brain_dir.rglob(search_pattern))
    if not files:
        print(f"Skipping {name}, no image found.")
        continue
        
    new_img_path = sorted(files, key=lambda p: p.stat().st_mtime)[-1]
    print(f"Processing {name} using {new_img_path.name}")
    
    target_folder = input_dir / folder_name
    
    for f in target_folder.glob("*"):
        if f.is_file():
            f.unlink()
            
    shutil.copy2(new_img_path, target_folder / f"{name}_new.jpg")
    
    grid = Image.open(new_img_path)
    w, h = grid.size
    
    views = {
        'front': (0, 0, w//2, h//2),
        'right': (w//2, 0, w, h//2),
        'back': (0, h//2, w//2, h),
        'left': (w//2, h//2, w, h)
    }
    
    for view_name, box in views.items():
        crop = grid.crop(box)
        out = remove(crop, session=session, bgcolor=[255, 255, 255, 0], alpha_matting=False)
        out.save(target_folder / f"{view_name}.png")
        
    print(f"  Saved 4 views for {folder_name}")
    
    out_model_dir = output_dir / folder_name
    if out_model_dir.exists():
        shutil.rmtree(out_model_dir)
        print(f"  Deleted old 3D model cache")

