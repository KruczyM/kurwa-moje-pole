"""
Pol'and'Rock Festival 2026 - Authentic Sunflower 3D Model Builder
Builds:
public/game-assets/world/festival/sunflower.glb
- Realistic curved stem with organic taper
- Broad spiraling cordate leaves with petioles connected to stem
- Golden flower head facing forward (-Z in Three.js) towards viewers with Fibonacci seed center and radiant petals
"""

import bpy
import bmesh
import math
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEXTURES_DIR = ROOT / "public" / "game-assets" / "world" / "festival" / "textures"
OUT_DIR = ROOT / "public" / "game-assets" / "world" / "festival"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Three.js (X right, Y up, Z front) -> Blender (X right, -Z forward, Y up)
def t3(x, y, z):
    return (float(x), -float(z), float(y))

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for col in list(bpy.data.collections):
        bpy.data.collections.remove(col, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh, do_unlink=True)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat, do_unlink=True)
    for img in list(bpy.data.images):
        bpy.data.images.remove(img, do_unlink=True)

def create_pbr_material(name, texture_name=None, base_color=(0.8, 0.8, 0.8, 1.0),
                        metallic=0.0, roughness=0.5, alpha_mode='OPAQUE', opacity=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    bsdf = nodes.get("Principled BSDF")
    if not bsdf:
        bsdf = nodes.new("ShaderNodeBsdfPrincipled")

    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic

    mat.use_backface_culling = False
    if alpha_mode == 'BLEND':
        mat.blend_method = 'BLEND'
        if hasattr(mat, 'surface_render_method'):
            mat.surface_render_method = 'BLENDED'
        mat.show_transparent_back = True
    elif alpha_mode == 'CLIP':
        mat.blend_method = 'CLIP'
        mat.alpha_threshold = 0.5
        mat.show_transparent_back = True

    if texture_name:
        tex_path = TEXTURES_DIR / texture_name
        if tex_path.exists():
            img = bpy.data.images.load(str(tex_path))
            img.colorspace_settings.name = 'sRGB'
            tex_node = nodes.new("ShaderNodeTexImage")
            tex_node.image = img
            links.new(tex_node.outputs["Color"], bsdf.inputs["Base Color"])
            if alpha_mode in ('BLEND', 'CLIP'):
                links.new(tex_node.outputs["Alpha"], bsdf.inputs["Alpha"])
            return mat

    bsdf.inputs["Base Color"].default_value = base_color
    if alpha_mode == 'BLEND':
        bsdf.inputs["Alpha"].default_value = opacity
    return mat

def create_mesh_from_bmesh(name, bm, mat=None):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    return obj

def export_glb(path):
    path = Path(path).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Exporting GLB: {path}...")
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )
    print("GLB export complete!")

