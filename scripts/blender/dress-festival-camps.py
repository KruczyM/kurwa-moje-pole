"""Add camp life to the edited .blend, preserving every existing transform."""
import json
import math
import random
import shutil
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
FILE=ROOT/'blender/festival-layout.blend'
REPORT=ROOT/'reports/festival-blender/camp-details-report.json'
BACKUP=ROOT/'blender/backups/festival-layout-before-camp-details-20261004.blend'
if not BACKUP.exists():
    BACKUP.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(FILE,BACKUP)
bpy.ops.wm.open_mainfile(filepath=str(FILE))
scene=bpy.context.scene
bpy.context.preferences.filepaths.save_version=0
if scene.get('camp_details_version'):
    raise RuntimeError('Camp details already installed; do not duplicate or overwrite manual edits')
before={o.name:tuple(v for row in o.matrix_basis for v in row) for o in scene.objects}
data=json.loads((ROOT/'reports/festival-blender/layout.json').read_text(encoding='utf-8'))
added=[];warnings=[];cached_assets=[]
master=bpy.data.collections.new('Camp_Life');scene.collection.children.link(master)
def group(name):
    c=bpy.data.collections.new(name);master.children.link(c);return c

def template_bounds(c):
    points=[o.matrix_world@Vector(p) for o in c.all_objects if o.type=='MESH' for p in o.bound_box]
    if not points:raise RuntimeError('Empty camp template '+c.name)
    return Vector([min(p[i] for p in points) for i in range(3)]),Vector([max(p[i] for p in points) for i in range(3)])

templates={}
for obj in scene.objects:
    if obj.get('asset_path') and obj.children:
        child=next((c for c in obj.children if c.instance_type=='COLLECTION'),None)
        if child:templates.setdefault(obj['asset_path'],child.instance_collection)

def resolve_template(path):
    if path not in templates:
        old=set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/game-assets'/path))
        objects=[o for o in bpy.data.objects if o not in old]
        c=bpy.data.collections.new('Asset_CampLife_'+Path(path).stem)
        bpy.context.view_layer.update()
        for o in objects:
            for oc in list(o.users_collection):oc.objects.unlink(o)
            c.objects.link(o)
        templates[path]=c
    return templates[path]

# Reuse an already-downloaded free asset. No account keys, requests or purchases.
kit_table=None
for file in sorted(Path('C:/Users/krucz/blenderkit_data/models').glob('small-woven-tabl*/*.blend')):
    with bpy.data.libraries.load(str(file),link=False) as (source,target):
        target.collections=[name for name in source.collections if name=='Small Woven Table']
    c=target.collections[0] if target.collections else None
    if c and any(o.get('blenderkit') and o['blenderkit'].get('is_free')==1 for o in c.all_objects):
        kit_table=c;cached_assets.append({'name':'Small Woven Table','source':'BlenderKit local cache','freeVerified':True})
        break

def prop(c,name,path,x,y,height,angle=0):
    source=kit_table if path=='BlenderKitSmallTable' else resolve_template(path)
    if not source:raise RuntimeError('Unavailable table')
    low,high=template_bounds(source);scale=height/max(high.z-low.z,.001)
    parent=bpy.data.objects.new(name,None);c.objects.link(parent)
    parent.location=(x,y,0);parent.rotation_euler.z=angle;parent.empty_display_size=.25
    parent['camp_detail']=True;parent['asset_path']=path
    visual=bpy.data.objects.new(name+'_Model',None);c.objects.link(visual)
    visual.instance_type='COLLECTION';visual.instance_collection=source;visual.parent=parent
    visual.scale=(scale,)*3;visual.location=(-(low.x+high.x)/2*scale,-(low.y+high.y)/2*scale,-low.z*scale)
    added.append(parent.name)
    return parent

def mat(name,color):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=.85
    return m
fabric=[mat('CampFlag_'+str(i),col) for i,col in enumerate([
    (.7,.09,.05),(.08,.32,.58),(.85,.6,.05),(.12,.45,.13),(.42,.1,.5),(.85,.8,.66)])]
metal=mat('CampPole_metal',(.22,.24,.25));cloth=mat('CampBlanket',(.18,.3,.43))
def mesh_obj(c,name,verts,faces,m):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.materials.append(m)
    obj=bpy.data.objects.new(name,mesh);c.objects.link(obj);obj['camp_detail']=True;added.append(name);return obj
def pole(c,name,x,y):
    bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.028,depth=4.3,location=(x,y,2.15))
    o=bpy.context.object;o.name=name
    for old in list(o.users_collection):old.objects.unlink(o)
    c.objects.link(o);o.data.materials.append(metal);o['camp_detail']=True;added.append(o.name)
