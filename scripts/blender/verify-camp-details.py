"""Verify persisted camp dressing without reverting manually edited placements."""
import json
from pathlib import Path
import bpy

root = Path(__file__).resolve().parents[2]
backup = root / 'blender/backups/festival-layout-before-camp-details-20261004.blend'
bpy.ops.wm.open_mainfile(filepath=str(backup))
original = {o.name: tuple(v for row in o.matrix_basis for v in row) for o in bpy.context.scene.objects}
bpy.ops.wm.open_mainfile(filepath=str(root / 'blender/festival-layout.blend'))
for name, transform in original.items():
    obj = bpy.context.scene.objects.get(name)
    assert obj is not None, name
    assert tuple(v for row in obj.matrix_basis for v in row) == transform, name
flags = [o for o in bpy.context.scene.objects if 'campFlagDesign' in o or o.get('replace_with_photo')]
assert len(flags) == (40 if any('campFlagDesign' in o for o in flags) else 12), len(flags)
assert all(o.data.uv_layers.get('FlagPhotoUV') for o in flags)
camps = [c for c in bpy.data.collections if c.name.startswith('Life_')]
assert len(camps) == 12
assert all(len(c.objects) > 10 for c in camps)
result = {'passed': True, 'originalTransformsPreserved': len(original), 'camps': len(camps), 'flags': len(flags), 'runtimeMigration': False}
(root / 'reports/festival-blender/camp-details-verification.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result))
