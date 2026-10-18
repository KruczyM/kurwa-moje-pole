import os
from pathlib import Path
from PIL import Image
from rembg import remove, new_session

input_dir = Path(r"E:\kodowanie\gra\Hunyuan3D-2GP\input_characters")
source_dir = Path(r"C:\Users\krucz\.gemini\antigravity\brain\db446ea5-e215-41f7-b0aa-58cec4df7861")

props = {
    "main_stage": "main_stage_prop_1790214151436.jpg",
    "small_stage": "small_stage_prop_1790214160170.jpg",
    "asp_tent": "asp_tent_prop_1790214168377.jpg"
}

session = new_session('isnet-general-use')

for name, filename in props.items():
    print(f"Processing {name}...")
    img_path = source_dir / filename
    if not img_path.exists():
        continue
        
    block = Image.open(img_path)
    block = block.resize((1024, 1024), Image.Resampling.LANCZOS)
    
    folder = input_dir / name
    folder.mkdir(exist_ok=True)
    
    for f in folder.glob("*"):
        if f.is_file(): f.unlink()
        
    block.save(folder / "grid.png")
    
    w, h = 1024, 1024
    views = {
        'front': (0, 0, w//2, h//2),
        'right': (w//2, 0, w, h//2),
        'back': (0, h//2, w//2, h),
        'left': (w//2, h//2, w, h)
    }
    
    for view_name, box in views.items():
        crop = block.crop(box)
        out = remove(crop, session=session, bgcolor=[255, 255, 255, 0], alpha_matting=False)
        out.save(folder / f"{view_name}.png")

print("Done processing props!")
