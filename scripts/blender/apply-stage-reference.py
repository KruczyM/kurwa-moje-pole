"""Install the supplied facade artwork without rebuilding the user's layout.

Run with Blender --background --factory-startup --python this-file -- image.jpg.
Image bytes are copied unchanged; artwork is packed into the editable scene.
Existing per-panel UV and all object transforms are preserved.
"""
import hashlib
import json
import shutil
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
FILE = ROOT / 'blender/festival-layout.blend'
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
assert len(args) == 1, 'Supply exactly one reference image path after --'
source = Path(args[0]).resolve()
assert source.is_file(), source
backup = ROOT / 'blender/backups/festival-layout-before-stage-reference.blend'
backup.parent.mkdir(parents=True, exist_ok=True)
if not backup.exists():
    shutil.copy2(FILE, backup)
target = ROOT / 'source-assets/stages/main_stage_reference_supplied.jpg'
target.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(source, target)

bpy.ops.wm.open_mainfile(filepath=str(FILE))
bpy.context.preferences.filepaths.save_version = 0
before = {o.name: tuple(v for row in o.matrix_world for v in row)
          for o in bpy.context.scene.objects}
image = bpy.data.images.load(str(target), check_existing=False)
image.name = 'main_stage_v2_facade_full_supplied'
assert image.size[0] > 2000 and image.size[1] > 700, 'Reference resolution too low'
image.pack()
nodes = []
for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    for node in mat.node_tree.nodes:
        if node.type == 'TEX_IMAGE' and node.image and 'facade_full' in node.image.name:
            node.image = image
            nodes.append(mat.name)
assert nodes, 'No existing facade materials matched; source scene left unsaved'

# Re-establish isotropic sampling on the three independent banners. The wing
# surrounds retain shared atlas registration so their apertures remain aligned.
panels = []
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH' or not obj.get('facade_pixel_aspect_corrected'):
        continue
    if not any(m and m.name in nodes for m in obj.data.materials):
        continue
    points = [obj.matrix_world @ v.co for v in obj.data.vertices]
    width = max(p.y for p in points) - min(p.y for p in points)
    height = max(p.z for p in points) - min(p.z for p in points)
    coords = [loop.uv.copy() for loop in obj.data.uv_layers.active.data]
    du = max(p.x for p in coords) - min(p.x for p in coords)
    dv = max(p.y for p in coords) - min(p.y for p in coords)
    factor = (du * image.size[0] / width) / (dv * image.size[1] / height)
    obj.data = obj.data.copy()
    center = (max(p.y for p in coords) + min(p.y for p in coords)) / 2
    for loop in obj.data.uv_layers.active.data:
        loop.uv.y = center + (loop.uv.y - center) * factor
    after = [loop.uv.y for loop in obj.data.uv_layers.active.data]
    error = abs((du * image.size[0] / width) /
                ((max(after) - min(after)) * image.size[1] / height) - 1)
    assert error < .00001, (obj.name, error)
    panels.append({'object': obj.name, 'pixelAspectError': error})
assert len(panels) == 3, panels
assert before == {o.name: tuple(v for row in o.matrix_world for v in row)
                  for o in bpy.context.scene.objects}, 'Object transforms changed'
bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
report = {'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
          'imageSize': list(image.size), 'materials': nodes, 'panels': panels,
          'objectTransformsUnchanged': True,
          'limitation': 'Wing surrounds retain registered UV; not isotropic artwork.'}
out = ROOT / 'reports/festival-blender/stage-reference.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
