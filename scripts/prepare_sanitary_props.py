from PIL import Image
import os
import shutil

props = {
    'toitoi_blue': r'C:\Users\krucz\.gemini\antigravity\brain\d81ba138-3200-4466-b868-2f212dff67d0\blue_toitoi_prop_1790302041382.jpg',
    'krany': r'C:\Users\krucz\.gemini\antigravity\brain\d81ba138-3200-4466-b868-2f212dff67d0\outdoor_taps_prop_1790302054209.jpg',
    'prysznice': r'C:\Users\krucz\.gemini\antigravity\brain\d81ba138-3200-4466-b868-2f212dff67d0\outdoor_showers_prop_1790302069262.jpg'
}

target_base = r'E:\kodowanie\gra\Hunyuan3D-2GP\input_characters'

for name, img_path in props.items():
    if not os.path.exists(img_path):
        print(f"Error: {img_path} does not exist!")
        continue
    img = Image.open(img_path)
    w, h = img.size
    
    # 4 views
    front = img.crop((0, 0, w//2, h//2))
    back = img.crop((w//2, 0, w, h//2))
    left = img.crop((0, h//2, w//2, h))
    right = img.crop((w//2, h//2, w, h))
    
    out_dir = os.path.join(target_base, name)
    os.makedirs(out_dir, exist_ok=True)
    
    # Also save grid.png
    img.save(os.path.join(out_dir, "grid.png"))
    front.save(os.path.join(out_dir, "front.png"))
    back.save(os.path.join(out_dir, "back.png"))
    left.save(os.path.join(out_dir, "left.png"))
    right.save(os.path.join(out_dir, "right.png"))
    print(f"Successfully prepared views for {name} in {out_dir}")
