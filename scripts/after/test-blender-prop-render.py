import bpy
import sys
import math
from pathlib import Path

# Clear default scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Import GLB
glb_path = Path("public/game-assets/world/toitoi_blue.glb").resolve()
bpy.ops.import_scene.gltf(filepath=str(glb_path))

# Setup camera
cam_data = bpy.data.cameras.new("TopDownCam")
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 3.2

cam_obj = bpy.data.objects.new("TopDownCam", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

# Position camera with 50-degree top-down pitch
pitch = math.radians(52)
yaw = math.radians(25)
cam_dist = 6.0

cam_obj.location = (
    cam_dist * math.sin(yaw) * math.cos(pitch),
    -cam_dist * math.cos(yaw) * math.cos(pitch),
    cam_dist * math.sin(pitch) + 1.2
)
cam_obj.rotation_euler = (math.radians(52), 0, math.radians(25))

# Setup sun light
light_data = bpy.data.lights.new("Sun", type='SUN')
light_data.energy = 3.5
light_obj = bpy.data.objects.new("Sun", light_data)
bpy.context.collection.objects.link(light_obj)
light_obj.rotation_euler = (math.radians(45), math.radians(30), math.radians(60))

# Ambient fill light
fill_data = bpy.data.lights.new("Fill", type='SUN')
fill_data.energy = 1.2
fill_obj = bpy.data.objects.new("Fill", fill_data)
bpy.context.collection.objects.link(fill_obj)
fill_obj.rotation_euler = (math.radians(-30), math.radians(-40), math.radians(120))

# Render settings
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') and 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
scene.render.film_transparent = True
scene.render.resolution_x = 128
scene.render.resolution_y = 128
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'

out_path = Path("public/game-assets/2d/after/props/toitoi.png").resolve()
scene.render.filepath = str(out_path)

bpy.ops.render.render(write_still=True)
print("Rendered toitoi to", out_path)
