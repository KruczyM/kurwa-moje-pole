"""
Renders preview screenshots of the festival world layout with all newly placed models.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector

def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

clear_scene()

root = Path(__file__).resolve().parents[2]
world_dir = root / 'public' / 'game-assets' / 'world' / 'festival'
out_dir = Path("C:/Users/krucz/.gemini/antigravity/brain/d81ba138-3200-4466-b868-2f212dff67d0")

# Setup lighting
sun_data = bpy.data.lights.new(name="Sun", type='SUN')
sun_data.energy = 3.5
sun_obj = bpy.data.objects.new(name="Sun", object_data=sun_data)
sun_obj.rotation_euler = (math.radians(50), math.radians(20), math.radians(35))
bpy.context.scene.collection.objects.link(sun_obj)

fill_data = bpy.data.lights.new(name="Fill", type='SUN')
fill_data.energy = 1.8
fill_obj = bpy.data.objects.new(name="Fill", object_data=fill_data)
fill_obj.rotation_euler = (math.radians(-40), math.radians(-30), math.radians(130))
bpy.context.scene.collection.objects.link(fill_obj)

# Create ground plane (green turf)
bpy.ops.mesh.primitive_plane_add(size=500, location=(20, -25, -0.05))
ground = bpy.context.active_object
ground.name = "Festival_Meadow"
mat_ground = bpy.data.materials.new("Mat_Meadow")
mat_ground.use_nodes = True
bsdf = mat_ground.node_tree.nodes.get("Principled BSDF")
if bsdf:
    bsdf.inputs['Base Color'].default_value = (0.18, 0.38, 0.12, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.85
ground.data.materials.append(mat_ground)

# Models to place with positions and rotations (x, z, rotY)
# Note: Blender import with Y-up converts glTF (x, y, z) where Y is up.
# Three.js (x, y, z) maps to Blender (x, -z, y).
placements = [
    # Stages
    ('main_stage.glb', 116, 18, -math.pi / 2, 'Main_Stage'),
    ('small_stage.glb', 52, 116, math.pi, 'ASP_Tent'),
    # Props & Landmarks
    ('festival_gate.glb', 0, -68, 0, 'Festival_Gate'),
    ('festival_signpost.glb', 14, -25, -0.4, 'Signpost_Camp'),
    ('festival_signpost.glb', 48, 28, 0.8, 'Signpost_Stages'),
    ('foh_tower.glb', 72, 18, -math.pi / 2, 'FOH_Tower'),
    ('delay_tower.glb', 54, -4, -math.pi / 2, 'Delay_Tower_L'),
    ('delay_tower.glb', 54, 40, -math.pi / 2, 'Delay_Tower_R'),
    ('mud_bath.glb', 64, -12, 0.1, 'Mud_Bath'),
    ('fire_truck_osp.glb', 64, -19, 0, 'Fire_Truck_OSP'),
    ('water_curtain.glb', 32, 10, 0, 'Water_Curtain'),
    ('patrol_tent.glb', -24, -25, 0, 'Patrol_Tent'),
    ('krishna_village.glb', -88, 28, math.pi / 2, 'Krishna_Village'),
    ('trash_corral.glb', -12, -26, 0, 'Trash_Corral_Market'),
    ('trash_corral.glb', 44, 4, -math.pi / 2, 'Trash_Corral_Stage'),
]

for filename, px, pz, rot_y, label in placements:
    glb_path = world_dir / filename
    if not glb_path.exists():
        print(f"Skipping missing: {glb_path}")
        continue
    # Import
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(glb_path))
    new_objs = set(bpy.context.scene.objects) - before
    roots = [o for o in new_objs if o.parent is None]
    if roots:
        parent = bpy.data.objects.new(label, None)
        bpy.context.scene.collection.objects.link(parent)
        for r in roots:
            r.parent = parent
        bx = px
        by = -pz
        bz = 0.0
        parent.location = (bx, by, bz)
        parent.rotation_euler[2] += rot_y

# Camera
cam_data = bpy.data.cameras.new("RenderCam")
cam_obj = bpy.data.objects.new("RenderCam", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

scene = bpy.context.scene
scene.render.resolution_x = 1200
scene.render.resolution_y = 750

# View 1: Duża Scena concert field with FOH, Delay Towers, Mud Bath & OSP Fire Truck
cam_obj.location = (25.0, -18.0, 16.0)
target = Vector((116.0, -18.0, 12.0))
rot_quat = (target - cam_obj.location).to_track_quat('-Z', 'Y')
cam_obj.rotation_euler = rot_quat.to_euler()
out1 = str(out_dir / "world_main_stage_field_preview.png")
scene.render.filepath = out1
bpy.ops.render.render(write_still=True)
print(f"Rendered: {out1}")

# View 2: Scena ASP Monumental Circus Tent & Avenue
cam_obj.location = (52.0, -35.0, 30.0)
target = Vector((52.0, -116.0, 15.0))
rot_quat = (target - cam_obj.location).to_track_quat('-Z', 'Y')
cam_obj.rotation_euler = rot_quat.to_euler()
out2 = str(out_dir / "world_camp_crossroads_preview.png")
scene.render.filepath = out2
bpy.ops.render.render(write_still=True)
print(f"Rendered: {out2}")

# View 3: Complete Bird's-eye aerial panorama of all festival grounds
cam_obj.location = (-130.0, 110.0, 160.0)
target = Vector((40.0, -30.0, 10.0))
rot_quat = (target - cam_obj.location).to_track_quat('-Z', 'Y')
cam_obj.rotation_euler = rot_quat.to_euler()
out3 = str(out_dir / "world_isometric_overview.png")
scene.render.filepath = out3
bpy.ops.render.render(write_still=True)
print(f"Rendered: {out3}")
