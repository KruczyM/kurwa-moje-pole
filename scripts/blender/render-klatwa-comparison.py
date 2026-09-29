import bpy
from mathutils import Vector
from pathlib import Path

# Clear
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
for col in list(bpy.data.collections):
    bpy.data.collections.remove(col, do_unlink=True)

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 24
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.image_settings.file_format = 'PNG'

# World
world = bpy.data.worlds.new('WhiteStudio')
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.9, 0.9, 0.9, 1.0)
bg.inputs['Strength'].default_value = 1.0
scene.world = world

# Lights
bpy.ops.object.light_add(type='SUN', location=(5, -10, 10))
sun = bpy.context.object
sun.data.energy = 2.5
sun.rotation_euler = (0.7, 0.2, -0.4)

# 1. Old Klatwa (legacy-preview.glb) on the LEFT (-1.2, 0, 0)
before_objs = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=r'public/game-assets/characters/klatwa/legacy-preview.glb')
old_objs = set(bpy.data.objects) - before_objs
for obj in old_objs:
    if obj.parent is None:
        obj.location.x -= 1.2

# 2. New Klatwa (new-preview-animations.glb) on the RIGHT (+1.2, 0, 0)
before_objs = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=r'public/game-assets/characters/klatwa/new-preview-animations.glb')
new_objs = set(bpy.data.objects) - before_objs
for obj in new_objs:
    if obj.parent is None:
        obj.location.x += 1.2

# Camera
cam_data = bpy.data.cameras.new('Cam')
cam_data.lens = 50
cam = bpy.data.objects.new('Cam', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
cam.location = Vector((0.0, -4.5, 1.2))
target = Vector((0.0, 0.0, 1.0))
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()

out = Path(r'C:\Users\krucz\.gemini\antigravity\brain\d81ba138-3200-4466-b868-2f212dff67d0\klatwa_comparison.png')
scene.render.filepath = str(out)
bpy.ops.render.render(write_still=True)
print("Rendered to", out)
