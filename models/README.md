# Modelos finales (GLB) — Paso 2 del pipeline de arte

Suelta aquí los modelos y el juego los usa automáticamente (si un archivo
no existe, se usa la versión procedural). Sin tocar código.

## Nombres reconocidos

| Archivo | Reemplaza a | Altura objetivo |
|---|---|---|
| `mael.glb` | el protagonista | 1.75 m (se normaliza solo) |
| `oryn.glb` | el compañero | — (próximamente) |
| `tree.glb` | todos los árboles | ~3.2 m |
| `rock.glb` | las rocas decorativas | ~1.1 m |
| `house.glb` | las casas de la aldea | ~2.9 m |

## Convenciones

- **Formato**: GLB (binario). Draco soportado.
- **Escala**: metros reales (la altura se normaliza, pero modela a escala).
- **Origen**: pies/base del modelo en (0,0,0), mirando hacia **+Z**.
- **Presupuesto móvil**: ≤15k triángulos el personaje, ≤5k props; 1-2
  materiales; textura 1024 máx.

## Flujo recomendado (desde tus concept arts)

1. **Meshy.ai** o **Tripo3D**: sube el turnaround del personaje → genera
   el modelo 3D con textura → exporta **GLB**.
2. Personajes: súbelo a **Mixamo** (gratis) → auto-rig → descarga las
   animaciones (Idle, Run, Jump, Fall, Spin/Attack, Punch).
3. En **Blender**: importa el FBX de Mixamo, renombra los clips para que
   contengan esas palabras clave, y exporta GLB con animaciones.
4. Copia el `.glb` aquí con el nombre de la tabla → commit → listo.

El mapeo de animaciones busca por palabra clave en el nombre del clip:
`idle/stand`, `run/walk/sprint`, `jump`, `fall/air`, `spin/attack/slash`,
`punch/hit/jab`. Si el GLB no trae animaciones, el modelo se mueve con la
animación procedural del juego.

`tree.glb` actual: palmera de prueba generada con
`node scripts/make-test-tree.mjs` para validar el pipeline — reemplázala
por tu arte final cuando quieras.
