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
out_dir = Path("C:/Users/krucz/.gemini/antigravity/brain/0c98c038-fa8e-4ceb-a826-a6a862b3a84b")
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
bpy.ops.mesh.primitive_plane_add(size=320, location=(0, 0, -0.05))
ground = bpy.context.active_object
ground.name = "Meadow"
mat_ground = bpy.data.materials.new("Mat_Meadow")
mat_ground.use_nodes = True
bsdf = mat_ground.node_tree.nodes.get("Principled BSDF")
if bsdf:
    bsdf.inputs['Base Color'].default_value = (0.22, 0.42, 0.16, 1.0)
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
    c_bsdf.inputs['Base Color'].default_value = (0.6, 0.6, 0.62, 1.0)
c_bsdf.inputs['Roughness'].default_value = 0.85

def make_concrete_road(name, minX, maxX, minZ, maxZ):
    # In Blender: Three.js X -> Blender X, Three.js Z -> Blender -Y
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

# 2. South parallel concrete lane (Z: [26, 36])
make_concrete_road("South_Concrete_Lane", -140, 140, 26, 36)

# Camp boundary indicator
camp_mat = bpy.data.materials.new("Mat_Camp")
camp_mat.use_nodes = True
camp_bsdf = camp_mat.node_tree.nodes.get("Principled BSDF")
camp_bsdf.inputs['Base Color'].default_value = (0.35, 0.3, 0.22, 1.0)
camp_bsdf.inputs['Roughness'].default_value = 0.95
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0.01))
camp_plane = bpy.context.active_object
camp_plane.name = "Camp_Kurwa_Moje_Pole"
camp_plane.scale = (36, 36, 1)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
camp_plane.data.materials.append(camp_mat)

# Import models
models_to_place = [
    # Lidl on south road: x: -50, z: 46 (faces north, rotY = pi)
    (world_dir / 'lidlRockShop.glb', -50, 46, math.pi, 'Lidl_Rock_Shop'),
    # Scena ASP on south road: x: 52, z: 63 (faces north, rotY = 0)
    (world_dir / 'small_stage.glb', 52, 63, 0, 'Scena_ASP'),
    # Main stage: x: 116, z: 18, rotY = -pi/2
    (world_dir / 'main_stage.glb', 116, 18, -math.pi/2, 'Main_Stage'),
    # Pomorze on left end of north passage: x: -122, z: -44, rotY = 0
    (world_dir / 'festivalZones.glb', -122, -44, 0, 'Festival_Zones_Pomorze'),
    # Market stalls along north road
    (world_dir / 'marketStalls.glb', 0, 0, 0, 'Market_Stalls'),
]

for glb_path, px, pz, rot_y, label in models_to_place:
    if not glb_path.exists():
        print(f"Skipping: {glb_path}")
        continue
    before_objs = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(glb_path))
    new_objs = set(bpy.data.objects) - before_objs
    
    imported = [o for o in bpy.context.selected_objects if o.parent is None]
    if imported:
        root_obj = imported[0]
        root_obj.name = label
        if label == 'Scena_ASP':
            root_obj.location = (px, -pz + 20, 0.0)
        else:
            root_obj.location = (px, -pz, 0.0)
        root_obj.rotation_euler[2] += rot_y
    if label == 'Festival_Zones_Pomorze':
        for o in list(bpy.data.objects):
            if o in new_objs and ('RedBull' in o.name or 'IQOS' in o.name):
                bpy.data.objects.remove(o, do_unlink=True)

# Camera
cam_data = bpy.data.cameras.new("OverviewCam")
cam_obj = bpy.data.objects.new("OverviewCam", cam_data)
bpy.context.scene.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

scene = bpy.context.scene
scene.render.resolution_x = 1280
scene.render.resolution_y = 800

# View 1: Isometric view showing both parallel avenues, camp in the center, Lidl and ASP
cam_obj.location = (-60.0, -140.0, 95.0)
target = Vector((0.0, 0.0, 0.0))
rot_quat = (target - cam_obj.location).to_track_quat('-Z', 'Y')
cam_obj.rotation_euler = rot_quat.to_euler()
out1 = str(out_dir / "two_concrete_avenues_overview.png")
scene.render.filepath = out1
bpy.ops.render.render(write_still=True)
print(f"Rendered: {out1}")

# View 2: Close up of south avenue with Lidl and ASP
cam_obj.location = (0.0, 10.0, 42.0)
target = Vector((0.0, -50.0, 6.0))
rot_quat = (target - cam_obj.location).to_track_quat('-Z', 'Y')
cam_obj.rotation_euler = rot_quat.to_euler()
out2 = str(out_dir / "south_avenue_lidl_asp_close.png")
scene.render.filepath = out2
bpy.ops.render.render(write_still=True)
print(f"Rendered: {out2}")

# View 3: North avenue with Pomorze at the left end
cam_obj.location = (-90.0, 0.0, 38.0)
target = Vector((-110.0, 42.0, 3.0))
rot_quat = (target - cam_obj.location).to_track_quat('-Z', 'Y')
cam_obj.rotation_euler = rot_quat.to_euler()
out3 = str(out_dir / "north_avenue_pomorze_close.png")
scene.render.filepath = out3
bpy.ops.render.render(write_still=True)
print(f"Rendered: {out3}")
