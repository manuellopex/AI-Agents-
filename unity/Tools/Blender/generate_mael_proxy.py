"""Genera el proxy de Mael Veyra (protagonista) y lo exporta a GLB.
Ejecutar: blender --background --python generate_mael_proxy.py
Convención Blender: +Z arriba, -Y frente; el exportador convierte a Y-up.
"""
import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from proxy_lib import (clean_scene, material, glow_material, PALETTE,
                       sphere, capsule, cone, cube, torus, root_empty, eyes, export)

clean_scene()
root = root_empty("Mael")

skin = material("skin", PALETTE["skin_warm"])
hair = material("hair", PALETTE["hair_dark"])
cream = material("cream", PALETTE["cloth_cream"])
teal = material("teal", PALETTE["cloth_teal"])
gold = material("gold", PALETTE["gold"])
leather = material("leather", PALETTE["leather"])
auralis = glow_material("auralis", "auralis")

# Piernas y botas
for side in (-1, 1):
    s = "L" if side < 0 else "R"
    capsule(f"Leg_{s}", root, cream, (0.11 * side, 0, 0.42), 0.075, 0.5)
    cube(f"Boot_{s}", root, leather, (0.11 * side, -0.04, 0.08), (0.17, 0.3, 0.16))

# Torso teal + sash crema con ribete dorado + cinturón
capsule("Torso", root, teal, (0, 0, 0.95), 0.2, 0.45)
cube("Sash", root, cream, (0.02, -0.12, 0.98), (0.14, 0.16, 0.52), rot=(0, 38, 0))
cube("SashTrim", root, gold, (0.02, -0.125, 0.98), (0.05, 0.16, 0.53), rot=(0, 38, 0))
torus("Belt", root, leather, (0, 0, 0.72), 0.21, 0.03, rot=(0, 0, 0))

# Artefacto mágico circular del cinturón (glow Auralis)
disc = capsule("Waist_Artifact", root, auralis, (0, -0.18, 0.72), 0.07, 0.02, rot=(90, 0, 0))

# Brazos, brazaletes y manos grandes
for side in (-1, 1):
    s = "L" if side < 0 else "R"
    capsule(f"Arm_{s}", root, skin, (0.3 * side, 0, 0.98), 0.06, 0.42, rot=(0, 18 * side, 0))
    torus(f"Bracelet_{s}", root, gold, (0.36 * side, 0, 0.8), 0.07, 0.02, rot=(0, 18 * side, 0))
    sphere(f"Hand_{s}", root, skin, (0.4 * side, 0, 0.7), (0.085,) * 3)

# Cabeza grande, pelo oscuro despeinado, ojos expresivos
head = sphere("Head", root, skin, (0, 0, 1.52), (0.23,) * 3)
eyes(root, 0.1, -0.19, 1.55, 0.05)
sphere("HairTop", root, hair, (0, 0.03, 1.68), (0.22, 0.22, 0.14))
sphere("HairSpike1", root, hair, (0.12, -0.05, 1.7), (0.1, 0.11, 0.07), rot=(0, -25, 10))
sphere("HairSpike2", root, hair, (-0.12, -0.03, 1.71), (0.1, 0.11, 0.07), rot=(0, 25, -10))
sphere("HairFront", root, hair, (0, -0.15, 1.68), (0.12, 0.1, 0.07), rot=(30, 0, 0))
sphere("HairBack", root, hair, (0, 0.16, 1.62), (0.13, 0.12, 0.1), rot=(-30, 0, 0))

export("Mael", "mael_proxy")
