import bpy
import math
from pathlib import Path

# Clear
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)

repo_root = Path(__file__).resolve().parents[2]
glb_path = repo_root / 'public' / 'game-assets' / 'world' / 'festival' / 'small_stage.glb'
bpy.ops.import_scene.gltf(filepath=str(glb_path))

scene = bpy.context.scene
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.film_transparent = True

# Sun light
light_data = bpy.data.lights.new(name="Sun", type='SUN')
light_data.energy = 4.0
light_obj = bpy.data.objects.new(name="Sun", object_data=light_data)
light_obj.rotation_euler = (math.radians(45), math.radians(20), math.radians(-40))
scene.collection.objects.link(light_obj)

cam_data = bpy.data.cameras.new("Camera")
cam_obj = bpy.data.objects.new("Camera", object_data=cam_data)
scene.collection.objects.link(cam_obj)
scene.camera = cam_obj

target_obj = bpy.data.objects.new("Target", None)
scene.collection.objects.link(target_obj)

track = cam_obj.constraints.new(type='TRACK_TO')
track.target = target_obj
track.track_axis = 'TRACK_NEGATIVE_Z'
track.up_axis = 'UP_Y'

def render_view(cam_pos, target_pos, out_path):
    cam_obj.location = cam_pos
    target_obj.location = target_pos
    bpy.context.view_layer.update()
    scene.render.filepath = str(out_path)
    bpy.ops.render.render(write_still=True)
    print(f"Rendered to {out_path}")

out_dir = Path("C:/Users/krucz/.gemini/antigravity/brain/d81ba138-3200-4466-b868-2f212dff67d0")

# 1. Totem detail
render_view((-14.0, -15.0, 4.0), (-8.6, -7.5, 3.5), out_dir / "asp_totem_detail_render.png")

# 2. Exterior rear wall from outside
render_view((0.0, 42.0, 5.0), (0.0, 32.0, 5.0), out_dir / "asp_exterior_rear_render.png")

# 3. Aerial length
render_view((-32.0, 10.0, 24.0), (0.0, 13.0, 4.0), out_dir / "asp_aerial_length_render.png")
