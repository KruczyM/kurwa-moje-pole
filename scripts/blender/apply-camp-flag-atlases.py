"""Apply supplied 2x2 flag atlases without resampling or moving camp scenery."""
import hashlib
import json
import math
import shutil
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
FILE = ROOT / 'blender/festival-layout.blend'
INPUT = Path('C:/Users/krucz/OneDrive/Pulpit/flagi')
TEXTURES = ROOT / 'public/game-assets/textures/camp-flags'
REPORT = ROOT / 'reports/festival-blender/camp-flags.json'
files = sorted(INPUT.glob('*.png'))
assert len(files) == 10, 'Expected ten supplied four-design atlases'
bpy.ops.wm.open_mainfile(filepath=str(FILE))
scene = bpy.context.scene
bpy.context.preferences.filepaths.save_version = 0
backup = ROOT / 'blender/backups/festival-layout-before-photo-flags.blend'
if not backup.exists():
    shutil.copy2(FILE, backup)
before = {o.name: tuple(v for row in o.matrix_basis for v in row) for o in scene.objects}
TEXTURES.mkdir(parents=True, exist_ok=True)
materials = []
for index, source in enumerate(files):
    target = TEXTURES / f'atlas-{index + 1:02}.png'
    shutil.copy2(source, target)
    image = bpy.data.images.load(str(target), check_existing=True)
    image.colorspace_settings.name = 'sRGB'
    material = bpy.data.materials.get(f'CampFlagAtlas_{index:02}') or bpy.data.materials.new(f'CampFlagAtlas_{index:02}')
    material.use_nodes = True
    material.node_tree.nodes.clear()
    nodes, links = material.node_tree.nodes, material.node_tree.links
    output = nodes.new('ShaderNodeOutputMaterial')
    shader = nodes.new('ShaderNodeBsdfPrincipled')
    shader.inputs['Roughness'].default_value = .9
    texture = nodes.new('ShaderNodeTexImage')
    texture.image = image
    texture.extension = 'EXTEND'
    links.new(texture.outputs['Color'], shader.inputs['Base Color'])
    links.new(shader.outputs['BSDF'], output.inputs['Surface'])
    material.use_backface_culling = False
    materials.append(material)

def bounds(collection):
    points = [o.matrix_world @ Vector(p) for o in collection.all_objects if o.type == 'MESH' for p in o.bound_box]
    return Vector([min(p[i] for p in points) for i in range(3)]), Vector([max(p[i] for p in points) for i in range(3)])

bpy.context.view_layer.update()
main = scene.objects['CampFlag']
instance = next(c for c in main.children if c.instance_collection)
low, high = bounds(instance.instance_collection)
main_points = [instance.matrix_world @ Vector((x, y, z)) for x in (low.x, high.x) for y in (low.y, high.y) for z in (low.z, high.z)]
main_height = max(p.z for p in main_points) - min(p.z for p in main_points)
height = main_height * .92
assert height > 4.3, f'Main flag measurement unexpected: {main_height}'
obstacles = []
for o in scene.objects:
    if o.instance_type != 'COLLECTION':
        continue
    lo, hi = bounds(o.instance_collection)
    points = [o.matrix_world @ Vector((x, y, z)) for x in (lo.x, hi.x) for y in (lo.y, hi.y) for z in (lo.z, hi.z)]
    obstacles.append((min(p.x for p in points), max(p.x for p in points), min(p.y for p in points), max(p.y for p in points)))

def free(x, y):
    return not any(x + .4 > a and x - .4 < b and y + .4 > c and y - .4 < d for a, b, c, d in obstacles)

