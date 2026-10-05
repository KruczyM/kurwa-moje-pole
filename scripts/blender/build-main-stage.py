"""
Blender script to build the monumental Duża Scena (Main Stage) for Pol'and'Rock Festival.
Faithful to authentic 2026 reference photos:
- 3D Concentric Circular Sunburst Rig ('Słońce Festiwalowe / Oko') with 3 rings, 16 spokes, moving heads
- Arched crested crown roof silhouette with cursive 'Pol'and'Rock', 'TU WSZYSTKO GRA OK!'
- Top roof ridge halogen blinder halo (dense row of 24 fixtures)
- Towering side proscenium columns with jumping rock guitarist artwork
- Natural vertical blonde pine stage skirt with festival town plaques
- Black flight cases / road cases on the grass in front
- Giant left and right IMAG screens with 'PEACE • LOVE • MUSIC' banners
- Curved line array speaker hangs (d&b style)
- Marshall / Ampeg amplifier stacks, drum riser, microphones
"""

import os
import math
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[2]
TEXTURES_DIR = ROOT / "source-assets" / "stages"
OUT_GLB = ROOT / "public" / "game-assets" / "world" / "festival" / "main_stage.glb"
OUT_GLB.parent.mkdir(parents=True, exist_ok=True)

# Clear existing scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Three.js (X, Y up, Z front) -> Blender (X, -Z, Y up)
def t3(x, y, z):
    return (float(x), -float(z), float(y))

# PBR Material creator
def create_pbr_material(name, texture_name=None, base_color=(0.8, 0.8, 0.8, 1.0),
                        metallic=0.0, roughness=0.5, emissive_strength=0.0,
                        emissive_color=(1.0, 1.0, 1.0, 1.0)):
    mat = bpy.data.materials.new(name=name)
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    bsdf = nodes.get("Principled BSDF")
    if not bsdf:
        bsdf = nodes.new("ShaderNodeBsdfPrincipled")

    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic

    if texture_name:
        tex_path = TEXTURES_DIR / texture_name
        if tex_path.exists():
            img = bpy.data.images.load(str(tex_path))
            tex_node = nodes.new("ShaderNodeTexImage")
            tex_node.image = img
            links.new(tex_node.outputs["Color"], bsdf.inputs["Base Color"])
            if emissive_strength > 0:
                links.new(tex_node.outputs["Color"], bsdf.inputs["Emission Color"])
                bsdf.inputs["Emission Strength"].default_value = emissive_strength
            return mat

    bsdf.inputs["Base Color"].default_value = base_color
    if emissive_strength > 0:
        bsdf.inputs["Emission Color"].default_value = emissive_color
        bsdf.inputs["Emission Strength"].default_value = emissive_strength

    return mat

# Materials
mat_steel = create_pbr_material("Stage_Truss_Steel", base_color=(0.75, 0.77, 0.82, 1.0), metallic=0.88, roughness=0.32)
mat_deck = create_pbr_material("Stage_Deck", "main_stage_deck.png", roughness=0.85)
mat_skirt = create_pbr_material("Stage_Skirt", "main_stage_skirt.png", roughness=0.7)
mat_banner = create_pbr_material("Stage_Banner", "main_stage_banner.png", roughness=0.5, emissive_strength=0.4)
mat_sun = create_pbr_material("Stage_Center_Sun", "main_stage_center_sun.png", roughness=0.3, emissive_strength=2.2)
mat_wing_l = create_pbr_material("Stage_Wing_L", "main_stage_wing_left.png", roughness=0.5, emissive_strength=0.3)
mat_wing_r = create_pbr_material("Stage_Wing_R", "main_stage_wing_right.png", roughness=0.5, emissive_strength=0.3)
mat_screen = create_pbr_material("Stage_Screen", "main_stage_screen.png", roughness=0.2, emissive_strength=1.8)
mat_side_banner = create_pbr_material("Stage_Side_Banner", "main_stage_side_banner.png", roughness=0.5, emissive_strength=0.3)
mat_speaker = create_pbr_material("Stage_Speaker", "main_stage_speaker.png", metallic=0.2, roughness=0.6)
mat_amp = create_pbr_material("Stage_Amp", "main_stage_amp.png", roughness=0.6)
mat_case = create_pbr_material("Road_Case", base_color=(0.12, 0.12, 0.14, 1.0), metallic=0.1, roughness=0.65)
mat_case_edge = create_pbr_material("Road_Case_Trim", base_color=(0.85, 0.86, 0.88, 1.0), metallic=0.9, roughness=0.25)
mat_blinder_body = create_pbr_material("Blinder_Body", base_color=(0.1, 0.1, 0.12, 1.0), metallic=0.4, roughness=0.5)
mat_blinder_glow = create_pbr_material("Blinder_Glow", base_color=(1.0, 0.92, 0.72, 1.0), emissive_strength=4.5, emissive_color=(1.0, 0.92, 0.72, 1.0))
mat_black_curtain = create_pbr_material("Stage_Black_Moltone", base_color=(0.04, 0.04, 0.05, 1.0), roughness=0.95)