def build_sunflower():
    clear_scene()
    print("Constructing 3D Pol'and'Rock Sunflower...")

    # Materials
    mat_stem = create_pbr_material("Sunflower_Stem", base_color=(0.28, 0.46, 0.19, 1.0), roughness=0.65)
    mat_calyx = create_pbr_material("Sunflower_Calyx", base_color=(0.22, 0.40, 0.16, 1.0), roughness=0.6)
    mat_leaf = create_pbr_material("Sunflower_Leaf_Tex", "sunflower_leaf.png", base_color=(0.32, 0.54, 0.22, 1.0), roughness=0.55, alpha_mode='CLIP')
    mat_flower = create_pbr_material("Sunflower_Head_Tex", "sunflower_head.png", base_color=(1.0, 0.85, 0.2, 1.0), roughness=0.45, alpha_mode='CLIP')

    # 1. Stem: Natural curved growth terminating at the BACK of the calyx
    # Top neck curves towards the back of the calyx at Y=1.80, Z=0.04
    stem_bm = bmesh.new()
    num_rings = 14
    ring_verts_prev = None

    stem_points = []
    for r in range(num_rings):
        t = r / (num_rings - 1)
        y = t * 1.68
        # Stem curves naturally, bending backwards towards +Z at top into calyx
        z = 0.02 * math.sin(t * math.pi) + 0.06 * (t ** 2.2)
        x = 0.012 * math.sin(t * 2.0 * math.pi)
        rad = 0.024 * (1.0 - t * 0.35)
        stem_points.append((x, y, z, rad))

    sides = 8
    for r, (sx, sy, sz, s_rad) in enumerate(stem_points):
        ring_verts = []
        for s in range(sides):
            ang = s * (2 * math.pi / sides)
            px = sx + math.cos(ang) * s_rad
            pz = sz + math.sin(ang) * s_rad
            py = sy
            bx, by, bz = t3(px, py, pz)
            v = stem_bm.verts.new((bx, by, bz))
            ring_verts.append(v)
        if ring_verts_prev:
            for s in range(sides):
                s_next = (s + 1) % sides
                stem_bm.faces.new([
                    ring_verts_prev[s],
                    ring_verts_prev[s_next],
                    ring_verts[s_next],
                    ring_verts[s]
                ])
        ring_verts_prev = ring_verts

    # Close bottom and top
    stem_bm.verts.ensure_lookup_table()
    bm_bottom = [stem_bm.verts[i] for i in range(sides)]
    stem_bm.faces.new(list(reversed(bm_bottom)))
    bm_top = [stem_bm.verts[-(sides - i)] for i in range(sides)]
    stem_bm.faces.new(bm_top)
    create_mesh_from_bmesh("Sunflower_Stem_Mesh", stem_bm, mat_stem)

    # 2. Leaves: 6 spiraling broad leaves along stem with real petiole connections
    leaf_configs = [
        # (height_y, yaw_angle, pitch_droop, scale)
        (0.42,  0.4,   0.35, 1.05),
        (0.68,  2.5,   0.40, 1.15),
        (0.94,  4.6,   0.38, 1.10),
        (1.18,  1.2,   0.42, 0.95),
        (1.40,  3.3,   0.45, 0.85),
        (1.58,  5.4,   0.48, 0.72),
    ]

    leaf_bm = bmesh.new()
    uv_layer = leaf_bm.loops.layers.uv.new("UVMap")

    for l_idx, (ly, yaw, pitch, l_scale) in enumerate(leaf_configs):
        t = ly / 1.82
        stem_z = -0.06 * (t ** 2.4)
        stem_x = 0.012 * math.sin(t * 2.0 * math.pi)

        petiole_len = 0.09 * l_scale
        leaf_len = 0.46 * l_scale
        leaf_wid = 0.34 * l_scale

        cos_y = math.cos(yaw)
        sin_y = math.sin(yaw)

        # Petiole attaches directly to stem center
        p_start_x = stem_x
        p_start_z = stem_z
        p_start_y = ly

        p_end_x = stem_x + cos_y * petiole_len
        p_end_z = stem_z + sin_y * petiole_len
        p_end_y = ly + 0.02

        mid_dist = petiole_len + leaf_len * 0.50
        tip_dist = petiole_len + leaf_len

        mid_x = stem_x + cos_y * mid_dist
        mid_z = stem_z + sin_y * mid_dist
        mid_y = ly + 0.05 - pitch * 0.15

        tip_x = stem_x + cos_y * tip_dist
        tip_z = stem_z + sin_y * tip_dist
        tip_y = ly - pitch * 0.34

        # Transverse vectors perpendicular to leaf axis
        tx = -sin_y * (leaf_wid / 2.0)
        tz = cos_y * (leaf_wid / 2.0)

        # Vertices:
        v_stem = leaf_bm.verts.new(t3(p_start_x, p_start_y, p_start_z))
        v_base = leaf_bm.verts.new(t3(p_end_x, p_end_y, p_end_z))
        v_mid_l = leaf_bm.verts.new(t3(mid_x + tx, mid_y, mid_z + tz))
        v_mid_c = leaf_bm.verts.new(t3(mid_x, mid_y + 0.02, mid_z))
        v_mid_r = leaf_bm.verts.new(t3(mid_x - tx, mid_y, mid_z - tz))
        v_tip = leaf_bm.verts.new(t3(tip_x, tip_y, tip_z))

        # Faces with UVs:
        # Petiole quad/triangle
        f_pet = leaf_bm.faces.new([v_stem, v_base, v_mid_c])
        f1 = leaf_bm.faces.new([v_base, v_mid_l, v_mid_c])
        f2 = leaf_bm.faces.new([v_base, v_mid_c, v_mid_r])
        f3 = leaf_bm.faces.new([v_mid_c, v_mid_l, v_tip])
        f4 = leaf_bm.faces.new([v_mid_c, v_tip, v_mid_r])

        uv_map = {
            v_stem: (0.50, 0.01),
            v_base: (0.50, 0.08),
            v_mid_l: (0.02, 0.50),
            v_mid_c: (0.50, 0.50),
            v_mid_r: (0.98, 0.50),
            v_tip: (0.50, 0.96)
        }
        for face in [f_pet, f1, f2, f3, f4]:
            for loop in face.loops:
                loop[uv_layer].uv = uv_map[loop.vert]

    create_mesh_from_bmesh("Sunflower_Leaves_Mesh", leaf_bm, mat_leaf)

    # 3. Flower Head (Disc + Calyx Sepals)
    # Head position: top of stem (Y=1.82, Z=-0.06)
    # Head faces towards -Z in Three.js, tilted slightly upward by 22 degrees
    head_bm = bmesh.new()
    head_uv = head_bm.loops.layers.uv.new("UVMap")

    head_cx = 0.0
    head_cy = 1.76
    head_cz = -0.04
    tilt_rad = math.radians(22.0)
    cos_t = math.cos(tilt_rad)
    sin_t = math.sin(tilt_rad)

    # In Three.js: head normal faces -Z and +Y
    # Local: hz forward (+Z in local is towards -Z in Three.js)
    def head_to_world(hx, hy, hz):
        # Local hz positive -> Three.js -Z
        wz = head_cz - (hz * cos_t + hy * sin_t)
        wy = head_cy + (hy * cos_t - hz * sin_t)
        wx = head_cx + hx
        return t3(wx, wy, wz)

    # Calyx Backing (Green cup behind head at hz = -0.04)
    calyx_bm = bmesh.new()
    num_sepals = 16
    c_rad = 0.18
    v_c_center = calyx_bm.verts.new(head_to_world(0.0, 0.0, -0.04))
    sepal_ring = []
    for s in range(num_sepals):
        sang = s * (2 * math.pi / num_sepals)
        sx = math.cos(sang) * c_rad
        sy = math.sin(sang) * c_rad
        v_s = calyx_bm.verts.new(head_to_world(sx, sy, -0.01))
        sepal_ring.append(v_s)

    for s in range(num_sepals):
        s_next = (s + 1) % num_sepals
        calyx_bm.faces.new([v_c_center, sepal_ring[s], sepal_ring[s_next]])
    create_mesh_from_bmesh("Sunflower_Calyx_Mesh", calyx_bm, mat_calyx)

    # Front Flower Face:
    # 24-gon domed central disk & surrounding petal disc
    # Radius = 0.26m (diameter 0.52m!)
    f_rad = 0.26
    num_f_verts = 24
    v_head_center = head_bm.verts.new(head_to_world(0.0, 0.0, 0.02))

    f_ring_verts = []
    f_uv_map = {v_head_center: (0.5, 0.5)}

    for s in range(num_f_verts):
        ang = s * (2 * math.pi / num_f_verts)
        rad_scallop = f_rad * (0.97 + 0.03 * math.sin(ang * 16.0))
        hx = math.cos(ang) * rad_scallop
        hy = math.sin(ang) * rad_scallop
        v = head_bm.verts.new(head_to_world(hx, hy, 0.0))
        f_ring_verts.append(v)

        u = 0.5 + 0.48 * math.cos(ang)
        v_coord = 0.5 + 0.48 * math.sin(ang)
        f_uv_map[v] = (u, v_coord)

    # Front faces (facing viewer with normal pointing towards -Z in Three.js / +Y in Blender)
    for s in range(num_f_verts):
        s_next = (s + 1) % num_f_verts
        f = head_bm.faces.new([v_head_center, f_ring_verts[s_next], f_ring_verts[s]])
        for loop in f.loops:
            loop[head_uv].uv = f_uv_map[loop.vert]

    create_mesh_from_bmesh("Sunflower_Head_Mesh", head_bm, mat_flower)

    export_glb(OUT_DIR / "sunflower.glb")

if __name__ == "__main__":
    build_sunflower()
