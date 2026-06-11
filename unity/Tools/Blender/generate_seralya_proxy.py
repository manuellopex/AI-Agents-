"""Genera el proxy de Seralya (jefa erudita arcana) y lo exporta a GLB.
Ejecutar: blender --background --python generate_seralya_proxy.py
"""
import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from proxy_lib import (clean_scene, material, glow_material, PALETTE,
                       sphere, capsule, cone, cube, torus, root_empty, eyes, export)

clean_scene()
root = root_empty("Seralya")

skin = material("skin", PALETTE["skin_warm"])
hair = material("hair", PALETTE["hair_dark"])
purple = material("dark_purple", PALETTE["dark_purple"])
cream = material("cream", PALETTE["cloth_cream"])
gold = material("gold", PALETTE["gold"])
old_gold = material("old_gold", PALETTE["old_gold"])
noxia = glow_material("noxia", "noxia")

# Falda elegante con bajo dorado
cone("Skirt", root, purple, (0, 0, 0.72), 0.36, 1.0, rot=(180, 0, 0))
torus("SkirtHem", root, gold, (0, 0, 0.26), 0.34, 0.018)

# Torso con panel crema y cuello dorado
capsule("Torso", root, purple, (0, 0, 1.35), 0.13, 0.4)
cube("CreamPanel", root, cream, (0, -0.1, 1.35), (0.16, 0.05, 0.42))
torus("GoldCollar", root, gold, (0, 0, 1.56), 0.12, 0.015, rot=(90, 0, 0))

# Gema violeta del pecho
sphere("Chest_Gem", root, noxia, (0, -0.12, 1.48), (0.045,) * 3)

# Brazos con guantes largos crema
for side in (-1, 1):
    capsule(f"Arm_{'L' if side < 0 else 'R'}", root, cream,
            (0.25 * side, -0.03, 1.32), 0.04, 0.42, rot=(-8, 16 * side, 0))

# Cabeza refinada: moño alto, diadema dorada
sphere("Head", root, skin, (0, 0, 1.88), (0.16,) * 3)
eyes(root, 0.065, -0.13, 1.9, 0.032)
sphere("HairCrown", root, hair, (0, 0.03, 1.99), (0.16, 0.16, 0.11))
sphere("HairBun", root, hair, (0, 0.05, 2.12), (0.08,) * 3)
torus("Head_Crown", root, gold, (0, -0.01, 2.0), 0.15, 0.012, rot=(12, 0, 0))

# Libro arcano flotante con runa luminosa
cube("BookCover", root, purple, (-0.42, -0.18, 1.45), (0.3, 0.4, 0.04), rot=(0, 25, -18))
cube("BookPages", root, cream, (-0.42, -0.18, 1.47), (0.27, 0.37, 0.02), rot=(0, 25, -18))
cube("BookSpine", root, old_gold, (-0.55, -0.14, 1.44), (0.03, 0.41, 0.05), rot=(0, 25, -18))
capsule("BookRune", root, noxia, (-0.42, -0.18, 1.49), 0.08, 0.006, rot=(90, 25, 0))

# Círculo de runas bajo los pies
capsule("RuneCircle", root, noxia, (0, 0, 0.012), 0.45, 0.004, rot=(0, 0, 0))

export("Seralya", "seralya_proxy")
