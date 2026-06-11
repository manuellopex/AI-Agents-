"""Genera el proxy de Varkon (jefe corrupto por la Noxia) y lo exporta a GLB.
Ejecutar: blender --background --python generate_varkon_proxy.py
"""
import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from proxy_lib import (clean_scene, material, glow_material, PALETTE,
                       sphere, capsule, cone, cube, root_empty, export)

clean_scene()
root = root_empty("Varkon")

dark_cloth = material("dark_purple", PALETTE["dark_purple"])
armor = material("dark_armor", PALETTE["dark_armor"])
old_gold = material("old_gold", PALETTE["old_gold"])
noxia = glow_material("noxia", "noxia")

# Piernas acorazadas (figura alta: ~2.2)
for side in (-1, 1):
    capsule(f"Leg_{'L' if side < 0 else 'R'}", root, armor,
            (0.14 * side, 0, 0.55), 0.1, 0.65)

# Torso angular con peto
cube("Torso", root, dark_cloth, (0, 0, 1.25), (0.52, 0.34, 0.6))
cube("ChestPlate", root, armor, (0, -0.12, 1.4), (0.46, 0.16, 0.34), rot=(8, 0, 0))

# Hombreras en rombo + cristales corruptos
for side in (-1, 1):
    cube(f"Pauldron_{'L' if side < 0 else 'R'}", root, armor,
         (0.4 * side, 0, 1.62), (0.26, 0.26, 0.26), rot=(0, 45, 0))
    cube("CorruptCrystal", root, noxia,
         (0.42 * side, 0, 1.85), (0.1, 0.1, 0.22), rot=(25, 45, 30))
    capsule(f"Arm_{'L' if side < 0 else 'R'}", root, dark_cloth,
            (0.42 * side, 0, 1.2), 0.07, 0.55, rot=(0, 12 * side, 0))

# Núcleo de Noxia en el pecho
sphere("Chest_Core", root, noxia, (0, -0.21, 1.42), (0.06,) * 3)

# Cabeza encapuchada con ojos violeta
sphere("Head", root, dark_cloth, (0, 0, 1.95), (0.18,) * 3)
cone("Hood", root, dark_cloth, (0, 0.02, 2.18), 0.23, 0.3, rot=(-8, 0, 0))
for side in (-1, 1):
    sphere(f"EyeGlow_{'L' if side < 0 else 'R'}", root, noxia,
           (0.07 * side, -0.15, 1.96), (0.035, 0.02, 0.015))

# Capa rota: dos paneles desincronizados
cube("Cape_A", root, dark_cloth, (0.12, 0.2, 1.2), (0.45, 0.02, 1.2), rot=(4, 8, 0))
cube("Cape_B", root, dark_cloth, (-0.16, 0.22, 1.1), (0.4, 0.02, 1.0), rot=(-7, 5, 0))

# Bastón con cristal de Noxia
capsule("Staff", root, old_gold, (0.5, -0.02, 1.1), 0.02, 1.9, rot=(0, 0, 5))
cube("StaffCrystal", root, noxia, (0.58, -0.02, 2.15), (0.1, 0.1, 0.26), rot=(45, 0, 45))

export("Varkon", "varkon_proxy")
