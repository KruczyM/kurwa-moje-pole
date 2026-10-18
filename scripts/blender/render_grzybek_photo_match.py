import bpy
import math
from pathlib import Path
from mathutils import Vector

def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for col in list(bpy.data.collections):
        bpy.data.collections.remove(col, do_unlink=True)

clear_scene()

root = Path(__file__).resolve().parents[2]
world_dir = root / 'public' / 'game-assets' / 'world' / 'festival'
out_dir = Path("C:/Users/krucz/.gemini/antigravity/brain/0f469478-5ced-4cb0-85a6-506fc5188eb0")
out_dir.mkdir(parents=True, exist_ok=True)

# Sun lighting
sun_data = bpy.data.lights.new(name="Sun", type='SUN')
sun_data.energy = 4.0
sun_obj = bpy.data.objects.new(name="Sun", object_data=sun_data)
sun_obj.rotation_euler = (math.radians(52), math.radians(25), math.radians(35))
bpy.context.scene.collection.objects.link(sun_obj)

fill_data = bpy.data.lights.new(name="Fill", type='SUN')
fill_data.energy = 2.5
fill_obj = bpy.data.objects.new(name="Fill", object_data=fill_data)
fill_obj.rotation_euler = (math.radians(-35), math.radians(-20), math.radians(140))
bpy.context.scene.collection.objects.link(fill_obj)

# Ground Plane
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
ground = bpy.context.active_object
ground.name = "Ground"
mat_ground = bpy.data.materials.new("Mat_Ground")
mat_ground.use_nodes = True
bsdf = mat_ground.node_tree.nodes.get("Principled BSDF")
if bsdf:
    bsdf.inputs['Base Color'].default_value = (0.55, 0.48, 0.35, 1.0) # Dusty festival ground
    bsdf.inputs['Roughness'].default_value = 0.95
ground.data.materials.append(mat_ground)

# Load Grzybek GLB
bpy.ops.import_scene.gltf(filepath=str(world_dir / 'grzybek.glb'))

# Camera
cam_data = bpy.data.cameras.new("RenderCam")
cam_obj = bpy.data.objects.new("RenderCam", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

cam_obj.location = (0.0, -9.5, 3.2)
target = Vector((0.0, 0.0, 2.5))
rot_quat = (target - cam_obj.location).to_track_quat('-Z', 'Y')
cam_obj.rotation_euler = rot_quat.to_euler()

scene = bpy.context.scene
scene.render.resolution_x = 1024
scene.render.resolution_y = 640
scene.render.filepath = str(out_dir / "grzybek_photo_match_preview.png")
bpy.ops.render.render(write_still=True)
print("Rendered:", scene.render.filepath)