def flag(c,name,x,y,index):
    pole(c,name+'_Pole',x,y)
    verts=[];faces=[];nx,ny=24,9
    for j in range(ny+1):
        for i in range(nx+1):
            u,v=i/nx,j/ny
            verts.append((x+u*1.6,y+.09*math.sin(u*9+v*2)*u,3.1+v*.9))
    for j in range(ny):
        for i in range(nx):
            a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
    o=mesh_obj(c,name+'_Flag',verts,faces,fabric[index%len(fabric)])
    for k in (2,5):o.data.materials.append(fabric[(index+k)%len(fabric)])
    uv=o.data.uv_layers.new(name='FlagPhotoUV')
    for poly in o.data.polygons:
        poly.material_index=(poly.index//nx)//3
        poly.use_smooth=True
        for loop in poly.loop_indices:
            vertex=o.data.loops[loop].vertex_index
            uv.data[loop].uv=(vertex%(nx+1)/nx,vertex//(nx+1)/ny)
    o['replace_with_photo']=True;o['flag_placeholder']='Geometric stripes; no invented real camp identity'

# Existing obstacle bounds follow the user's edited object transforms.
bpy.context.view_layer.update()
obstacles=[]
for obj in scene.objects:
    if obj.instance_type!='COLLECTION':continue
    low,high=template_bounds(obj.instance_collection)
    pts=[obj.matrix_world@Vector((x,y,z)) for x in (low.x,high.x) for y in (low.y,high.y) for z in (low.z,high.z)]
    obstacles.append((min(p.x for p in pts),max(p.x for p in pts),min(p.y for p in pts),max(p.y for p in pts)))

def free(cx,cy,half):
    return not any(cx+half>a and cx-half<b and cy+half>c and cy-half<d for a,b,c,d in obstacles)

for index,plot in enumerate(p for p in data['plots'] if p['id']!='Camp'):
    guide=scene.objects.get('Plot_'+plot['id'])
    cx=guide.location.x if guide else (plot['minX']+plot['maxX'])/2
    cy=guide.location.y if guide else -(plot['minZ']+plot['maxZ'])/2
    rng=random.Random(20261004+index)
    c=group('Life_'+plot['id']);theme=index%3
    candidates=[(cx+dx,cy+dy) for dx,dy in ((-3,2),(3,-2),(0,0),(-5,-4),(5,4),(0,6),(0,-6))]
    anchor=next(((x,y) for x,y in candidates if free(x,y,3.8)),None)
    if not anchor:
        warnings.append(plot['id']+': no clear shared courtyard; skipped to preserve edited geometry')
        continue
    ax,ay=anchor
    table='BlenderKitSmallTable' if kit_table and theme==1 else 'props/camp_table_messy.glb'
    prop(c,plot['id']+'_Table',table,ax,ay,.62 if theme==1 else .72,rng.random()*.3)
    if theme!=1:prop(c,plot['id']+'_Canopy','props/tarp_canopy.glb',ax,ay,2.1)
    for chair in range(4+(index%2)):
        angle=chair*math.tau/(4+(index%2))+.25
        x,y=ax+math.cos(angle)*2,ay+math.sin(angle)*2
        prop(c,plot['id']+f'_Chair_{chair}','props/festival_folding_chair.glb',x,y,.82,angle-math.pi/2)
    for label,path,dx,dy,h in (
        ('Cooler','props/cooler_box.glb',2.8,1.2,.38),
        ('Water','props/water_jug_5l.glb',-2.7,-1.4,.36),
        ('Backpack','props/festival_backpack.glb',2.6,-1.5,.65),
        ('Crate','props/beer_crate.glb',-2.8,.6,.32)):
        prop(c,plot['id']+'_'+label,path,ax+dx,ay+dy,h,rng.random()*math.tau)
    if theme==2:prop(c,plot['id']+'_Guitar','props/acoustic_guitar.glb',ax+1,ay+1.1,.98,.4)
    # Second small pocket, never inside existing tents or roads.
    rest=next(((cx+dx,cy+dy) for dx,dy in ((6,-6),(-6,6),(6,6),(-6,-6))
               if free(cx+dx,cy+dy,2.3) and math.hypot(cx+dx-ax,cy+dy-ay)>7),None)
    if rest:
        rx,ry=rest
        mesh_obj(c,plot['id']+'_PicnicBlanket',[(rx-1.2,ry-.85,.035),(rx+1.2,ry-.85,.035),
                 (rx+1.2,ry+.85,.035),(rx-1.2,ry+.85,.035)],[(0,1,2,3)],cloth)
        prop(c,plot['id']+'_RestBackpack','props/festival_backpack.glb',rx+1.5,ry,.65)
        prop(c,plot['id']+'_RestSeat','props/pallet_seating.glb',rx,ry+1.55,.7)
    flagpoint=next(((cx+dx,cy+dy) for dx,dy in ((8,8),(-8,8),(8,-8),(-8,-8)) if free(cx+dx,cy+dy,1)),None)
    if flagpoint:flag(c,plot['id'],*flagpoint,index)
    else:warnings.append(plot['id']+': no clear flag position')

# Check every pre-existing object, including user-edited positions and cameras.
for name,matrix in before.items():
    obj=scene.objects.get(name)
    if not obj or tuple(v for row in obj.matrix_basis for v in row)!=matrix:
        raise RuntimeError('Existing object changed: '+name)
for obj in scene.objects:obj.select_set(False)
scene['camp_details_version']='20261004-v1'
scene['camp_details_note']='Generic camps only; editable placeholder flags; no runtime migration'
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
report={'addedObjects':len(added),'existingTransformsPreserved':len(before),'backup':str(BACKUP),
        'blenderKitAssets':cached_assets,'warnings':warnings,'runtimeMigration':False}
REPORT.write_text(json.dumps(report,indent=2),encoding='utf-8')
scene.render.resolution_x=1600;scene.render.resolution_y=1000
scene.render.filepath=str(ROOT/'blender/festival-camps-overview.png')
bpy.ops.render.render(write_still=True)
# Detailed courtyard render; camera edits are not saved into the user's project.
guide=scene.objects.get('Plot_N1-2')
if guide and scene.camera:
    target=guide.location+Vector((0,0,1));scene.camera.location=target+Vector((28,-34,28))
    scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=42
    scene.render.filepath=str(ROOT/'blender/festival-camp-detail.png')
    bpy.ops.render.render(write_still=True)
print(json.dumps(report))
