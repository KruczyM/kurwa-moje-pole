from PIL import Image
import os

img_path = r'C:\Users\krucz\.gemini\antigravity\brain\d81ba138-3200-4466-b868-2f212dff67d0\grzybek_prop_1790354495873.jpg'
target_dir = r'E:\kodowanie\gra\Hunyuan3D-2GP\input_characters\grzybek'

os.makedirs(target_dir, exist_ok=True)
img = Image.open(img_path)
w, h = img.size

front = img.crop((0, 0, w//2, h//2))
back = img.crop((w//2, 0, w, h//2))
left = img.crop((0, h//2, w//2, h))
right = img.crop((w//2, h//2, w, h))

img.save(os.path.join(target_dir, "grid.png"))
front.save(os.path.join(target_dir, "front.png"))
back.save(os.path.join(target_dir, "back.png"))
left.save(os.path.join(target_dir, "left.png"))
right.save(os.path.join(target_dir, "right.png"))
print("Successfully prepared grzybek input views.")
