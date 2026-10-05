"""
Render isolated preview of sunflower.glb
"""

import bpy
import math
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GLB_PATH = ROOT / "public" / "game-assets" / "world" / "festival" / "sunflower.glb"
ARTIFACTS_DIR = Path(r"C:\Users\krucz\.gemini\antigravity\brain\0f469478-5ced-4cb0-85a6-506fc5188eb0")
OUT_IMG = ARTIFACTS_DIR / "sunflower_model_preview.png"

bpy.ops.wm.read_factory_settings(use_empty=True)

world = bpy.data.worlds.new("SunWorld")
bpy.context.scene.world = world
bg_node = world.node_tree.nodes.get('Background')
if bg_node:
    bg_node.inputs['Color'].default_value = (0.55, 0.75, 0.95, 1.0)
    bg_node.inputs['Strength'].default_value = 1.0

# Ground
bpy.ops.mesh.primitive_cylinder_add(radius=4.0, depth=0.1, location=(0, 0, -0.05))
ground = bpy.context.active_object
mat_g = bpy.data.materials.new("Soil")
mat_g.use_nodes = True
mat_g.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.22, 0.16, 0.10, 1.0)
ground.data.materials.append(mat_g)

# Import sunflower
bpy.ops.import_scene.gltf(filepath=str(GLB_PATH))

# Sun
light_data = bpy.data.lights.new(name="Sun", type='SUN')
light_data.energy = 4.5
light_obj = bpy.data.objects.new(name="Sun", object_data=light_data)
bpy.context.collection.objects.link(light_obj)
light_obj.rotation_euler = (math.radians(50), math.radians(20), math.radians(-35))

# Camera pointing directly at sunflower
target = bpy.data.objects.new("Target", None)
target.location = (0.0, 0.0, 1.75)
bpy.context.collection.objects.link(target)

cam_data = bpy.data.cameras.new("Camera")
cam_obj = bpy.data.objects.new("Camera", cam_data)
bpy.context.collection.objects.link(cam_obj)
cam_obj.location = (0.0, 2.2, 1.85)

track = cam_obj.constraints.new(type='TRACK_TO')
track.target = target
track.track_axis = 'TRACK_NEGATIVE_Z'
track.up_axis = 'UP_Y'

bpy.context.scene.camera = cam_obj

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 960
scene.render.resolution_y = 1080
scene.render.filepath = str(OUT_IMG)

print("Rendering sunflower preview...")
bpy.ops.render.render(write_still=True)
print("Render done!")
