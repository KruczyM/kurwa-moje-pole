import os
from PIL import Image
import glob

folders = [
    '008_grunge_flannel_rocker', '015_feather_headband_hippie',
    '050_blue_alien_girl', '052_muddy_sneakers_rocker',
    '070_vintage_denim_shorts', '072_rave_bucket_hat',
    '078_girl_with_guitar', '087_neon_raver', '089_peace_hippie'
]

base_dir = r"E:\kodowanie\gra\Hunyuan3D-2GP\input_characters"
images = []

for f in folders:
    path = os.path.join(base_dir, f)
    # find the original grid
    files = [p for p in os.listdir(path) if p not in ['front.png', 'back.png', 'left.png', 'right.png']]
    if files:
        img_path = os.path.join(path, files[0])
        img = Image.open(img_path)
        # resize to 512x512 so collage isn't too huge
        img = img.resize((512, 512))
        images.append(img)
    else:
        # append a blank image if missing
        images.append(Image.new('RGB', (512, 512), color='red'))

w, h = 512, 512
grid_w = 3
grid_h = 3

collage = Image.new('RGB', (w * grid_w, h * grid_h), color='white')

for i, img in enumerate(images):
    x = (i % grid_w) * w
    y = (i // grid_w) * h
    collage.paste(img, (x, y))

out_path = r"C:\Users\krucz\.gemini\antigravity\brain\d81ba138-3200-4466-b868-2f212dff67d0\original_grids_collage.png"
collage.save(out_path)
print("Saved", out_path)

