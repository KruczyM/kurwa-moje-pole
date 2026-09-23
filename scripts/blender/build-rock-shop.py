"""Original modular hall prototype from the official Rock Shop facade reference.

Dimensions are estimates, not surveyed measurements. No reference photo is embedded.
"""
import importlib.util
import math
from pathlib import Path
import bpy

SPEC=importlib.util.spec_from_file_location('tent_tools',Path(__file__).with_name('build-festival-tents.py'))
T=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(T)
U=T.U
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/game-assets/world/festival/lidlRockShop.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
maps=U.weave_maps()
white=T.canvas('Hall_PVC_White',(.76,.77,.74),maps)
blue=T.canvas('RockShop_Blue_Fascia',(.018,.24,.41),maps)
steel=U.material('Hall_Aluminium',(.45,.48,.5),.36)
steel.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=.7
rubber=U.material('Window_Seals',(.025,.028,.03),.9)
glass=U.material('Shopfront_Glass',(.39,.52,.52),.18)
glass.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value=.24
glass.surface_render_method='DITHERED'
floor=U.material('RockShop_Floor',(.27,.29,.27),.93)
ink=U.material('Sign_White',(.92,.92,.88),.8)
yellow=U.material('Sign_Yellow',(.96,.64,.015),.8)
red=U.material('Sign_Red',(.7,.025,.035),.8)
logo_blue=U.material('Sign_Blue',(.015,.05,.3),.8)
green=U.material('Sunflower_Stems',(.12,.22,.015),.9)
seeds=U.material('Sunflower_Seeds',(.09,.04,.014),.95)

def box(name,center,size,material):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center)
    obj=bpy.context.object
    obj.name=name
    obj.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(material)
    U.cloth_detail_uv(obj,1)
    return obj

def bar(name,a,b,r=.045):
    return T.tube(name,[a,b],r,steel)

# 24 x 18 m exhibition hall: repeated portals, ridge beam and bracing.
for index,y in enumerate((-9,-6,-3,0,3,6,9)):
    for side in (-1,1):
        bar(f'Portal_{index}_{side}',(side*12,y,.08),(side*12,y,3.6),.075)
        bar(f'Rafter_{index}_{side}',(side*12,y,3.6),(0,y,7),.065)
        bar(f'Knee_Brace_{index}_{side}',(side*12,y,2.7),(side*9.4,y,4.34),.04)
    bar(f'Tie_{index}',(-12,y,3.6),(12,y,3.6),.025)
bar('Ridge',(0,-9,7),(0,9,7),.055)
for side in (-1,1):
    bar('Eave',(side*12,-9,3.6),(side*12,9,3.6),.055)
    # Slight membrane sag between 3 m portal bays, plus sewn panel seams.
    points=[]
    for j in range(73):
        y=-9+j*.25
        for i in range(25):
            x=side*i*.5
            sag=.025*math.sin((y+9)*math.pi/3)**2*math.sin(i*math.pi/24)
            points.append((x,y,7-abs(x)*3.4/12-sag+.015))
    faces=[(j*25+i,j*25+i+1,(j+1)*25+i+1,(j+1)*25+i) for j in range(72) for i in range(24)]
    T.mesh(f'Roof_{side}',points,faces,white,True,density=1)
    for y in (-6,-3,0,3,6):
        T.tube('Roof_Seam',[(side*x,y,7-x*3.4/12+.022) for x in range(13)],.008,white)
    T.quad('Side_Wall',[(side*12,-9,.08),(side*12,9,.08),(side*12,9,3.6),(side*12,-9,3.6)],white)
    for y in (-9,6):
        bar('Side_X_Brace',(side*11.97,y,.15),(side*11.97,y+3,3.5),.024)
        bar('Side_X_Brace',(side*11.97,y,3.5),(side*11.97,y+3,.15),.024)
T.mesh('Rear_Wall',[(-12,9,.08),(12,9,.08),(12,9,3.6),(0,9,7),(-12,9,3.6)],[(0,1,2,3,4)],white)
T.mesh('Front_Fascia',[(-12,-9.01,3.6),(12,-9.01,3.6),(0,-9.01,7)],[(0,1,2)],blue)
box('RockShop_Floor',(0,0,.045),(24,18,.08),floor)

