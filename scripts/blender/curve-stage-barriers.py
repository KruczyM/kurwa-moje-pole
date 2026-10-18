"""Enclose the audience with a semicircle anchored to the stage sides."""
import json
import math
import shutil
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
FILE = ROOT / 'blender/festival-layout.blend'
BACKUP = ROOT / 'blender/backups/festival-layout-before-curved-barriers-20261004.blend'
if not BACKUP.exists():
    shutil.copy2(FILE, BACKUP)
bpy.ops.wm.open_mainfile(filepath=str(FILE))
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
collection = bpy.data.collections['MainStage_Barrier_Perimeter']
before = {o.name: tuple(v for row in o.matrix_basis for v in row) for o in scene.objects if o not in set(collection.objects)}
stage = next(o for o in scene.objects if o.get('asset_path', '').endswith('/main_stage.glb'))
bpy.context.view_layer.update()
points = []
for inst in stage.children:
    if inst.instance_collection:
        for obj in inst.instance_collection.all_objects:
            if obj.type == 'MESH':
                points.extend(inst.matrix_world @ obj.matrix_world @ Vector(v) for v in obj.bound_box)
assert points
front = min(p.x for p in points)
low, high = min(p.y for p in points), max(p.y for p in points)
center = (low + high) / 2
radius = (high - low) / 2 + 3
# A true semicircle on the audience-facing (west) side, connected to both stage flanks.
steps = math.ceil(math.pi * radius / 2.5)
gates = (.17, math.pi / 2, math.pi - .17)
half_gap_angle = 3.5 / radius
placements = []
for i in range(steps):
    angle = (i + .5) * math.pi / steps
    if any(abs(angle - g) < half_gap_angle for g in gates):
        continue
    x, y = front - radius * math.sin(angle), center + radius * math.cos(angle)
    tangent = math.atan2(-radius * math.sin(angle), -radius * math.cos(angle))
    placements.append((x, y, tangent))
template = next(o.instance_collection for o in collection.objects if o.instance_collection)
# Remove only the previous barrier instances, never other scene objects.
for obj in list(collection.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
for i, (x, y, rotation) in enumerate(placements):
    obj = bpy.data.objects.new(f'StageBarrier_{i:03}', None)
    collection.objects.link(obj)
    obj.instance_type = 'COLLECTION'
    obj.instance_collection = template
    obj.location = (x, y, 0)
    obj.rotation_euler.z = rotation
    obj['asset_path'] = 'world/festival/crowd_barrier.glb'
collection['layout'] = 'Audience semicircle from stage sides; three 7m patrol entrances'
for name, matrix in before.items():
    assert tuple(v for row in scene.objects[name].matrix_basis for v in row) == matrix, name
bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
bpy.ops.wm.open_mainfile(filepath=str(FILE))
for name, matrix in before.items():
    assert tuple(v for row in bpy.context.scene.objects[name].matrix_basis for v in row) == matrix, name
assert len(bpy.data.collections['MainStage_Barrier_Perimeter'].objects) == len(placements)
report = {'barriers': len(placements), 'radiusMeters': radius, 'entrances': 3, 'entranceWidthMetersApprox': 7, 'otherTransformsPreserved': len(before), 'runtimeMigration': False}
(ROOT / 'reports/festival-blender/curved-stage-barriers-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
scene = bpy.context.scene
target = Vector((front - radius / 3, center, 0))
scene.camera.location = target + Vector((-105, -105, 150))
scene.camera.rotation_euler = (target - scene.camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera.data.type = 'ORTHO'
scene.camera.data.ortho_scale = radius * 2.8
scene.render.resolution_x, scene.render.resolution_y = 1400, 1000
scene.render.resolution_percentage = 100
scene.render.filepath = str(ROOT / 'blender/festival-stage-semicircle.png')
bpy.ops.render.render(write_still=True)
print(json.dumps(report))
