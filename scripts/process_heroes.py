from PIL import Image
import os
import shutil

source_dir = r"E:\kodowanie\gra\Hunyuan3D-2GP\output\characters_mv"
target_dir = r"E:\kodowanie\gra\Hunyuan3D-2GP\input_characters"

# Mapping Polish characters to ASCII for folder names
charmap = {
    'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
    'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z'
}

def clean_name(name):
    for k, v in charmap.items():
        name = name.replace(k, v)
    return name

files = [f for f in os.listdir(source_dir) if f.endswith('.png')]

for file in files:
    name_pl = file[:-4]
    name_en = clean_name(name_pl)
    
    img_path = os.path.join(source_dir, file)
    img = Image.open(img_path)
    w, h = img.size
    
    # Crop into 4 views
    front = img.crop((0, 0, w//2, h//2))
    back = img.crop((w//2, 0, w, h//2))
    left = img.crop((0, h//2, w//2, h))
    right = img.crop((w//2, h//2, w, h))
    
    out_folder = os.path.join(target_dir, name_en)
    os.makedirs(out_folder, exist_ok=True)
    
    front.save(os.path.join(out_folder, "front.png"))
    back.save(os.path.join(out_folder, "back.png"))
    left.save(os.path.join(out_folder, "left.png"))
    right.save(os.path.join(out_folder, "right.png"))
    print(f"Processed {name_en}")

