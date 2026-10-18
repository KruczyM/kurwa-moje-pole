"""Build a standalone, packed Blender authoring scene; no runtime export."""
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
DATA = json.loads((ROOT/'reports/festival-blender/layout.json').read_text(encoding='utf-8'))
OUT = ROOT/'blender'
OUT.mkdir(exist_ok=True)
if (OUT/'festival-layout.blend').exists() and '--replace' not in sys.argv:
    raise RuntimeError('Existing project: preserve manual edits or explicitly pass -- --replace')
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.context.preferences.filepaths.save_version = 0
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
scene['purpose'] = 'Standalone festival authoring scene; NOT migrated into the game'
scene['layout_source'] = 'reports/festival-blender/layout.json'
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x,scene.render.resolution_y = 1600,1000
scene.render.resolution_percentage = 100
collections = {}
def collection(name):
    if name not in collections:
        c = bpy.data.collections.new(name)
        scene.collection.children.link(c)
        collections[name] = c
    return collections[name]

def material(name,color):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=.9
    return m

grass=material('Meadow',(0.13,.24,.055))
asphalt=material('Asphalt',(.075,.08,.085))
pathmat=material('Camp paths',(.31,.29,.22))
soil=material('Sunflower soil',(.12,.075,.035))
def terrain_texture(mat,path):
    nodes=mat.node_tree.nodes;links=mat.node_tree.links
    image=nodes.new('ShaderNodeTexImage');image.image=bpy.data.images.load(str(ROOT/'public/game-assets'/path))
    coord=nodes.new('ShaderNodeTexCoord');scale=nodes.new('ShaderNodeVectorMath');scale.operation='SCALE';scale.inputs[3].default_value=.2
    links.new(coord.outputs['Object'],scale.inputs[0]);links.new(scale.outputs['Vector'],image.inputs['Vector'])
    links.new(image.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])
terrain_texture(grass,'textures/grass/color.jpg')
terrain_texture(asphalt,'textures/asphalt/Asphalt012_1K-JPG_Color.jpg')
def plane(name,x,z,w,d,height,mat,category='Terrain'):
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata([(-w/2,-d/2,0),(w/2,-d/2,0),(w/2,d/2,0),(-w/2,d/2,0)],[],[(0,1,2,3)])
    obj=bpy.data.objects.new(name,mesh);collection(category).objects.link(obj)
    obj.location=(x,-z,height);mesh.materials.append(mat)
    return obj
plane('Festival_Ground_520m',0,0,DATA['worldSize'],DATA['worldSize'],-.04,grass)
for i,r in enumerate(DATA['roads']):
    plane('Road_'+str(i),(r['minX']+r['maxX'])/2,(r['minZ']+r['maxZ'])/2,
          r['maxX']-r['minX'],r['maxZ']-r['minZ'],.01,asphalt,'Roads')
for i,r in enumerate(DATA['paths']):
    plane('Camp_path_'+str(i),(r['minX']+r['maxX'])/2,(r['minZ']+r['maxZ'])/2,
          r['maxX']-r['minX'],r['maxZ']-r['minZ'],.005,pathmat,'Roads')

# Keep template collections outside the scene hierarchy. Collection instances
# share all geometry/materials but remain individually movable in the layout.
templates={}
sources={}
palette_templates={}
def template(path,selector=None):
    key=(path,tuple(selector) if selector else None)
    if key in templates:return templates[key]
    if path not in sources:
        before=set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/game-assets'/path))
        sources[path]=[o for o in bpy.data.objects if o not in before]
    objects=sources[path]
    if selector:
        matches=[o for o in objects if o.get(selector[0])==selector[1]]
        if len(matches)!=1:raise RuntimeError(f'Missing/ambiguous template {key}: {len(matches)}')
        root=matches[0]; keep={root,*root.children_recursive}
        root.parent=None;root.matrix_parent_inverse=Matrix.Identity(4);root.location=(0,0,0);root.rotation_euler=(0,0,0)
    else:
        keep=set(objects)
    bpy.context.view_layer.update()
    points=[o.matrix_world@Vector(v) for o in keep if o.type=='MESH' for v in o.bound_box]
    c=bpy.data.collections.new('Asset_'+Path(path).stem+('_'+selector[1] if selector else ''))
    for o in objects:
        if o not in keep:
            continue
        if o.animation_data:o.animation_data_clear()
        for old in list(o.users_collection):old.objects.unlink(o)
        c.objects.link(o)
    bpy.context.view_layer.update()
    if not points:raise RuntimeError(f'Empty asset {key}')
    low=Vector([min(p[i] for p in points) for i in range(3)])
    high=Vector([max(p[i] for p in points) for i in range(3)])
    templates[key]=(c,low,high)
    return templates[key]

