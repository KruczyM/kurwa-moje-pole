"""
Pol'and'Rock Festival 2026 - Props Showcase Composition Renderer
Renders high-quality preview of all authentic festival props together:
- "Zaraz Będzie Czysto" Waste Sorting Corral & Sacks
- Festival Multi-directional Wooden Signpost Totem
- FOH Audio/Lighting Mixing Scaffolding Tower
- Pokojowy Patrol / Medical Outpost Gazebo Tent
- Kurtyna Wodna Misting Arch
"""

import bpy
import math
import os
from mathutils import Vector

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROPS_DIR = os.path.join(ROOT_DIR, "public", "game-assets", "world", "festival")
ARTIFACTS_DIR = r"C:\Users\krucz\.gemini\antigravity\brain\d81ba138-3200-4466-b868-2f212dff67d0"
OUTPUT_IMG = os.path.join(ARTIFACTS_DIR, "festival_props_showcase.png")

# Reset scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# World background: Festival summer sky
world = bpy.data.worlds.new("FestivalWorld")
bpy.context.scene.world = world
bg_node = world.node_tree.nodes.get('Background')
if bg_node:
    bg_node.inputs['Color'].default_value = (0.50, 0.72, 0.94, 1.0)
    bg_node.inputs['Strength'].default_value = 1.0

# Ground grass turf plane (Blender Z-up: X=width, Y=depth, Z=elevation)
bpy.ops.mesh.primitive_cylinder_add(radius=25.0, depth=0.1, location=(0, 0, -0.05))
ground = bpy.context.active_object
ground.name = "Grass_Lawn"
mat_grass = bpy.data.materials.new(name="FestivalGrass")
mat_grass.use_nodes = True
bsdf = mat_grass.node_tree.nodes.get('Principled BSDF')
if bsdf:
    bsdf.inputs['Base Color'].default_value = (0.18, 0.35, 0.12, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.90
ground.data.materials.append(mat_grass)

# Prop arrangement in Blender Z-up coordinates:
# (filename, (x, y, z), rotation_z)
props = [
    # Back row
    ("foh_tower.glb",         (-6.8,  2.0, 0.0), math.radians(25)),
    ("water_curtain.glb",     ( 0.0,  4.5, 0.0), 0),
    ("patrol_tent.glb",       ( 6.5,  2.2, 0.0), math.radians(-25)),
    # Front row
    ("trash_corral.glb",      (-3.4, -2.5, 0.0), math.radians(14)),
    ("festival_signpost.glb", ( 3.2, -2.5, 0.0), math.radians(-32)),
]

for filename, loc, rot_z in props:
    glb_path = os.path.join(PROPS_DIR, filename)
    if os.path.exists(glb_path):
        print(f"Importing {filename}...")
        bpy.ops.object.select_all(action='DESELECT')
        bpy.ops.import_scene.gltf(filepath=glb_path)
        imported = [o for o in bpy.context.selected_objects if o.parent is None]
        empty = bpy.data.objects.new(f"Root_{filename}", None)
        bpy.context.scene.collection.objects.link(empty)
        empty.location = loc
        empty.rotation_euler = (0, 0, rot_z)
        for obj in imported:
            obj.parent = empty

# Sun light (afternoon golden festival sunlight)
bpy.ops.object.light_add(type='SUN', location=(20, -25, 28))
sun = bpy.context.object
sun.data.energy = 3.5
sun.data.color = (1.0, 0.95, 0.88)
sun.rotation_euler = (math.radians(52), math.radians(16), math.radians(-45))

# Fill light from the blue sky
bpy.ops.object.light_add(type='SUN', location=(-15, 18, 20))
fill = bpy.context.object
fill.data.energy = 1.4
fill.data.color = (0.75, 0.88, 1.0)
fill.rotation_euler = (math.radians(60), math.radians(-25), math.radians(130))

# Camera setup (located at Y = -16.5, Z = 4.8 looking at (0, 0.5, 1.8))
bpy.ops.object.camera_add(location=(0.0, -16.0, 4.6))
cam = bpy.context.object
cam.data.lens = 35 # Festival field lens
bpy.context.scene.camera = cam

# Point camera at target
target_pos = Vector((0.0, 0.5, 1.8))
dir_vec = target_pos - cam.location
cam.rotation_euler = dir_vec.to_track_quat('-Z', 'Y').to_euler()

# Render settings
bpy.context.scene.render.engine = 'BLENDER_EEVEE'
bpy.context.scene.render.resolution_x = 1920
bpy.context.scene.render.resolution_y = 1080
bpy.context.scene.render.filepath = OUTPUT_IMG
bpy.context.scene.render.image_settings.file_format = 'PNG'

print(f"Rendering showcase image to {OUTPUT_IMG}...")
bpy.ops.render.render(write_still=True)
print(f"Showcase image successfully rendered: {OUTPUT_IMG}")
