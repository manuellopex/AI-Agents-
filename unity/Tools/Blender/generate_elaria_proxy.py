"""Genera el proxy de Elaria del Alba (guardiana luminosa) y lo exporta a GLB.
Ejecutar: blender --background --python generate_elaria_proxy.py
"""
import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from proxy_lib import (clean_scene, material, glow_material, PALETTE,
                       sphere, capsule, cone, cube, torus, root_empty, eyes, export)

clean_scene()
root = root_empty("Elaria")

skin = material("skin", PALETTE["skin_warm"])
pearl = material("pearl", PALETTE["pearl"])
cream = material("cream", PALETTE["cloth_cream"])
gold = material("gold", PALETTE["gold"])
pink = material("soft_pink", (0.95, 0.66, 0.77), alpha=0.45)
liora_glow = glow_material("liora_glow", "liora")

# Falda larga (flota: todo elevado 0.25)
cone("Skirt", root, cream, (0, 0, 0.78), 0.42, 1.05, rot=(180, 0, 0))
torus("SkirtHem", root, gold, (0, 0, 0.3), 0.4, 0.02)

# Torso perlado, hombreras y brazos
capsule("Torso", root, pearl, (0, 0, 1.45), 0.14, 0.4)
for side in (-1, 1):
    sphere("Pauldron", root, gold, (0.22 * side, 0, 1.66), (0.08, 0.08, 0.05))
    capsule(f"Arm_{'L' if side < 0 else 'R'}", root, pearl,
            (0.27 * side, -0.04, 1.4), 0.045, 0.42, rot=(-10, 14 * side, 0))

# Luz del pecho
sphere("Chest_Light", root, liora_glow, (0, -0.13, 1.57), (0.05,) * 3)

# Cabeza serena, pelo dorado largo y halo solar
sphere("Head", root, skin, (0, 0, 1.97), (0.17,) * 3)
eyes(root, 0.07, -0.14, 1.99, 0.035)
sphere("HairCrown", root, gold, (0, 0.02, 2.08), (0.17, 0.17, 0.11))
capsule("HairBack", root, gold, (0, 0.13, 1.6), 0.1, 0.6, rot=(8, 0, 0))
capsule("Head_Halo", root, liora_glow, (0, 0.08, 2.22), 0.26, 0.012, rot=(78, 0, 0))

# Velos rosados translúcidos
for side in (-1, 1):
    cube("Veil", root, pink, (0.3 * side, 0.14, 1.25), (0.34, 0.02, 0.85),
         rot=(6 * side, 8 * side, 0))

# Cetro con núcleo de luz
capsule("Staff", root, gold, (0.38, -0.08, 1.3), 0.018, 1.5, rot=(0, 0, 6))
sphere("Staff_Glow", root, liora_glow, (0.46, -0.08, 2.1), (0.09,) * 3)

export("Elaria", "elaria_proxy")
