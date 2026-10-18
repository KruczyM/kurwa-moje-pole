"""
Render festival preview images showing the updated 2026 festival layout:
1. Southern concrete lane moved to Z: 68..78 (further south).
2. All tents removed from behind the southern lane (Z > 78).
3. Scena ASP centered on the southern lane at (0, 97), entrance facing East (+X, opposite to Duża Scena).
4. Walkable / open portal interior for Scena ASP.
5. Duża Scena scaled 2x at (116, 18).
6. Grzybek relocated in front of left side of Duża Scena at (66, -18).
7. Grzybek model is an authentic festival shower pole (mast with nozzles).
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
tents_dir = root / 'public' / 'game-assets' / 'world'
out_dir = Path("C:/Users/krucz/.gemini/antigravity/brain/0f469478-5ced-4cb0-85a6-506fc5188eb0")
out_dir.mkdir(parents=True, exist_ok=True)

# Sun & Fill lighting
sun_data = bpy.data.lights.new(name="Sun", type='SUN')
sun_data.energy = 4.0
sun_obj = bpy.data.objects.new(name="Sun", object_data=sun_data)
sun_obj.rotation_euler = (math.radians(52), math.radians(25), math.radians(35))
bpy.context.scene.collection.objects.link(sun_obj)

fill_data = bpy.data.lights.new(name="Fill", type='SUN')
fill_data.energy = 2.0
fill_obj = bpy.data.objects.new(name="Fill", object_data=fill_data)
fill_obj.rotation_euler = (math.radians(-35), math.radians(-20), math.radians(140))
bpy.context.scene.collection.objects.link(fill_obj)

# Meadow
bpy.ops.mesh.primitive_plane_add(size=340, location=(0, 0, -0.05))
ground = bpy.context.active_object
ground.name = "Meadow"
mat_ground = bpy.data.materials.new("Mat_Meadow")
mat_ground.use_nodes = True
bsdf = mat_ground.node_tree.nodes.get("Principled BSDF")
if bsdf:
    bsdf.inputs['Base Color'].default_value = (0.24, 0.44, 0.18, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.9
ground.data.materials.append(mat_ground)

# Concrete material for the two avenues
concrete_mat = bpy.data.materials.new("Mat_Concrete_Road")
concrete_mat.use_nodes = True
c_bsdf = concrete_mat.node_tree.nodes.get("Principled BSDF")
c_tex_path = root / 'public/game-assets/textures/concrete/Concrete019_1K-JPG_Color.jpg'
if c_tex_path.exists():
    img = bpy.data.images.load(str(c_tex_path))
    tex_node = concrete_mat.node_tree.nodes.new('ShaderNodeTexImage')
    tex_node.image = img
    concrete_mat.node_tree.links.new(tex_node.outputs['Color'], c_bsdf.inputs['Base Color'])
else:
    c_bsdf.inputs['Base Color'].default_value = (0.58, 0.58, 0.60, 1.0)
c_bsdf.inputs['Roughness'].default_value = 0.85

def make_concrete_road(name, minX, maxX, minZ, maxZ):
    w = maxX - minX
    d = maxZ - minZ
    cx = (minX + maxX) / 2
    cy = -(minZ + maxZ) / 2
    bpy.ops.mesh.primitive_plane_add(size=1, location=(cx, cy, 0.02))
    plane = bpy.context.active_object
    plane.name = name
    plane.scale = (w, d, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    plane.data.materials.append(concrete_mat)

# 1. North concrete lane (Z: [-40, -30])
make_concrete_road("North_Concrete_Lane", -140, 140, -40, -30)

# 2. South parallel concrete lane (Z: [68, 78])
make_concrete_road("South_Concrete_Lane", -140, 140, 68, 78)

# Camp boundary indicator
camp_mat = bpy.data.materials.new("Mat_Camp")
camp_mat.use_nodes = True
camp_bsdf = camp_mat.node_tree.nodes.get("Principled BSDF")
camp_bsdf.inputs['Base Color'].default_value = (0.32, 0.28, 0.20, 1.0)
camp_bsdf.inputs['Roughness'].default_value = 0.95
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0.01))
camp_plane = bpy.context.active_object
camp_plane.name = "Camp_Kurwa_Moje_Pole"
camp_plane.scale = (36, 36, 1)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
camp_plane.data.materials.append(camp_mat)

def load_glb(filepath, px, pz, rot_y, label, scale_mult=1.0):
    if not filepath.exists():
        print(f"Skipping missing: {filepath}")
        return None
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(filepath))
    new_objs = set(bpy.context.scene.objects) - before
    roots = [o for o in new_objs if o.parent is None]
    if roots:
        parent = bpy.data.objects.new(label, None)
        bpy.context.scene.collection.objects.link(parent)
        for r in roots:
            r.parent = parent
        parent.location = (px, -pz, 0.0)
        parent.rotation_euler[2] += rot_y
        if scale_mult != 1.0:
            parent.scale = (scale_mult, scale_mult, scale_mult)
        return parent
    return None

# Stages & Landmarks
# 1. Duża Scena 2x (scaled uniformly ~2x)
load_glb(world_dir / 'main_stage.glb', 116, 18, -math.pi / 2, 'Main_Stage_2x', scale_mult=2.0)

# 2. Scena ASP in middle of south avenue at (0, 97) facing East (+X, rotY = pi/2)
load_glb(world_dir / 'small_stage.glb', 0, 97, math.pi / 2, 'Scena_ASP')

# 3. Grzybek in front of left side of Duża Scena at (66, -18)
load_glb(world_dir / 'grzybek.glb', 66, -18, 0, 'Grzybek_Shower_Mast')

# 4. Lidl Rock Shop on south avenue at (-70, 88)
load_glb(world_dir / 'lidlRockShop.glb', -70, 88, math.pi, 'Lidl_Rock_Shop')

# 5. Market Stalls & Allegro Wheel
load_glb(world_dir / 'marketStalls.glb', 0, -42, 0, 'Market_Stalls')
load_glb(world_dir / 'allegroWheel.glb', 92, -55, 0, 'Allegro_Wheel')

# 6. Props around Duża Scena
load_glb(world_dir / 'foh_tower.glb', 72, 18, -math.pi / 2, 'FOH_Tower')
load_glb(world_dir / 'delay_tower.glb', 54, -4, -math.pi / 2, 'Delay_Tower_L')
load_glb(world_dir / 'delay_tower.glb', 54, 40, -math.pi / 2, 'Delay_Tower_R')
load_glb(world_dir / 'mud_bath.glb', 64, -10, 0, 'Mud_Bath')
load_glb(world_dir / 'fire_truck_osp.glb', 64, -22, 0, 'Fire_Truck_OSP')

# 7. Festival Gate & Zone West
load_glb(world_dir / 'festival_gate.glb', 0, -68, 0, 'Festival_Gate')
load_glb(world_dir / 'festivalZones.glb', -122, -44, 0, 'Festival_Zones_Pomorze')

# 8. Water Curtain across the pasaż at (50, -35)
load_glb(world_dir / 'water_curtain.glb', 50, -35, math.pi / 2, 'Water_Curtain_Pasaż')

# Camera Setup
cam_data = bpy.data.cameras.new("RenderCam")
cam_obj = bpy.data.objects.new("RenderCam", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

scene = bpy.context.scene
scene.render.resolution_x = 1280
scene.render.resolution_y = 800

def set_camera(pos, target_pos):
    cam_obj.location = pos
    target = Vector(target_pos)
    rot_quat = (target - cam_obj.location).to_track_quat('-Z', 'Y')
    cam_obj.rotation_euler = rot_quat.to_euler()

# --- RENDER 1: Complete Aerial Overview showing both avenues, Duża Scena 2x, ASP tent, Lidl, Grzybek ---
set_camera((-120.0, 120.0, 150.0), (30.0, -30.0, 0.0))
out1 = str(out_dir / "festival_2026_layout_aerial.png")
scene.render.filepath = out1
bpy.ops.render.render(write_still=True)
print(f"Rendered: {out1}")

# --- RENDER 2: Close-up of Duża Scena 2x & Rebuilt Grzybek Shower Mast ---
set_camera((45.0, 28.0, 7.0), (75.0, 10.0, 6.0))
out2 = str(out_dir / "grzybek_and_main_stage_detail.png")
scene.render.filepath = out2
bpy.ops.render.render(write_still=True)
print(f"Rendered: {out2}")

# --- RENDER 3: Scena ASP Entrance Plaza & Open Portal (facing East +X) ---
set_camera((36.0, -97.0, 6.0), (0.0, -97.0, 5.0))
out3 = str(out_dir / "asp_tent_walkable_entrance.png")
scene.render.filepath = out3
bpy.ops.render.render(write_still=True)
print(f"Rendered: {out3}")

# --- RENDER 4: Scena ASP Walkable Interior (Inside tent looking at debate stage & Persian rug) ---
set_camera((6.0, -97.0, 2.2), (-16.0, -97.0, 3.5))
out4 = str(out_dir / "asp_tent_interior_view.png")
scene.render.filepath = out4
bpy.ops.render.render(write_still=True)
print(f"Rendered: {out4}")

# --- RENDER 5: South Avenue Perspective showing Lidl, South Road, and ASP tent ---
set_camera((-100.0, -45.0, 22.0), (-30.0, -85.0, 5.0))
out5 = str(out_dir / "south_avenue_lidl_asp_preview.png")
scene.render.filepath = out5
bpy.ops.render.render(write_still=True)
print(f"Rendered: {out5}")

# --- RENDER 6: Water Curtain on the Pasaż (Eye-level looking through arch down the avenue) ---
set_camera((30.0, 35.0, 1.8), (55.0, 35.0, 2.2))
out6 = str(out_dir / "water_curtain_pasaz_perspective.png")
scene.render.filepath = out6
bpy.ops.render.render(write_still=True)
print(f"Rendered: {out6}")
