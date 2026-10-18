"""
Renders a showcase preview of newly generated festival sanitary models:
- Grzybek Wodny (Iconic Water Mushroom)
- TOI TOI Blue Single Cabin
- TOI TOI Row (Battery of 6 cabins)
- Krany Festiwalowe (20-Tap Stainless Wash Station)
"""
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
out_path = Path("C:/Users/krucz/.gemini/antigravity/brain/d81ba138-3200-4466-b868-2f212dff67d0/festival_sanitary_showcase.png")

# Lighting
scene = bpy.context.scene
col = scene.collection

sun_data = bpy.data.lights.new(name="Sun", type='SUN')
sun_data.energy = 4.0
sun_obj = bpy.data.objects.new(name="Sun", object_data=sun_data)
sun_obj.rotation_euler = (math.radians(50), math.radians(20), math.radians(35))
col.objects.link(sun_obj)

fill_data = bpy.data.lights.new(name="Fill", type='SUN')
fill_data.energy = 2.2
fill_obj = bpy.data.objects.new(name="Fill", object_data=fill_data)
fill_obj.rotation_euler = (math.radians(-40), math.radians(-30), math.radians(130))
col.objects.link(fill_obj)

# Ground Plane (turf + dirt)
bpy.ops.mesh.primitive_plane_add(size=70, location=(0, 0, 0))
ground = bpy.context.active_object
mat_ground = bpy.data.materials.new("Mat_Ground")
mat_ground.use_nodes = True
bsdf = mat_ground.node_tree.nodes.get("Principled BSDF")
if bsdf:
    bsdf.inputs['Base Color'].default_value = (0.22, 0.32, 0.16, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.85
ground.data.materials.append(mat_ground)

# Models layout
items = [
    ('grzybek.glb', -10.5, 0.0, 0.0),
    ('toitoi_blue.glb', -5.5, -0.5, math.radians(-12)),
    ('toitoi_row.glb', 0.2, -0.2, math.radians(5)),
    ('krany_festiwalowe.glb', 8.5, 0.0, math.radians(-8)),
]

for filename, px, py, rz in items:
    p = world_dir / filename
    if not p.exists():
        continue
    bpy.ops.import_scene.gltf(filepath=str(p))
    imported = list(bpy.context.selected_objects)
    grp = bpy.data.objects.new("Grp_" + filename, None)
    col.objects.link(grp)
    grp.location = (px, py, 0)
    grp.rotation_euler[2] = rz
    for o in imported:
        if o.parent is None:
            o.parent = grp

# Camera
cam_data = bpy.data.cameras.new("Cam")
cam_data.lens = 38 # Wider angle to frame all 4 models cleanly
cam_obj = bpy.data.objects.new("Cam", cam_data)
col.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

cam_obj.location = (0.0, -29.0, 9.5)
target = Vector((0.0, 0.0, 2.2))
rot_quat = (target - cam_obj.location).to_track_quat('-Z', 'Y')
cam_obj.rotation_euler = rot_quat.to_euler()

scene.render.resolution_x = 1920
scene.render.resolution_y = 800
scene.render.filepath = str(out_path)
bpy.ops.render.render(write_still=True)
print(f"Rendered: {out_path}")
