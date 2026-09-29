"""
Render previews for updated 2026 festival layout:
1. South Passage view showing Scena ASP and the relocated food tents (distanced from ASP, no overlap).
2. North Passage view showing the food tents moved to the other (south) side of the road and shifted further away from Duża Scena.
3. Aerial overview showing both avenues, ASP, Duża Scena, barriers, Grzybek, and both gastro zones.
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
out_dir = Path("C:/Users/krucz/.gemini/antigravity/brain/0f469478-5ced-4cb0-85a6-506fc5188eb0")
out_dir.mkdir(parents=True, exist_ok=True)

# Lighting: Sun & Fill
sun_data = bpy.data.lights.new(name="Sun", type='SUN')
sun_data.energy = 4.2
sun_obj = bpy.data.objects.new(name="Sun", object_data=sun_data)
sun_obj.rotation_euler = (math.radians(50), math.radians(25), math.radians(35))
bpy.context.scene.collection.objects.link(sun_obj)

fill_data = bpy.data.lights.new(name="Fill", type='SUN')
fill_data.energy = 2.2
fill_obj = bpy.data.objects.new(name="Fill", object_data=fill_data)
fill_obj.rotation_euler = (math.radians(-30), math.radians(-15), math.radians(140))
bpy.context.scene.collection.objects.link(fill_obj)

# Meadow
bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, -0.05))
ground = bpy.context.active_object
ground.name = "Meadow"
mat_ground = bpy.data.materials.new("Mat_Meadow")
mat_ground.use_nodes = True
bsdf = mat_ground.node_tree.nodes.get("Principled BSDF")
if bsdf:
    bsdf.inputs['Base Color'].default_value = (0.24, 0.44, 0.18, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.9
ground.data.materials.append(mat_ground)

# Concrete avenues
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

make_concrete_road("North_Avenue", -140, 140, -40, -30)
make_concrete_road("South_Avenue", -140, 140, 68, 78)

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

# Load Duża Scena 2x at (216, 18)
load_glb(world_dir / 'main_stage.glb', 216, 18, -math.pi / 2, 'Main_Stage_2x', scale_mult=2.0)

# Load Scena ASP at (0, 97)
load_glb(world_dir / 'small_stage.glb', 0, 97, math.pi / 2, 'Scena_ASP')

# Load Lidl Rock Shop at (-70, 88)
load_glb(world_dir / 'lidlRockShop.glb', -70, 88, math.pi, 'Lidl_Rock_Shop')

# Load Pokojowy Patrol Tent at Gate
load_glb(world_dir / 'patrol_tent.glb', 106, 24, -math.pi / 2, 'Patrol_Tent_Gate')

# Load Grzybek at x=160, z=-8
load_glb(world_dir / 'grzybek.glb', 160, -8, 0, 'Grzybek_Standpipe')

# Load Barriers around Duża Scena perimeter (x: 110..194, z: -14..50)
barrier_path = world_dir / 'crowd_barrier.glb'
barrier_spacing = 2.4

z = -13.0
while z <= 13.5:
    load_glb(barrier_path, 110.0, z, 0, f'Barrier_West_1_{z:.1f}')
    z += barrier_spacing

z = 22.5
while z <= 49.0:
    load_glb(barrier_path, 110.0, z, 0, f'Barrier_West_2_{z:.1f}')
    z += barrier_spacing

x = 111.0
while x <= 193.0:
    load_glb(barrier_path, x, -14.0, math.pi / 2, f'Barrier_North_{x:.1f}')
    x += barrier_spacing

x = 111.0
while x <= 193.0:
    load_glb(barrier_path, x, 50.0, -math.pi / 2, f'Barrier_South_{x:.1f}')
    x += barrier_spacing

z = -13.0
while z <= 49.0:
    load_glb(barrier_path, 194.0, z, math.pi, f'Barrier_East_{z:.1f}')
    z += barrier_spacing

# South Passage Food Tents (distanced from ASP, east of ASP):
load_glb(world_dir / 'festival_food_tent.glb', 52, 86, 0, 'Food_Tent_South_1')
load_glb(world_dir / 'rollbar_lech.glb', 68, 86, 0, 'Rollbar_Lech_South')
load_glb(world_dir / 'festival_food_tent.glb', 84, 86, 0, 'Food_Tent_South_2')
load_glb(world_dir / 'foodtruck_frytki.glb', 104, 86, 0, 'Foodtruck_Frytki_South')

# North Passage Food Tents (south side of north road z=-20, shifted away from Duża Scena):
load_glb(world_dir / 'foodtruck_makarun.glb', -127, -20, 0, 'Foodtruck_Makarun_North')
load_glb(world_dir / 'foodtruck_churros.glb', -115, -20, 0, 'Foodtruck_Churros_North')
load_glb(world_dir / 'festival_food_tent.glb', -96, -20, 0, 'Food_Tent_North_2')
load_glb(world_dir / 'rollbar_lech.glb', -80, -20, 0, 'Rollbar_Lech_North')
load_glb(world_dir / 'festival_food_tent.glb', -64, -20, 0, 'Food_Tent_North_1')
load_glb(world_dir / 'foodtruck_burger.glb', -46, -20, 0, 'Foodtruck_Burger_North')

# Camera Setup
cam_data = bpy.data.cameras.new("RenderCam")
cam_obj = bpy.data.objects.new("RenderCam", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

scene = bpy.context.scene
scene.render.resolution_x = 1280
scene.render.resolution_y = 768

def set_camera(pos, target_pos):
    cam_obj.location = pos
    target = Vector(target_pos)
    rot_quat = (target - cam_obj.location).to_track_quat('-Z', 'Y')
    cam_obj.rotation_euler = rot_quat.to_euler()

# RENDER 1: South Passage showing Scena ASP and distanced Food Tents
set_camera((-20.0, -48.0, 14.0), (45.0, -90.0, 4.0))
out1 = str(out_dir / "south_passage_asp_and_food_tents.png")
scene.render.filepath = out1
bpy.ops.render.render(write_still=True)
print(f"Rendered: {out1}")

# RENDER 2: North Passage eye-level from road looking at food court on south side of road
set_camera((-75.0, 42.0, 3.8), (-80.0, 20.0, 2.6))
out2 = str(out_dir / "north_passage_relocated_food_tents.png")
scene.render.filepath = out2
bpy.ops.render.render(write_still=True)
print(f"Rendered: {out2}")

# RENDER 3: Wide Aerial Overview of Both Passages, ASP, and Duża Scena
set_camera((-90.0, 130.0, 175.0), (35.0, -30.0, 0.0))
out3 = str(out_dir / "festival_overview_both_gastro_zones.png")
scene.render.filepath = out3
bpy.ops.render.render(write_still=True)
print(f"Rendered: {out3}")
