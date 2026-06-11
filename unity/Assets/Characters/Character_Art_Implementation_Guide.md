# Guía de implementación de arte — Personajes 3D

Cómo funciona el pipeline de dos capas y cómo reemplazar los proxies por
los modelos finales sin romper gameplay, animaciones ni VFX.

## Pipeline de dos capas

**Capa 1 — Stylized Proxy Models (ya generada).**
`Isla Auria → 2. Character Prefab Builder` construye cada personaje con
geometría generada: silueta, proporciones, paleta oficial, ojos, accesorios
y partes emissive. Sirven para gameplay, encuadre de cámara, pruebas de
shader y dirección de arte.

**Capa 2 — Final Model Replacement (este documento).**
Cada prefab está estructurado para que el mesh se sustituya por un FBX/GLB
externo (Blender, Maya, Meshy, Tripo…) sin tocar nada más.

## Estructura estándar de cada prefab

```
Mael (root)            ← CharacterSetup, Animator, CapsuleCollider
├── Rig                ← vacío, reservado para el esqueleto final
├── MeshContainer      ← TODO el visual vive aquí (proxy o final)
├── AttachPoints       ← Hand_R, Hand_L, Head, Waist_Artifact, Feet…
└── VFX                ← partículas, trails, auras
```

Reglas que mantienen todo desacoplado:

- El gameplay consulta `CharacterSetup.GetAttachmentPoint("Hand_R")`,
  nunca busca huesos por nombre.
- Las animaciones placeholder animan `MeshContainer`, no los huesos.
- Los materiales viven en `Assets/Characters/_Shared/Materials` y se
  comparten entre proxy y modelo final.

## Pasos para reemplazar un proxy por el modelo final

1. **Exporta el modelo** con el root en los pies, mirando a +Z, escala
   real en metros (Mael ≈ 1.7 u; Oryn ≈ 0.65 u). Formato FBX o GLB.
2. **Impórtalo** a `Assets/Characters/<Nombre>/Models/`.
   - Humanoides (Mael, Elaria, Varkon, Seralya): en el importador, Rig →
     Animation Type → *Humanoid* y valida el avatar.
   - Criaturas (Oryn) y espíritus (Liora): *Generic*.
3. **Abre el prefab** y borra los hijos de `MeshContainer` (el proxy).
4. **Arrastra el modelo final** dentro de `MeshContainer` (posición 0,0,0).
   Si trae esqueleto, mueve el root del esqueleto a `Rig`.
5. **Asigna los materiales** de la librería compartida a cada submesh
   (skin, hair, cloth…). Si el modelo trae sus propios mapas, crea
   variantes del shader `IslaAuria/StylizedToon` con la textura en
   `_BaseMap` — mantén pocas (1-2 por personaje).
6. **Re-vincula attachment points**: selecciona el root y usa el menú
   contextual de `CharacterSetup` → *Auto-rellenar referencias*. Ajusta a
   mano los empties de `AttachPoints` para que coincidan con las manos /
   cabeza / cola del nuevo modelo (o emparéntalos al hueso correspondiente).
7. **Glow**: añade `GlowPulse` a los renderers mágicos del modelo final
   (artefacto, cola, gemas) y dales el material glow correspondiente.
8. **Animator**: cuando existan animaciones reales, reemplaza los clips del
   controller (`Assets/Characters/<Nombre>/Animations/<Nombre>_Controller`)
   estado por estado, conservando los nombres (`Idle`, `Run`, `Jump`,
   `SpinAttack`…). El resto del juego referencia estados, no clips.
9. **Prueba en CharacterShowcase**: `Isla Auria → 3. Generar escena…` o
   abre `Assets/Scenes/CharacterShowcase.unity`, pulsa Play y revisa
   silueta, materiales, rim light y animaciones con los botones 1-7.

## Presupuestos para móvil

| Personaje | Triángulos | Materiales | Huesos | Textura |
|---|---|---|---|---|
| Mael (héroe, siempre en pantalla) | ≤ 15 000 | 2 | ≤ 40 | 1024 atlas |
| Oryn / Liora | ≤ 8 000 | 1-2 | ≤ 25 | 512-1024 |
| Elaria / Varkon / Seralya (NPC/jefes) | ≤ 12 000 | 2 | ≤ 40 | 1024 |

- **LODs**: para jefes y NPC añade un `LODGroup` con LOD0 (100 %) y LOD1
  (~40 % de triángulos, generado por decimación en Blender). Mael no lo
  necesita: la cámara siempre está cerca.
- Sombras: proyectar sí, recibir no (look toon limpio y más rendimiento).
- Partículas: ≤ 40 por emisor (los proxies ya respetan este límite).
- El shader `IslaAuria/StylizedToon` mantiene los variants al mínimo;
  evita añadir keywords nuevos sin medir en dispositivo.

## Generar proxies más orgánicos con Blender (opcional)

Si tienes Blender 4.x instalado:

```bash
cd unity/Tools/Blender
blender --background --python generate_mael_proxy.py
# idem: oryn, elaria, liora, varkon, seralya
```

Cada script exporta `Assets/Characters/<Nombre>/Models/<nombre>_proxy.glb`
con formas suavizadas, materiales de la paleta y partes emissive. Después
sigue los pasos de reemplazo de arriba usando ese GLB.

## Orden recomendado de trabajo (igual que el menú)

1. `Isla Auria → 1. Generar materiales estilizados`
2. `Isla Auria → 2. Character Prefab Builder` → ★ Construir TODOS
3. `Isla Auria → 3. Generar escena CharacterShowcase`
4. Iterar colores/proporciones en los proxies hasta aprobar dirección
5. Encargar/crear modelos finales y reemplazarlos uno a uno
