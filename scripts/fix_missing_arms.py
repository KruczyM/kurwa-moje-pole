import os
from pathlib import Path
from PIL import Image
from rembg import remove, new_session
import glob
import shutil

bad_ids = [8, 15, 50, 52, 70, 72, 78, 87, 89]
input_dir = Path(r"E:\kodowanie\gra\Hunyuan3D-2GP\input_characters")
output_dir = Path(r"E:\kodowanie\gra\Hunyuan3D-2GP\output\characters_mv")
game_assets_dir = Path(r"E:\kodowanie\gra\public\game-assets\npc_models")

session = new_session('isnet-general-use')

for folder in input_dir.iterdir():
    if not folder.is_dir():
        continue
    
    try:
        num = int(folder.name.split('_')[0])
    except ValueError:
        continue
        
    if num in bad_ids:
        print(f"Processing {folder.name}...")
        
        # Find original 2x2 grid image
        all_files = list(folder.glob('*.*'))
        original_img = None
        for f in all_files:
            if f.name not in ['front.png', 'back.png', 'left.png', 'right.png'] and f.suffix.lower() in ['.jpg', '.jpeg', '.png']:
                original_img = f
                break
                
        if not original_img:
            print(f"  Could not find original 2x2 grid in {folder.name}")
            continue
            
        print(f"  Found original: {original_img.name}")
        
        # Split original
        grid = Image.open(original_img)
        w, h = grid.size
        
        views = {
            'front': (0, 0, w//2, h//2),
            'right': (w//2, 0, w, h//2),
            'back': (0, h//2, w//2, h),
            'left': (w//2, h//2, w, h)
        }
        
        for name, box in views.items():
            crop = grid.crop(box)
            # CRITICAL: alpha_matting=False to prevent erasing bright colors (hands/arms/white wings)
            out = remove(crop, session=session, bgcolor=[255, 255, 255, 0], alpha_matting=False)
            
            out_path = folder / f"{name}.png"
            out.save(out_path)
            print(f"  Saved {name}.png")
            
        # Delete output directory to force hunyuan_batch to regenerate this model
        out_model_dir = output_dir / folder.name
        if out_model_dir.exists():
            shutil.rmtree(out_model_dir)
            print(f"  Deleted old 3D model cache: {out_model_dir}")

