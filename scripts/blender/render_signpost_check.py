import bpy, math
from pathlib import Path

# Clear
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)

# Import GLB
glb_path = "public/game-assets/world/festival/festival_signpost.glb"
bpy.ops.import_scene.gltf(filepath=glb_path)

# Camera looking at signpost
cam_data = bpy.data.cameras.new("RenderCam")
cam_obj = bpy.data.objects.new("RenderCam", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

cam_obj.location = (2.2, -2.6, 2.8)
cam_obj.rotation_euler = (math.radians(72), 0, math.radians(40))

# Sun
light_data = bpy.data.lights.new(name="Sun", type='SUN')
light_data.energy = 4.0
light_obj = bpy.data.objects.new(name="Sun", object_data=light_data)
light_obj.rotation_euler = (math.radians(50), math.radians(20), math.radians(30))
bpy.context.collection.objects.link(light_obj)

# Fill light
fill_data = bpy.data.lights.new(name="Fill", type='SUN')
fill_data.energy = 2.0
fill_obj = bpy.data.objects.new(name="Fill", object_data=fill_data)
fill_obj.rotation_euler = (math.radians(-40), math.radians(-30), math.radians(120))
bpy.context.collection.objects.link(fill_obj)

scene = bpy.context.scene
scene.render.resolution_x = 960
scene.render.resolution_y = 720
out_img = "C:/Users/krucz/.gemini/antigravity/brain/d81ba138-3200-4466-b868-2f212dff67d0/signpost_fixed_render1.png"
scene.render.filepath = out_img
bpy.ops.render.render(write_still=True)
print(f"Rendered angle 1: {out_img}")

# Reverse angle to see other side
cam_obj.location = (-2.2, 2.6, 2.8)
cam_obj.rotation_euler = (math.radians(72), 0, math.radians(-140))
out_img2 = "C:/Users/krucz/.gemini/antigravity/brain/d81ba138-3200-4466-b868-2f212dff67d0/signpost_fixed_render2.png"
scene.render.filepath = out_img2
bpy.ops.render.render(write_still=True)
print(f"Rendered angle 2: {out_img2}")