count=0
def place(item):
    global count
    c,low,high=template(item['path'],item.get('selector'))
    if item.get('palette'):
        key=(c.name,item['palette'])
        if key not in palette_templates:
            variant=bpy.data.collections.new(c.name+'_'+item['palette'])
            copies={o:o.copy() for o in c.objects}
            materials={}
            for original,copy in copies.items():
                variant.objects.link(copy)
                if original.parent in copies:copy.parent=copies[original.parent]
                if copy.type=='MESH':
                    for slot in copy.material_slots:
                        source=slot.material
                        role=source.get('tentFabricRole') if source else None
                        if role not in ('fly','accent'):continue
                        if source not in materials:
                            m=source.copy();color=DATA['palettes'][item['palette']][role].lstrip('#')
                            rgb=tuple((int(color[i:i+2],16)/255)**2.2 for i in (0,2,4))
                            m.diffuse_color=(*rgb,1)
                            if m.use_nodes:m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*rgb,1)
                            materials[source]=m
                        slot.link='OBJECT';slot.material=materials[source]
            palette_templates[key]=variant
        c=palette_templates[key]
    size=high-low;s=Vector((1,1,1));offset=Vector((0,0,-low.z))
    if item.get('size'):
        target=item['size'];desired=Vector((target[0],target[2],target[1]))
        if item['fit']=='exact-source-correction':s=Vector([desired[i]/max(size[i],1e-6) for i in range(3)])
        else:
            factor=desired.z/max(size.z,1e-6) if item['fit']=='uniform-height' else min(desired[i]/max(size[i],1e-6) for i in range(3))
            s=Vector((factor,)*3)
        if item['fit']=='uniform-volume':offset.x=-(low.x+high.x)/2;offset.y=-(low.y+high.y)/2
    elif item.get('height'):s=Vector((item['height']/max(size.z,1e-6),)*3)
    parent=bpy.data.objects.new(item['id'],None);collection(item['category']).objects.link(parent)
    parent.location=(item['x'],-item['z'],item.get('elevation',0)+item.get('offset',0))
    parent.rotation_euler.z=item.get('rotationY',0)
    parent.empty_display_size=.5;parent['asset_path']=item['path'];parent['placement_id']=item['id']
    obj=bpy.data.objects.new(item['id']+'_Model',None);collection(item['category']).objects.link(obj)
    obj.instance_type='COLLECTION';obj.instance_collection=c;obj.parent=parent;obj.scale=s
    obj.location=Vector([offset[i]*s[i] for i in range(3)])
    count+=1
    return parent

for item in DATA['items']:place(item)
# Remove unused preview-library variants from the visible scene, without
# deleting data referenced by template instances.
for imported in sources.values():
    for obj in imported:
        for old in list(obj.users_collection):
            if not old.name.startswith('Asset_'):old.objects.unlink(obj)
b=DATA['sunflowerField']
plane('Sunflower_bed',(b['minX']+b['maxX'])/2,(b['minZ']+b['maxZ'])/2,
      b['maxX']-b['minX'],b['maxZ']-b['minZ'],.007,soil,'Sunflowers')
for ix in range(0,int(b['maxX']-b['minX']),2):
    for iz in range(0,int(b['maxZ']-b['minZ']),2):
        place({'id':f'Sunflower_{ix}_{iz}','path':b['path'],'category':'Sunflowers',
               'x':b['minX']+ix+.7,'z':b['minZ']+iz+.7,'height':1.65+(ix%3)*.1,'rotationY':ix*.37+iz*.29})

# Edit guides do not render and are not part of runtime geometry.
for r in DATA['plots']:
    o=bpy.data.objects.new('Plot_'+r['id'],None);collection('Guides').objects.link(o)
    o.empty_display_type='CUBE';o.location=((r['minX']+r['maxX'])/2,-(r['minZ']+r['maxZ'])/2,.25)
    o.scale=((r['maxX']-r['minX'])/2,(r['maxZ']-r['minZ'])/2,.25);o.hide_render=True

sun=bpy.data.lights.new('Daylight','SUN');sun.energy=2.3
o=bpy.data.objects.new('Daylight',sun);collection('Lighting').objects.link(o);o.rotation_euler=(.6,-.3,-.5)
scene.world=bpy.data.worlds.new('Festival sky');scene.world.color=(.28,.35,.45)
camdata=bpy.data.cameras.new('Overview');camdata.type='ORTHO';camdata.ortho_scale=440
cam=bpy.data.objects.new('Overview',camdata);collection('Cameras').objects.link(cam)
cam.location=(310,370,360);cam.rotation_euler=(Vector((35,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
scene.view_settings.view_transform='AgX'
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_distance=400
        area.spaces.active.region_3d.view_location=(25,0,0)
        area.spaces.active.clip_end=2000
bpy.data.orphans_purge(do_recursive=True)
bpy.ops.file.pack_all()
scene['placement_count']=count
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'festival-layout.blend'))
report={'placements':count,'templates':len(templates),'missingProps':DATA['missingProps'],
        'blend':str(OUT/'festival-layout.blend'),'runtimeMigrated':False}
(ROOT/'reports/festival-blender/build-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
scene.render.filepath=str(OUT/'festival-overview.png')
bpy.ops.render.render(write_still=True)
print(json.dumps(report))
