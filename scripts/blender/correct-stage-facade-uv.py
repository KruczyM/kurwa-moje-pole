"""Preserve facade pixel aspect on individual banners without moving edited geometry."""
import json
import shutil
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
FILE=ROOT/'blender/festival-layout.blend'
backup=ROOT/'blender/backups/festival-layout-before-facade-uv.blend'
if not backup.exists():shutil.copy2(FILE,backup)
bpy.ops.wm.open_mainfile(filepath=str(backup))
original={o.name:[loop.uv.copy() for loop in o.data.uv_layers.active.data] for o in bpy.context.scene.objects
          if o.type=='MESH' and o.name.startswith('Facade_') and o.data.uv_layers.active}
bpy.ops.wm.open_mainfile(filepath=str(FILE))
bpy.context.preferences.filepaths.save_version=0
changed=[]
for obj in bpy.context.scene.objects:
    if obj.type!='MESH' or obj.name not in original:continue
    obj.data=obj.data.copy()
    for loop,uv in zip(obj.data.uv_layers.active.data,original[obj.name]):loop.uv=uv
    if 'facade_pixel_aspect_corrected' in obj:del obj['facade_pixel_aspect_corrected']
    # Window surrounds need their shared atlas registration; do not crop into the white apertures.
    if not ('Guitarist_Column' in obj.name or 'Roof_Gable' in obj.name):continue
    image=next((node.image for m in obj.data.materials if m and m.use_nodes for node in m.node_tree.nodes
                if node.type=='TEX_IMAGE' and node.image and 'facade_full' in node.image.name),None)
    if not image or not obj.data.uv_layers.active:continue
    points=[obj.matrix_world@v.co for v in obj.data.vertices]
    horizontal=max(p.y for p in points)-min(p.y for p in points)
    vertical=max(p.z for p in points)-min(p.z for p in points)
    coords=[loop.uv.copy() for loop in obj.data.uv_layers.active.data]
    du=max(p.x for p in coords)-min(p.x for p in coords)
    dv=max(p.y for p in coords)-min(p.y for p in coords)
    if min(horizontal,vertical,du,dv)<.00001:continue
    factor=(du*image.size[0]/horizontal)/(dv*image.size[1]/vertical)
    obj.data=obj.data.copy()
    center=(max(p.y for p in coords)+min(p.y for p in coords))/2
    for loop in obj.data.uv_layers.active.data:loop.uv.y=center+(loop.uv.y-center)*factor
    obj['facade_pixel_aspect_corrected']=True
    after=[loop.uv.y for loop in obj.data.uv_layers.active.data]
    error=abs((du*image.size[0]/horizontal)/((max(after)-min(after))*image.size[1]/vertical)-1)
    assert error<.00001
    changed.append({'object':obj.name,'vScale':factor,'pixelAspectErrorAfter':error})
assert changed,'No uncorrected facade panels found'
bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
(ROOT/'reports/festival-blender/facade-uv.json').write_text(json.dumps(changed,indent=2),encoding='utf-8')
print(json.dumps({'correctedPanels':len(changed)}))
