import os
from PIL import Image

def make_collage(img_folder, output_path):
    images = []
    files = [
        '008_grunge_flannel_rocker.png', '015_feather_headband_hippie.png', 
        '050_blue_alien_girl.png', '052_muddy_sneakers_rocker.png', 
        '070_vintage_denim_shorts.png', '072_rave_bucket_hat.png', 
        '078_girl_with_guitar.png', '087_neon_raver.png', '089_peace_hippie.png'
    ]
    for filename in files:
        img_path = os.path.join(img_folder, filename)
        if os.path.exists(img_path):
            img = Image.open(img_path)
            images.append(img)
            
    if not images:
        return
        
    w, h = images[0].size
    grid_w = 3
    grid_h = 3
    
    collage = Image.new('RGB', (w * grid_w, h * grid_h), color='white')
    
    for i, img in enumerate(images):
        x = (i % grid_w) * w
        y = (i // grid_w) * h
        collage.paste(img, (x, y))
        
    collage.save(output_path)
    
if __name__ == '__main__':
    make_collage(r'C:\Users\krucz\.gemini\antigravity\brain\d81ba138-3200-4466-b868-2f212dff67d0\screenshots_3d', r'C:\Users\krucz\.gemini\antigravity\brain\d81ba138-3200-4466-b868-2f212dff67d0\3d_collage.png')

