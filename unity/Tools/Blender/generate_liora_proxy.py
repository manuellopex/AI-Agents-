"""Genera el proxy de Liora (el Primer Destello, espíritu dorado) a GLB.
Ejecutar: blender --background --python generate_liora_proxy.py
"""
import sys, os, math
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from proxy_lib import (clean_scene, material, glow_material, PALETTE,
                       sphere, cone, root_empty, eyes, export)

clean_scene()
root = root_empty("Liora")

liora_glow = glow_material("liora_glow", "liora")
halo = material("halo", (1.0, 0.9, 0.6), alpha=0.3)

# Núcleo dorado vivo (flota a 1.2)
sphere("Core", root, liora_glow, (0, 0, 1.2), (0.11,) * 3)

# Carita tierna
eyes(root, 0.045, -0.09, 1.23, 0.022)

# "Pétalos" de chispa alrededor del núcleo
for i in range(5):
    angle = i / 5 * 360
    rad = math.radians(angle)
    x = math.cos(rad) * 0.14
    z = 1.2 + math.sin(rad) * 0.14
    cone(f"Spark_{i}", root, liora_glow, (x, 0, z), 0.025, 0.12,
         rot=(0, angle - 90, 0))

# Halo translúcido
sphere("Halo", root, halo, (0, 0, 1.2), (0.19,) * 3)

export("Liora", "liora_proxy")
