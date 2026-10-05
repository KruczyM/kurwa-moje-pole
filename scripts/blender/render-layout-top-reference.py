"""Read-only, metric top view of the user's saved festival layout."""
from pathlib import Path
import json
import hashlib
import bpy
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'blender/festival-layout.blend'))
scene=bpy.context.scene
camera=bpy.data.objects.new('QA_TopView',bpy.data.cameras.new('QA_TopView'))
scene.collection.objects.link(camera)
camera.location=(60,0,400)
camera.rotation_euler=(0,0,0)
camera.data.type='ORTHO'
camera.data.ortho_scale=460
camera.data.clip_end=1200
scene.camera=camera
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO'
scene.display.shading.color_type='TEXTURE'
scene.display.shading.background_type='WORLD'
scene.world.color=(0.035,0.065,0.04)
scene.display.shading.show_shadows=False
scene.display.shading.show_cavity=True
scene.render.resolution_x=1600
scene.render.resolution_y=1200
scene.render.resolution_percentage=100
out=ROOT/'reports/festival-blender/top-reference.png'
# The map deliberately excludes the mushroom, without changing the saved world.
for obj in scene.objects:
    if 'grzybek' in str(obj.get('placement_id',obj.name)).lower():
        obj.hide_render=True
scene.render.filepath=str(out)
bpy.ops.render.render(write_still=True)
destination=ROOT/'public/game-assets/world/festival/map-top.png'
destination.parent.mkdir(parents=True,exist_ok=True)
bpy.data.images['Render Result'].save_render(str(destination),scene=scene)

def vertices(obj, transform):
    if obj.type=='MESH':
        yield from (transform @ Vector(p) for p in obj.bound_box)
    if obj.instance_collection:
        offset=Matrix.Translation(-obj.instance_collection.instance_offset)
        for child in obj.instance_collection.all_objects:
            yield from vertices(child, transform @ offset @ child.matrix_world)
    for child in obj.children:
        yield from vertices(child, transform @ child.matrix_local)

items=[]
for obj in scene.objects:
    if obj.parent or any(c.name.startswith('Asset_') for c in obj.users_collection):continue
    category=obj.users_collection[0].name if obj.users_collection else ''
    identity=str(obj.get('placement_id',obj.name))
    if category not in {'Camping','Passage','Roads'} and identity not in {
        'CampFlag','smallStage','Lidl','foh_tower_main','Sunflower_bed','AllegroWheel',
        'Main_Stage_Deck_Plinth'} and obj.name!='Main_Stage_Deck_Plinth' and not identity.startswith(('food_tent_','foodtruck_')):continue
    points=list(vertices(obj,obj.matrix_world))
    if not points:continue
    xs=[p.x for p in points];zs=[-p.y for p in points]
    items.append(dict(id=obj.name if obj.name=='Main_Stage_Deck_Plinth' else identity,
                      category=category,x=(min(xs)+max(xs))/2,z=(min(zs)+max(zs))/2,
                      width=max(xs)-min(xs),depth=max(zs)-min(zs)))
manifest={'bounds':dict(minX=-170,maxX=290,minZ=-172.5,maxZ=172.5),'scenery':items,
          'sourceSha256':hashlib.sha256((ROOT/'blender/festival-layout.blend').read_bytes()).hexdigest()}
destination.with_name('map-layout.json').write_text(json.dumps(manifest),encoding='utf-8')
print(str(out))
