"""Reopen the saved project and check layout, packed textures and shared assets."""
import json
import math
from pathlib import Path
import bpy

root=Path(__file__).resolve().parents[2]
data=json.loads((root/'reports/festival-blender/layout.json').read_text(encoding='utf-8'))
bpy.ops.wm.open_mainfile(filepath=str(root/'blender/festival-layout.blend'))
scene=bpy.context.scene
assert scene.unit_settings.scale_length==1
assert scene.get('purpose','').startswith('Standalone')
for item in data['items']:
    obj=scene.objects.get(item['id'])
    assert obj is not None, item['id']
    assert abs(obj.location.x-item['x'])<1e-4, item['id']
    assert abs(obj.location.y+item['z'])<1e-4, item['id']
    assert abs(obj.rotation_euler.z-item['rotationY'])<1e-4, item['id']
    children=[o for o in obj.children if o.instance_type=='COLLECTION']
    assert len(children)==1, item['id']
    assert any(o.type=='MESH' for o in children[0].instance_collection.objects), item['id']
    assert all(math.isfinite(v) and v>0 for v in children[0].scale), item['id']
instances=[o for o in scene.objects if o.instance_type=='COLLECTION']
assert len(instances)==scene['placement_count']
assert len([o for o in scene.objects if o.get('placement_id','').startswith('redBull_')])==2
images=[i for i in bpy.data.images if i.source=='FILE' and i.users>0]
assert all(i.packed_file or i.packed_files for i in images), 'Unpacked image dependencies'
report={'status':'PASS','sourcePlacements':len(data['items']),'instances':len(instances),
        'packedImages':len(images),'runtimeMigration':False}
(root/'reports/festival-blender/verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
