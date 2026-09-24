"""Photo-led large SiemaShop hall; original decorative artwork, estimated dimensions."""
import math
from pathlib import Path
import bpy


def front_banner(T, U, photo_path=None, source_photo=False):
    """One UV-mapped gable, ready for a rectified photograph (not a scene screenshot)."""
    material = U.material('SiemaShop_Front_Banner', (.025, .03, .035), .85)
    if photo_path:
        source = Path(photo_path).resolve(strict=True)
        if source.suffix.lower() not in ('.png', '.jpg', '.jpeg'):
            raise ValueError('Front banner must be a rectified PNG or JPEG.')
        image = bpy.data.images.load(str(source), check_existing=False)
        if min(image.size) <= 0 or max(image.size) > 4096:
            raise ValueError('Front banner must be a valid image, at most 4096 pixels per edge.')
        image.name = 'SiemaShop_Front_Photo'
        material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (1, 1, 1, 1)
    else:
        material['tentBaseColorLinear'] = [.025, .03, .035]
        image = bpy.data.images.new('SiemaShop_Front_Placeholder', width=1, height=1)
        image.generated_color = (1, 1, 1, 1)
    image.colorspace_settings.name = 'sRGB'
    image.pack()
    node = U.texture_node(material, image, 'TentDetail')
    node.extension = 'EXTEND'
    material.node_tree.links.new(node.outputs['Color'], material.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    vertices = [
        (-12, -9.025, 3.18), (12, -9.025, 3.18), (12, -9.025, 3.6),
        (0, -9.025, 7), (-12, -9.025, 3.6),
    ]
    faces = [(0, 1, 2, 3, 4)]
    if source_photo:
        vertices.append((0,-9.025,3.18))
        faces=[(0,5,3,4),(5,1,2,3)]
    panel = T.mesh('SiemaShop_Front_Print', vertices, faces, material)
    uv = panel.data.uv_layers['TentDetail']
    for loop in panel.data.loops:
        point = panel.data.vertices[loop.vertex_index].co
        uv.data[loop.index].uv = ((point.x + 12) / 24, (point.z - 3.18) / 3.82)
        if source_photo:
            # Native UV projection of the visible gable: unchanged source pixels.
            # Right edge is cropped in the supplied photo, so this is not a measured rectification.
            points=[(179,811),(1918,742),(1918,607),(812,390),(179,789),(812,783)]
            px,py=points[loop.vertex_index]
            uv.data[loop.index].uv=(px/1920,1-py/1280)
    panel['frontUVMode']='source-photo-visible-crop' if source_photo else 'rectified'
    panel['siemaShopFront'] = True
    return panel


def build(T, U, root, cloth, metal, floor, dark, white, box, bar, label, photo_path=None, source_photo=False):
    before = set(bpy.context.scene.objects)
    root['marketArchitecture'] = 'largeHall'
    root['frontArtwork'] = 'rectified-photo' if photo_path else 'placeholder-awaiting-photo'
    if source_photo: root['frontArtwork']='user-photo-UV-visible-crop'
    glass = U.material('SiemaShop_Glass', (.2, .27, .3), .22)
    glass.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = .25
    glass.surface_render_method = 'DITHERED'
    palette = [U.material('SiemaShop_Pop_'+str(i), c, .8) for i, c in enumerate([
        (.95,.06,.23),(.95,.65,.025),(.025,.47,.6),(.2,.65,.055),(.36,.035,.55)])]
    box('SiemaShop_Floor',(0,0,.04),(24,18,.07),floor)
    for y in (-9,-6,-3,0,3,6,9):
        for side in (-1,1):
            bar('SiemaShop_Post',(side*12,y,.06),(side*12,y,3.55),.065)
            bar('SiemaShop_Rafter',(side*12,y,3.55),(0,y,6.9),.055)
    for side in (-1,1):
        T.quad('SiemaShop_Roof',[(0,-9,7),(side*12,-9,3.6),(side*12,9,3.6),(0,9,7)],cloth)
        T.quad('SiemaShop_Side',[(side*12,-9,.09),(side*12,9,.09),(side*12,9,3.6),(side*12,-9,3.6)],cloth)
    T.mesh('SiemaShop_Rear',[(-12,9,.08),(12,9,.08),(12,9,3.6),(0,9,7),(-12,9,3.6)],[(0,1,2,3,4)],cloth)
    front_banner(T, U, photo_path, source_photo)
    # Colourful, original pop-art ribbons clipped to the gabled banner.
    for i in range(0 if photo_path else 60):
        x0=-12+i*.4
        for j in range(9):
            z=3.2+j*.4
            points=[]
            for k in range(9):
                x=x0+k*.05
                h=z+.09*math.sin(x*3+j*1.7)
                if h < 6.96-abs(x)*3.4/12: points.append((x,-9.055,h))
            if len(points)>1: T.tube('SiemaShop_Print_Ribbon',points,.075,palette[(i*3+j)%len(palette)])
    # Two genuinely open entrance bays and glazed front panels.
    for i in range(8):
        x=-12+3*i
        bar('SiemaShop_Front_Frame',(x,-9.08,.06),(x,-9.08,3.2),.04)
        if i not in (2,5):
            T.quad('SiemaShop_Window',[(x+.06,-9.06,.15),(x+2.94,-9.06,.15),(x+2.94,-9.06,3.1),(x+.06,-9.06,3.1)],glass)
        else:
            box('SiemaShop_Entrance_Header',(x+1.5,-9.12,3.05),(2.9,.08,.35),white)
            label('WEJSCIE',(x+1.5,-9.18,2.94),.24,dark)
    bar('SiemaShop_Front_Frame',(12,-9.08,.06),(12,-9.08,3.2),.04)
    if not photo_path:
        box('SiemaShop_Sign',(-4.2,-9.14,4.35),(3.5,.06,2.1),dark)
        label('SIEMA',(-4.2,-9.19,4.52),.78,white)
        label('SHOP',(-4.2,-9.19,3.7),.85,white)
        box('Festival_Sign',(2,-9.14,4.38),(7.7,.06,1.5),dark)
        label("Pol'and'Rock",(2,-9.19,4.28),1.04,white)
        label('FESTIVAL',(2,-9.19,3.85),.32,white)
    for x in (-8,-2,4,9):
        box('SiemaShop_Sales_Counter',(x,-5,.95),(3.4,.8,1.8),white)
        for y in (0,4):
            bar('SiemaShop_Rail',(x-1.5,y,1.9),(x+1.5,y,1.9),.025)
            for i in range(7):
                dx=x-1.3+i*.4
                box('SiemaShop_Merch',(dx,y,1.4),(.3,.12,.7),palette[i%5])
    for obj in set(bpy.context.scene.objects)-before: obj.parent=root