# Glass frontage, two unobstructed door bays and rolled canvas above them.
door_bays={2,5}
for i in range(8):
    x=-12+i*3
    bar('Front_Mullion',(x,-9.04,.1),(x,-9.04,3.58),.045)
    if i not in door_bays:
        T.quad('Glazed_Panel',[(x+.06,-9.035,.14),(x+2.94,-9.035,.14),(x+2.94,-9.035,3.45),(x+.06,-9.035,3.45)],glass)
        bar('Window_Transom',(x,-9.05,1.15),(x+3,-9.05,1.15),.026)
    else:
        T.tube('Rolled_Entrance',[(x+.08,-9.14,3.47),(x+2.92,-9.14,3.47)],.11,white)
        for jamb in (x+.04,x+2.96):
            box('Door_Seal',(jamb,-9.09,1.65),(.055,.05,3.2),rubber)
        box('Entrance_Mat',(x+1.5,-9.45,.04),(2.8,1.1,.025),rubber)
bar('Front_Mullion',(12,-9.04,.1),(12,-9.04,3.58),.045)
bar('Front_Head',(-12,-9.05,3.52),(12,-9.05,3.52),.04)

# Original vector/mesh lettering and emblem, not photographs copied into textures.
font_path=Path('C:/Windows/Fonts/arialbd.ttf')
font=bpy.data.fonts.load(str(font_path)) if font_path.exists() else None
def label(text,x,z,size,mat):
    curve=bpy.data.curves.new('Lettering_'+text,'FONT')
    curve.body=text
    curve.size=size
    curve.extrude=.002
    curve.resolution_u=4
    if font:
        curve.font=font
    obj=bpy.data.objects.new('Lettering_'+text,curve)
    bpy.context.collection.objects.link(obj)
    obj.location=(x,-9.15,z)
    obj.rotation_euler.x=math.pi/2
    curve.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.object.convert(target='MESH')
    U.cloth_detail_uv(bpy.context.object,1)

box('Logo_Backplate',(-4.9,-9.065,4.7),(1.92,.035,1.92),logo_blue)
def disc(name,x,y,z,r,mat):
    vertices=[(x,y,z)]+[(x+r*math.cos(i*math.tau/64),y,z+r*math.sin(i*math.tau/64)) for i in range(64)]
    return T.mesh(name,vertices,[(0,1+i,1+(i+1)%64) for i in range(64)],mat)
disc('Logo_Red_Rim',-4.9,-9.09,4.7,.88,red)
disc('Logo_Yellow',-4.9,-9.10,4.7,.82,yellow)
label('LIDL',-5.61,4.48,.58,logo_blue)
label('Rock',-2.9,5.05,1.06,ink)
label('Shop',-2.9,3.98,1.06,ink)
for x,z,r in ((3.4,4.9,.43),(4.4,5.25,.49),(5.35,4.75,.4)):
    T.tube('Sunflower_Stem',[(x,-9.07,z),(x+.15,-9.07,3.88)],.025,green)
    for i in range(14):
        a=i*math.tau/14
        cx,cz=x+math.cos(a)*r*.9,z+math.sin(a)*r*.9
        petal=[]
        for j in range(10):
            t=j*math.tau/10
            long=r*.55*math.cos(t);short=r*.18*math.sin(t)
            petal.append((cx+long*math.cos(a)-short*math.sin(a),-9.12,cz+long*math.sin(a)+short*math.cos(a)))
        T.mesh('Sunflower_Petal',petal,[tuple(range(10))],yellow)
    disc('Sunflower_Centre',x,-9.135,z,r*.48,seeds)

# Sparse interior silhouettes: no gameplay shop/inventory interaction is implied.
for x in (-8,-2,4,9):
    for y in (-3,2,6):
        box('Shelf_Base',(x,y,.15),(1.4,2,.2),steel)
        for z in (.5,1.0,1.5):
            box('Shelf',(x,y,z),(1.4,2,.035),steel)
        for dx in (-.65,.65):
            bar('Shelf_Upright',(x+dx,y,.2),(x+dx,y,1.65),.022)
T.batch_by_material()
root=bpy.data.objects.new('Lidl_Rock_Shop',None)
bpy.context.collection.objects.link(root)
for obj in list(bpy.context.scene.objects):
    if obj!=root and obj.parent is None:
        obj.parent=root
root['festivalLandmark']='lidlRockShop'
root['referenceStatus']='Official article facade reference; estimated dimensions; original artwork'
root['units']='metres'
OUT.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',export_extras=True,export_animations=False)
U.finalize_gltf(OUT)
print('ROCK_SHOP',OUT.stat().st_size)