records = []
changed = set()
camps = sorted((c for c in bpy.data.collections if c.name.startswith('Life_')), key=lambda c: c.name)
assert len(camps) == 12
for camp_index, camp in enumerate(camps):
    camp_id = camp.name.removeprefix('Life_')
    existing = next(o for o in camp.objects if o.name == camp_id + '_Flag')
    pole = scene.objects[camp_id + '_Pole']
    points = [(pole.location.x, pole.location.y)]
    guide = scene.objects['Plot_' + camp_id]
    cx, cy = guide.location.x, guide.location.y
    count = 4 if camp_index < 4 else 3
    candidates = [(cx + dx, cy + dy) for dx, dy in ((-8,8),(8,8),(-8,-8),(8,-8),(-8,4),(8,-4),(-4,8),(4,-8),(-8,0),(8,0),(0,8),(0,-8))]
    for x, y in candidates:
        if len(points) == count:
            break
        if free(x,y) and all(math.hypot(x-a,y-b) > 3.5 for a,b in points):
            points.append((x,y))
    assert len(points) == count, 'No safe flag locations: ' + camp_id
    for flag_index, (x,y) in enumerate(points):
        variant = len(records)
        name = camp_id if flag_index == 0 else f'{camp_id}_Extra{flag_index}'
        flag = existing if flag_index == 0 else scene.objects.get(name + '_Flag')
        if flag is None:
            flag = bpy.data.objects.new(name + '_Flag', bpy.data.meshes.new(name + '_FlagMesh'))
            camp.objects.link(flag)
        flag_pole = pole if flag_index == 0 else scene.objects.get(name + '_Pole')
        if flag_pole is None:
            flag_pole = pole.copy()
            flag_pole.data = pole.data.copy()
            camp.objects.link(flag_pole)
            flag_pole.name = name + '_Pole'
        flag_pole.location = (x,y,height / 2)
        flag_pole.dimensions.z = height
        flag_pole['camp_detail'] = True
        flag_pole['campFlagPole'] = True
        changed.update((flag.name, flag_pole.name))
        nx, ny = 24, 9
        width = 2.8
        cloth_height = width / 3.1
        vertices = [(x + i/nx*width, y + .12*math.sin(i/nx*9+j/ny*2)*i/nx,
                     height - .2 - cloth_height + j/ny*cloth_height) for j in range(ny+1) for i in range(nx+1)]
        faces = []
        for j in range(ny):
            for i in range(nx):
                a = j*(nx+1)+i
                faces.append((a,a+1,a+nx+2,a+nx+1))
        mesh = bpy.data.meshes.new(name + '_PhotoCloth')
        mesh.from_pydata(vertices, [], faces)
        mesh.materials.append(materials[variant//4])
        flag.data = mesh
        uv = mesh.uv_layers.new(name='FlagPhotoUV')
        col, row = variant%2, (variant%4)//2
        u0, u1 = ((.003,.493) if col == 0 else (.507,.997))
        top, bottom = ((.005,.470) if row == 0 else (.505,.962))
        for polygon in mesh.polygons:
            polygon.use_smooth = True
            for loop in polygon.loop_indices:
                v = mesh.loops[loop].vertex_index
                u, t = v%(nx+1)/nx, v//(nx+1)/ny
                uv.data[loop].uv = (u0 + u*(u1-u0), 1-bottom + t*(bottom-top))
        flag['camp_detail'] = True
        flag['replace_with_photo'] = False
        flag['campFlagDesign'] = variant
        flag['campFlagCamp'] = camp_id
        if 'flag_placeholder' in flag:
            del flag['flag_placeholder']
        records.append({'object':flag.name, 'pole':flag_pole.name, 'camp':camp_id, 'design':variant, 'height':height,
                        'position':[x,y], 'uvRect':[u0,1-bottom,u1,1-top]})

for name, transform in before.items():
    if name not in changed:
        assert tuple(v for row in scene.objects[name].matrix_basis for v in row) == transform, name
assert len(records) == 40
scene['camp_details_note'] = 'Supplied photo flag atlases; generic camps; runtime export enabled'
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
REPORT.write_text(json.dumps({'flags':records,'mainFlagHeight':main_height,'genericPoleHeight':height,
    'preservedTransforms':len(before)-len(changed & before.keys()), 'atlases':[{'file':f'atlas-{i+1:02}.png','source':p.name,
    'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for i,p in enumerate(files)]},indent=2),encoding='utf-8')
print(json.dumps({'flags':len(records),'camps':len(camps),'mainHeight':main_height,'genericHeight':height}))
