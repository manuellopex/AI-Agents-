"""Genera el proxy de Oryn (perrito mágico marino) y lo exporta a GLB.
Ejecutar: blender --background --python generate_oryn_proxy.py
"""
import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from proxy_lib import (clean_scene, material, glow_material, PALETTE,
                       sphere, capsule, cone, torus, root_empty, eyes, export)

clean_scene()
root = root_empty("Oryn")

white = material("fur_white", PALETTE["fur_white"])
blue = material("fur_blue", PALETTE["fur_blue"])
gold = material("gold", PALETTE["gold"])
dark = material("eye_dark", PALETTE["eye_dark"])
auralis = glow_material("auralis", "auralis")

# Cuerpo horizontal blanco con lomo azul
capsule("Body", root, white, (0, 0, 0.28), 0.16, 0.34, rot=(90, 0, 0))
capsule("BackFur", root, blue, (0, 0.02, 0.37), 0.13, 0.26, rot=(90, 0, 0))

# Patas
for x, y in ((-0.12, -0.16), (0.12, -0.16), (-0.12, 0.16), (0.12, 0.16)):
    capsule("Leg", root, white, (x, y, 0.1), 0.04, 0.2)

# Cabeza grande, hocico, nariz y ojos enormes
head = sphere("Head", root, white, (0, -0.3, 0.52), (0.17,) * 3)
sphere("Snout", root, white, (0, -0.44, 0.46), (0.09, 0.1, 0.07))
sphere("Nose", root, dark, (0, -0.52, 0.48), (0.035,) * 3)
eyes(root, 0.075, -0.44, 0.58, 0.045)

# Orejas enormes azules (silueta clave)
for side in (-1, 1):
    cone(f"Ear_{'L' if side < 0 else 'R'}", root, blue,
         (0.09 * side, -0.26, 0.72), 0.05, 0.24, rot=(-10, 0, -16 * side))

# Collar dorado con gema teal
torus("Collar", root, gold, (0, -0.22, 0.42), 0.12, 0.018, rot=(75, 0, 0))
sphere("Collar_Gem", root, auralis, (0, -0.33, 0.37), (0.035,) * 3)

# Cola de agua luminosa (marca de la Noxia)
cone("Tail_Glow", root, auralis, (0, 0.32, 0.44), 0.04, 0.26, rot=(125, 0, 0))

export("Oryn", "oryn_proxy")
