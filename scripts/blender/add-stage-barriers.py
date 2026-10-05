"""Add the game's barrier perimeter to the edited authoring scene only."""
import json
import math
import re
import shutil
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
FILE = ROOT / 'blender/festival-layout.blend'
BACKUP = ROOT / 'blender/backups/festival-layout-before-stage-barriers-20261004.blend'
if not BACKUP.exists():
    shutil.copy2(FILE, BACKUP)
bpy.ops.wm.open_mainfile(filepath=str(FILE))
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
before = {o.name: tuple(v for row in o.matrix_basis for v in row) for o in scene.objects}
source = (ROOT / 'src/game/world/festivalInfrastructure.ts').read_text(encoding='utf-8')
section = source.split('// 1. Front West Fence:')[1].split('// Barrier Colliders:')[0]
pattern = r'for \(let ([xz]) = ([-\d.]+); \1 <= ([-\d.]+); \1 \+= ([-\d.]+)\) \{\s*placeBarrierSegment\(([^,]+), ([^,]+), ([^)]+)\);'
placements = []
for axis, start, end, step, px, pz, angle in re.findall(pattern, section):
    value = float(start)
    while value <= float(end) + 1e-8:
        x = value if px.strip() == axis else float(px)
        z = value if pz.strip() == axis else float(pz)
        placements.append((x, z, math.pi / 2 if angle.strip() == 'Math.PI / 2' else float(angle)))
        value += float(step)
assert len(placements) == 102, len(placements)
name = 'MainStage_Barrier_Perimeter'
assert name not in bpy.data.collections, 'Barriers already installed; do not duplicate'
collection = bpy.data.collections.new(name)
scene.collection.children.link(collection)
old = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/game-assets/world/festival/crowd_barrier.glb'))
imported = set(bpy.data.objects) - old
template = bpy.data.collections.new('Asset_StageCrowdBarrier')
for obj in imported:
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    template.objects.link(obj)
for i, (x, z, angle) in enumerate(placements):
    obj = bpy.data.objects.new(f'StageBarrier_{i:03}', None)
    collection.objects.link(obj)
    obj.instance_type = 'COLLECTION'
    obj.instance_collection = template
    obj.location = (x, -z, 0)
    obj.rotation_euler.z = angle
    obj['asset_path'] = 'world/festival/crowd_barrier.glb'
    obj['source'] = 'festivalInfrastructure.ts perimeter; retains entrance gaps'
for key, matrix in before.items():
    assert tuple(v for row in scene.objects[key].matrix_basis for v in row) == matrix, key
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
# Reopen the saved file to verify persisted additions and original transforms.
bpy.ops.wm.open_mainfile(filepath=str(FILE))
assert len(bpy.data.collections[name].objects) == len(placements)
for key, matrix in before.items():
    assert tuple(v for row in bpy.context.scene.objects[key].matrix_basis for v in row) == matrix, key
report = {'barriers': len(placements), 'existingTransformsPreserved': len(before), 'backup': str(BACKUP), 'runtimeMigration': False, 'persistedVerification': True}
(ROOT / 'reports/festival-blender/stage-barriers-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
scene = bpy.context.scene
target = Vector((153, -18, 0))
scene.camera.location = target + Vector((-105, -105, 130))
scene.camera.rotation_euler = (target - scene.camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera.data.type = 'ORTHO'
scene.camera.data.ortho_scale = 160
scene.render.resolution_x, scene.render.resolution_y = 1400, 1000
scene.render.resolution_percentage = 100
scene.render.filepath = str(ROOT / 'blender/festival-stage-barriers.png')
bpy.ops.render.render(write_still=True)
print(json.dumps(report))
