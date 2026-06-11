"""
proxy_lib — utilidades compartidas para generar los modelos proxy de
"Mael & Oryn: El Primer Destello" en Blender (4.x) y exportarlos a GLB.

Uso (desde la carpeta Tools/Blender):
    blender --background --python generate_mael_proxy.py

Cada script construye el personaje con primitivas suavizadas, materiales
con la paleta oficial, ojos expresivos y partes emissive, y lo exporta a
Assets/Characters/<Nombre>/Models/<nombre>_proxy.glb
"""
import os
import math
import bpy

# ----------------------------------------------------------------------
# Paleta oficial (coincide con StylizedMaterialLibrary.cs)
# ----------------------------------------------------------------------
PALETTE = {
    "skin_warm": (0.94, 0.73, 0.54),
    "hair_dark": (0.29, 0.20, 0.15),
    "cloth_cream": (0.96, 0.90, 0.77),
    "cloth_teal": (0.16, 0.65, 0.63),
    "gold": (1.0, 0.83, 0.30),
    "leather": (0.55, 0.35, 0.17),
    "fur_blue": (0.31, 0.66, 0.85),
    "fur_white": (0.91, 0.96, 1.0),
    "dark_purple": (0.23, 0.16, 0.32),
    "dark_armor": (0.18, 0.23, 0.25),
    "old_gold": (0.72, 0.57, 0.24),
    "pearl": (0.99, 0.96, 0.88),
    "eye_white": (1.0, 1.0, 1.0),
    "eye_dark": (0.10, 0.16, 0.20),
}

GLOW = {
    "auralis": ((0.18, 0.77, 0.71), 3.0),
    "liora": ((1.0, 0.83, 0.30), 4.0),
    "noxia": ((0.48, 0.18, 0.82), 3.0),
}


def clean_scene():
    """Vacía la escena por completo."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def material(name, color, emission=None, emission_strength=0.0, alpha=1.0):
    """Material Principled simple; con emission para partes mágicas."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.7
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.blend_method = "BLEND"
    return mat


def glow_material(name, kind):
    color, strength = GLOW[kind]
    return material(name, color, emission=color, emission_strength=strength)


def _setup(obj, name, parent, mat, smooth=True):
    obj.name = name
    if parent is not None:
        obj.parent = parent
    if mat is not None:
        obj.data.materials.append(mat)
    if smooth:
        bpy.ops.object.shade_smooth()
    return obj


def sphere(name, parent, mat, pos, scale=(1, 1, 1), rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, location=pos)
    obj = bpy.context.active_object
    obj.scale = scale
    obj.rotation_euler = [math.radians(a) for a in rot]
    return _setup(obj, name, parent, mat)


def capsule(name, parent, mat, pos, radius, depth, rot=(0, 0, 0)):
    # Blender no trae cápsula: cilindro + esferas en los extremos unidas visualmente
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=radius, depth=depth, location=pos)
    obj = bpy.context.active_object
    obj.rotation_euler = [math.radians(a) for a in rot]
    return _setup(obj, name, parent, mat)


def cone(name, parent, mat, pos, radius, depth, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=radius, depth=depth, location=pos)
    obj = bpy.context.active_object
    obj.rotation_euler = [math.radians(a) for a in rot]
    return _setup(obj, name, parent, mat)


def cube(name, parent, mat, pos, scale=(1, 1, 1), rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.active_object
    obj.scale = scale
    obj.rotation_euler = [math.radians(a) for a in rot]
    return _setup(obj, name, parent, mat, smooth=False)


def torus(name, parent, mat, pos, major, minor, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        location=pos, major_radius=major, minor_radius=minor,
        major_segments=20, minor_segments=8)
    obj = bpy.context.active_object
    obj.rotation_euler = [math.radians(a) for a in rot]
    return _setup(obj, name, parent, mat)


def root_empty(name):
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = name
    return obj


def eyes(parent, spacing, y_forward, z_up, size):
    """Ojos grandes: esclerótica + pupila + brillo (mirando a +Y)."""
    white = material("eye_white", PALETTE["eye_white"])
    dark = material("eye_dark", PALETTE["eye_dark"])
    for side in (-1, 1):
        eye = sphere(f"Eye_{'L' if side < 0 else 'R'}", parent, white,
                     (spacing * side, y_forward, z_up), (size,) * 3)
        sphere("Pupil", eye, dark,
               (spacing * side, y_forward + size * 0.45, z_up), (size * 0.5,) * 3)
        sphere("Highlight", eye, white,
               (spacing * side + size * 0.18, y_forward + size * 0.5, z_up + size * 0.2),
               (size * 0.16,) * 3)


def export(character_name, file_stem):
    """Exporta toda la escena a Assets/Characters/<Name>/Models/<stem>.glb"""
    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.normpath(os.path.join(
        here, "..", "..", "Assets", "Characters", character_name, "Models"))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{file_stem}.glb")
    bpy.ops.export_scene.gltf(filepath=out_path, export_format="GLB", export_yup=True)
    print(f"✔ Exportado: {out_path}")
