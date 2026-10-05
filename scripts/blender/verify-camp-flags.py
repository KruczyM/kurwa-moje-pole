"""Check persisted flag geometry, atlas selection and untouched camp transforms."""
import hashlib
import json
from pathlib import Path
import bpy
from mathutils import Vector

root = Path(__file__).resolve().parents[2]
report = json.loads((root/'reports/festival-blender/camp-flags.json').read_text(encoding='utf-8'))
bpy.ops.wm.open_mainfile(filepath=str(root/'blender/backups/festival-layout-before-photo-flags.blend'))
before = {o.name:tuple(v for row in o.matrix_basis for v in row) for o in bpy.context.scene.objects}
bpy.ops.wm.open_mainfile(filepath=str(root/'blender/festival-layout.blend'))
scene = bpy.context.scene
flags = [o for o in scene.objects if 'campFlagDesign' in o]
assert len(flags) == 40
assert {o['campFlagDesign'] for o in flags} == set(range(40))
allowed = {r[key] for r in report['flags'] for key in ('object','pole')}
for name, transform in before.items():
    if name not in allowed:
        assert tuple(v for row in scene.objects[name].matrix_basis for v in row) == transform, name
for r in report['flags']:
    flag, pole = scene.objects[r['object']], scene.objects[r['pole']]
    points = [pole.matrix_world@Vector(p) for p in pole.bound_box]
    assert abs(min(p.z for p in points)) < .001
    assert abs(max(p.z for p in points)-report['genericPoleHeight']) < .001
    assert len(flag.data.materials) == 1
    assert not flag.get('replace_with_photo')
    u0,v0,u1,v1 = r['uvRect']
    for loop in flag.data.uv_layers['FlagPhotoUV'].data:
        assert u0-.00001 <= loop.uv.x <= u1+.00001
        assert v0-.00001 <= loop.uv.y <= v1+.00001
    assert max(v.co.z for v in flag.data.vertices) < report['genericPoleHeight']
for r in report['atlases']:
    assert hashlib.sha256((root/'public/game-assets/textures/camp-flags'/r['file']).read_bytes()).hexdigest() == r['sha256']
assert .9 < report['genericPoleHeight']/report['mainFlagHeight'] < 1
counts = {c:sum(r['camp']==c for r in report['flags']) for c in {r['camp'] for r in report['flags']}}
assert len(counts) == 12 and all(3 <= n <= 4 for n in counts.values())
print(json.dumps({'passed':True,'flags':40,'camps':counts,'height':report['genericPoleHeight'],'unrelatedTransformsPreserved':True}))