# Fast PyData mesh helpers without bpy.ops
def make_box(name, cx, cy, cz, sx, sy, sz, mat):
    hx, hy, hz = sx / 2.0, sy / 2.0, sz / 2.0
    pts = [
        (cx - hx, cy - hy, cz - hz),
        (cx + hx, cy - hy, cz - hz),
        (cx + hx, cy + hy, cz - hz),
        (cx - hx, cy + hy, cz - hz),
        (cx - hx, cy - hy, cz + hz),
        (cx + hx, cy - hy, cz + hz),
        (cx + hx, cy + hy, cz + hz),
        (cx - hx, cy + hy, cz + hz),
    ]
    b_verts = [t3(*p) for p in pts]
    faces = [
        (0, 1, 2, 3), # rear
        (4, 5, 6, 7), # front
        (0, 4, 7, 3), # left
        (1, 2, 6, 5), # right
        (3, 2, 6, 7), # top
        (0, 1, 5, 4), # bottom
    ]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(b_verts, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    uvs_box = [
        ((0,0), (1,0), (1,1), (0,1)),
        ((0,0), (1,0), (1,1), (0,1)),
        ((0,0), (1,0), (1,1), (0,1)),
        ((0,0), (1,0), (1,1), (0,1)),
        ((0,0), (1,0), (1,1), (0,1)),
        ((0,0), (1,0), (1,1), (0,1)),
    ]
    for p_idx, poly in enumerate(mesh.polygons):
        for l_idx, loop in enumerate(poly.loop_indices):
            uv_layer.data[loop].uv = uvs_box[p_idx][l_idx]
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(mat)
    bpy.context.collection.objects.link(obj)
    return obj

def make_textured_quad(name, p0_t, p1_t, p2_t, p3_t, mat, uvs=((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))):
    verts = [t3(*p0_t), t3(*p1_t), t3(*p2_t), t3(*p3_t)]
    faces = [(0, 1, 2, 3)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    poly = mesh.polygons[0]
    for loop_idx, loop in enumerate(poly.loop_indices):
        uv_layer.data[loop].uv = uvs[loop_idx]
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(mat)
    bpy.context.collection.objects.link(obj)
    return obj

def make_tube(name, p1_t, p2_t, r, mat, segments=8):
    b1 = t3(*p1_t)
    b2 = t3(*p2_t)
    dx = b2[0] - b1[0]
    dy = b2[1] - b1[1]
    dz = b2[2] - b1[2]
    L = math.sqrt(dx*dx + dy*dy + dz*dz)
    if L < 1e-4:
        return None
    dir_v = (dx/L, dy/L, dz/L)
    up = (0, 0, 1) if abs(dir_v[2]) < 0.99 else (0, 1, 0)
    px = dir_v[1]*up[2] - dir_v[2]*up[1]
    py = dir_v[2]*up[0] - dir_v[0]*up[2]
    pz = dir_v[0]*up[1] - dir_v[1]*up[0]
    pl = math.sqrt(px*px + py*py + pz*pz)
    u_v = (px/pl, py/pl, pz/pl)
    qx = dir_v[1]*u_v[2] - dir_v[2]*u_v[1]
    qy = dir_v[2]*u_v[0] - dir_v[0]*u_v[2]
    qz = dir_v[0]*u_v[1] - dir_v[1]*u_v[0]
    v_v = (qx, qy, qz)

    verts = []
    faces = []
    for ring_base in [b1, b2]:
        for i in range(segments):
            ang = (i / segments) * math.pi * 2
            rx = ring_base[0] + r * (math.cos(ang)*u_v[0] + math.sin(ang)*v_v[0])
            ry = ring_base[1] + r * (math.cos(ang)*u_v[1] + math.sin(ang)*v_v[1])
            rz = ring_base[2] + r * (math.cos(ang)*u_v[2] + math.sin(ang)*v_v[2])
            verts.append((rx, ry, rz))

    for i in range(segments):
        i_next = (i + 1) % segments
        faces.append((i, i_next, segments + i_next, segments + i))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for p_idx, poly in enumerate(mesh.polygons):
        u0 = p_idx / segments
        u1 = (p_idx + 1) / segments
        uv_layer.data[poly.loop_indices[0]].uv = (u0, 0.0)
        uv_layer.data[poly.loop_indices[1]].uv = (u1, 0.0)
        uv_layer.data[poly.loop_indices[2]].uv = (u1, 1.0)
        uv_layer.data[poly.loop_indices[3]].uv = (u0, 1.0)

    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(mat)
    bpy.context.collection.objects.link(obj)
    return obj

def make_truss_tower(name, x, z, y_min, y_max, width=0.65):
    w2 = width / 2.0
    corners = [
        (x - w2, z - w2),
        (x + w2, z - w2),
        (x + w2, z + w2),
        (x - w2, z + w2),
    ]
    for idx, (cx, cz) in enumerate(corners):
        make_tube(f"{name}_chord_{idx}", (cx, y_min, cz), (cx, y_max, cz), 0.035, mat_steel, segments=6)

    cur_y = y_min
    step = 2.4
    while cur_y < y_max:
        next_y = min(cur_y + step, y_max)
        for i in range(4):
            c1 = corners[i]
            c2 = corners[(i + 1) % 4]
            make_tube(f"{name}_h_{i}_{int(cur_y)}", (c1[0], cur_y, c1[1]), (c2[0], cur_y, c2[1]), 0.02, mat_steel, segments=4)
            make_tube(f"{name}_d_{i}_{int(cur_y)}", (c1[0], cur_y, c1[1]), (c2[0], next_y, c2[1]), 0.018, mat_steel, segments=4)
        cur_y = next_y

def make_circle_tube(name, cx, cy, cz, radius, tube_r, mat, segments=36):
    verts = []
    faces = []
    sub_segs = 6
    for i in range(segments):
        th1 = (i / segments) * math.pi * 2
        for j in range(sub_segs):
            phi = (j / sub_segs) * math.pi * 2
            r_maj = radius + tube_r * math.cos(phi)
            px = cx + r_maj * math.cos(th1)
            py = cy + r_maj * math.sin(th1)
            pz = cz + tube_r * math.sin(phi)
            verts.append(t3(px, py, pz))

    for i in range(segments):
        i_next = (i + 1) % segments
        for j in range(sub_segs):
            j_next = (j + 1) % sub_segs
            v0 = i * sub_segs + j
            v1 = i * sub_segs + j_next
            v2 = i_next * sub_segs + j_next
            v3 = i_next * sub_segs + j
            faces.append((v0, v1, v2, v3))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        for loop in poly.loop_indices:
            uv_layer.data[loop].uv = (0.5, 0.5)
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(mat)
    bpy.context.collection.objects.link(obj)
    return obj

print("Building Duza Scena...")

# -----------------------------------------------------------------
# 1. STAGE DECK & NATURAL WOOD SKIRT
# -----------------------------------------------------------------
make_box("Stage_Subdeck", 0, 1.05, -3.5, 30.0, 2.1, 12.0, mat_steel)
make_textured_quad(
    "Stage_Deck_Top",
    (-15.0, 2.2, 2.5),
    (15.0, 2.2, 2.5),
    (15.0, 2.2, -9.5),
    (-15.0, 2.2, -9.5),
    mat_deck,
    uvs=((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))
)

# Front skirt: Natural blonde pine planks with town plaques facing +Z
make_textured_quad(
    "Stage_Front_Skirt",
    (-15.0, 0.0, 2.51),
    (15.0, 0.0, 2.51),
    (15.0, 2.2, 2.51),
    (-15.0, 2.2, 2.51),
    mat_skirt,
    uvs=((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))
)

# Rear stage wall & side walls (black acoustic drape)
make_textured_quad("Stage_Backdrop_Moltone", (-15.0, 2.2, -9.5), (15.0, 2.2, -9.5), (15.0, 15.5, -9.5), (-15.0, 15.5, -9.5), mat_black_curtain)
make_textured_quad("Stage_Side_L_Moltone", (-15.0, 2.2, 2.5), (-15.0, 2.2, -9.5), (-15.0, 15.5, -9.5), (-15.0, 15.5, 2.5), mat_black_curtain)
make_textured_quad("Stage_Side_R_Moltone", (15.0, 2.2, -9.5), (15.0, 2.2, 2.5), (15.0, 15.5, 2.5), (15.0, 15.5, -9.5), mat_black_curtain)

# -----------------------------------------------------------------
# 2. ROAD CASES (FLIGHT CASES) IN FRONT ON THE GRASS
# -----------------------------------------------------------------
case_x_positions = [-12.5, -8.0, -3.2, 3.2, 8.0, 12.5]
for idx, cx in enumerate(case_x_positions):
    make_box(f"RoadCase_{idx}", cx, 0.45, 3.1, 1.3, 0.9, 0.75, mat_case)
    make_box(f"RoadCase_Trim_{idx}", cx, 0.45, 3.1, 1.33, 0.93, 0.1, mat_case_edge)

# -----------------------------------------------------------------
# 3. LOW FOOTLIGHT BLINDERS ALONG FRONT LIP
# -----------------------------------------------------------------
for idx in range(16):
    fx = -13.5 + idx * 1.8
    make_box(f"Footlight_Body_{idx}", fx, 2.26, 2.45, 0.35, 0.12, 0.2, mat_blinder_body)
    make_box(f"Footlight_Lens_{idx}", fx, 2.28, 2.52, 0.3, 0.08, 0.05, mat_blinder_glow)

# -----------------------------------------------------------------
# 4. SCAFFOLDING TRUSS TOWERS & ROOF GRID
# -----------------------------------------------------------------
tower_coords = [
    (-15.0, 2.5), (-10.5, 2.5), (10.5, 2.5), (15.0, 2.5),
    (-15.0, -9.5), (-10.5, -9.5), (10.5, -9.5), (15.0, -9.5),
]
for idx, (tx, tz) in enumerate(tower_coords):
    make_truss_tower(f"Tower_{idx}", tx, tz, 0.0, 16.5, width=0.65)

# Horizontal roof beams connecting towers
for x in [-15.0, 15.0]:
    make_tube(f"Roof_Beam_Z_{x}", (x, 16.5, -9.5), (x, 16.5, 2.5), 0.06, mat_steel)
for z in [-9.5, 2.5]:
    make_tube(f"Roof_Beam_X_{z}", (-15.0, 16.5, z), (15.0, 16.5, z), 0.06, mat_steel)
for iy in [-6.0, -2.0]:
    make_tube(f"Roof_Beam_Cross_{int(iy)}", (-15.0, 16.5, iy), (15.0, 16.5, iy), 0.045, mat_steel)

# -----------------------------------------------------------------
# 5. CRESTED CROWN ROOF SILHOUETTE & TOP BLINDER ROW
# -----------------------------------------------------------------
make_textured_quad(
    "Main_Stage_Banner",
    (-15.0, 13.6, 2.55),
    (15.0, 13.6, 2.55),
    (15.0, 17.6, 2.55),
    (-15.0, 17.6, 2.55),
    mat_banner,
    uvs=((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))
)

# 24 Halogen Blinder fixtures along the top roof ridge
for idx in range(24):
    bx = -13.8 + idx * 1.2
    dx = abs(bx) / 15.0
    by = 17.55 - 0.35 * (dx ** 2)
    make_box(f"Roof_Blinder_Body_{idx}", bx, by, 2.62, 0.45, 0.35, 0.22, mat_blinder_body)
    make_box(f"Roof_Blinder_Lens_{idx}", bx, by, 2.72, 0.38, 0.28, 0.06, mat_blinder_glow)

# -----------------------------------------------------------------
# 6. MONUMENTAL 3D CIRCULAR SUNBURST RIG ("SŁOŃCE FESTIWALOWE")
# -----------------------------------------------------------------
sun_cx, sun_cy, sun_cz = 0.0, 8.8, -9.0

make_circle_tube("Sun_Ring_Inner", sun_cx, sun_cy, sun_cz, 2.2, 0.045, mat_steel, segments=36)
make_circle_tube("Sun_Ring_Mid", sun_cx, sun_cy, sun_cz, 4.2, 0.05, mat_steel, segments=48)
make_circle_tube("Sun_Ring_Outer", sun_cx, sun_cy, sun_cz, 6.1, 0.055, mat_steel, segments=60)

for s_idx in range(16):
    spoke_ang = (s_idx / 16.0) * math.pi * 2
    cos_a = math.cos(spoke_ang)
    sin_a = math.sin(spoke_ang)
    p_inner = (sun_cx + 1.2 * cos_a, sun_cy + 1.2 * sin_a, sun_cz)
    p_outer = (sun_cx + 6.1 * cos_a, sun_cy + 6.1 * sin_a, sun_cz)
    make_tube(f"Sun_Spoke_{s_idx}", p_inner, p_outer, 0.035, mat_steel, segments=6)

sun_r = 2.15
make_textured_quad(
    "Sun_LED_Portal",
    (sun_cx - sun_r, sun_cy - sun_r, sun_cz + 0.05),
    (sun_cx + sun_r, sun_cy - sun_r, sun_cz + 0.05),
    (sun_cx + sun_r, sun_cy + sun_r, sun_cz + 0.05),
    (sun_cx - sun_r, sun_cy + sun_r, sun_cz + 0.05),
    mat_sun,
    uvs=((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))
)

for idx in range(24):
    ring_r = 4.2 if idx % 2 == 0 else 6.1
    th = (idx / 24.0) * math.pi * 2
    lx = sun_cx + ring_r * math.cos(th)
    ly = sun_cy + ring_r * math.sin(th)
    lz = sun_cz + 0.18
    make_box(f"MovingHead_Body_{idx}", lx, ly, lz, 0.32, 0.32, 0.35, mat_blinder_body)
    make_box(f"MovingHead_Lens_{idx}", lx, ly, lz + 0.18, 0.22, 0.22, 0.05, mat_blinder_glow)

# -----------------------------------------------------------------
# 7. PROSCENIUM TOWERS (JUMPING ROCK GUITARISTS)
# -----------------------------------------------------------------
make_textured_quad(
    "Proscenium_Wing_L",
    (-13.5, 2.2, 2.52),
    (-10.5, 2.2, 2.52),
    (-10.5, 14.5, 2.52),
    (-13.5, 14.5, 2.52),
    mat_wing_l,
    uvs=((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))
)

make_textured_quad(
    "Proscenium_Wing_R",
    (10.5, 2.2, 2.52),
    (13.5, 2.2, 2.52),
    (13.5, 14.5, 2.52),
    (10.5, 14.5, 2.52),
    mat_wing_r,
    uvs=((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))
)

# -----------------------------------------------------------------
# 8. SIDE SOUND WINGS (IMAG SCREENS, BANNERS, LINE ARRAYS)
# -----------------------------------------------------------------
for side_sign, side_name in [(-1, "L"), (1, "R")]:
    wx_in = side_sign * 13.8
    wx_out = side_sign * 18.6

    make_truss_tower(f"Sound_Wing_Tower_{side_name}", wx_out, 1.0, 0.0, 15.0, width=0.6)
    make_tube(f"Wing_Beam_Top_{side_name}", (wx_in, 14.8, 1.0), (wx_out, 14.8, 1.0), 0.05, mat_steel)
    make_tube(f"Wing_Beam_Bot_{side_name}", (wx_in, 3.2, 1.0), (wx_out, 3.2, 1.0), 0.05, mat_steel)

    screen_cx = (wx_in + wx_out) / 2.0
    make_textured_quad(
        f"Stage_IMAG_Screen_{side_name}",
        (screen_cx - 1.8, 5.0, 1.05),
        (screen_cx + 1.8, 5.0, 1.05),
        (screen_cx + 1.8, 11.8, 1.05),
        (screen_cx - 1.8, 11.8, 1.05),
        mat_screen,
        uvs=((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))
    )

    banner_x = wx_out - side_sign * 0.4
    make_textured_quad(
        f"Stage_Side_Banner_{side_name}",
        (banner_x - 0.4, 3.5, 1.08),
        (banner_x + 0.4, 3.5, 1.08),
        (banner_x + 0.4, 13.5, 1.08),
        (banner_x - 0.4, 13.5, 1.08),
        mat_side_banner,
        uvs=((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))
    )

    hang_x = side_sign * 14.2
    for box_idx in range(10):
        t_box = box_idx / 10.0
        cur_y = 12.8 - box_idx * 0.52
        cur_z = 1.8 + 0.45 * (t_box ** 2)
        make_box(f"Speaker_Box_{side_name}_{box_idx}", hang_x, cur_y, cur_z, 1.1, 0.48, 0.65, mat_speaker)

# -----------------------------------------------------------------
# 9. BACKLINE (AMPLIFIERS, DRUM RISER, MICROPHONES)
# -----------------------------------------------------------------
make_box("Drum_Riser", 0.0, 2.5, -6.5, 3.6, 0.6, 2.8, mat_deck)
make_box("Bass_Drum", 0.0, 3.3, -6.5, 0.7, 0.7, 0.6, mat_case)
make_tube("Cymbal_L_Stand", (-1.2, 2.8, -6.8), (-1.2, 3.8, -6.8), 0.02, mat_steel)
make_box("Cymbal_L_Plate", -1.2, 3.8, -6.8, 0.45, 0.02, 0.45, mat_blinder_glow)
make_tube("Cymbal_R_Stand", (1.2, 2.8, -6.8), (1.2, 3.8, -6.8), 0.02, mat_steel)
make_box("Cymbal_R_Plate", 1.2, 3.8, -6.8, 0.45, 0.02, 0.45, mat_blinder_glow)

amp_x_coords = [-7.5, -5.5, -3.5, 3.5, 5.5, 7.5]
for idx, ax in enumerate(amp_x_coords):
    make_textured_quad(
        f"Amp_Stack_Bot_{idx}",
        (ax - 0.5, 2.2, -7.5),
        (ax + 0.5, 2.2, -7.5),
        (ax + 0.5, 3.2, -7.5),
        (ax - 0.5, 3.2, -7.5),
        mat_amp,
        uvs=((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))
    )
    make_textured_quad(
        f"Amp_Stack_Top_{idx}",
        (ax - 0.5, 3.2, -7.5),
        (ax + 0.5, 3.2, -7.5),
        (ax + 0.5, 4.2, -7.5),
        (ax - 0.5, 4.2, -7.5),
        mat_amp,
        uvs=((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))
    )
    make_box(f"Amp_Body_{idx}", ax, 3.2, -7.8, 1.05, 2.0, 0.55, mat_case)

for mx in [-4.0, 0.0, 4.0]:
    make_tube(f"Mic_Stand_{mx}", (mx, 2.2, 1.5), (mx, 3.6, 1.5), 0.015, mat_steel)
    make_tube(f"Mic_Boom_{mx}", (mx, 3.6, 1.5), (mx, 3.8, 1.8), 0.012, mat_steel)
    make_box(f"Mic_Head_{mx}", mx, 3.82, 1.85, 0.06, 0.06, 0.12, mat_steel)

# -----------------------------------------------------------------
# 10. EXPORT GLB
# -----------------------------------------------------------------
print(f"Exporting Duza Scena to {OUT_GLB}...")
bpy.ops.export_scene.gltf(
    filepath=str(OUT_GLB),
    export_format='GLB',
    use_selection=False,
    export_yup=True,
    export_apply=True
)
print("Duza Scena export complete!")
