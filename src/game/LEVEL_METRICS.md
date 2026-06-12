# Costa Brillante — Métricas de escala (documento interno)

Escala de aventura 3D clásica. **1 unidad = 1 metro.** Sistema de
coordenadas: +Z sur (spawn), −Z norte (faro), +X este.

## Isla

| Métrica | Valor |
|---|---|
| Largo (N-S) | ~420 m (z +210 … −210) |
| Ancho (E-O) | ~310 m (x ±155) |
| Mar | y = 0 |
| Altura máx. terreno | 70 m (base del faro) |
| Faro del Alba | torre 38 m (⌀ 12 m), galería 107.5 m |
| Punto más alto | cristal del faro ≈ 112 m |

## Bandas de altura

| Banda | Altura | Contenido |
|---|---|---|
| 1 Playa / Hub | 0–4 m | spawn, Plaza Costera 18×16, Coral |
| 2 Acantilados bajos | 6–15 m (y12) | Lower Terrace District, Sendero de Oryn |
| 3 Ciudad media | 18–38 m (y28) | Mid District, plazas, Desafío, inicio Ruta Vertical |
| 4 Distrito alto | 45–70 m (y58) | Upper Sacred District, templos, camino ceremonial |
| 5 Cumbre | 70–112 m | atrio, torre del faro, hélice de plataformas |

## Métricas de jugador (PlayerController)

| Métrica | Valor |
|---|---|
| Mael | 1.72 m (GLB normalizado) |
| Caminar / correr | 3.5 / 6.2 m/s |
| Salto | 1.6 m (v=9.5, g=28) |
| Doble salto total | 3.2 m |
| Dash (golpe) | 4 m (12.5 m/s × 0.32 s) |
| Ledge assist (mantle) | hasta 1.25 m |
| Ground pound | radio 2.2 m |
| Salto cómodo / exigente / máx | 2.5–3.5 / 4.5–5.5 / 6 m |
| Plataforma mínima / segura | 2.5×2.5 / 4×4 m |

## Áreas (centro aproximado)

| # | Área | Posición | Dimensión |
|---|---|---|---|
| 1 | Hub Playa Central | (0, 2, 140) | 70×55 |
| 2 | Playa del Coral | (−85, 2, 80) | 85×50 |
| 3 | Cueva Azul (interior) | (414, 8…14, 0) | 55×38 |
| 4 | Ruta Vertical | (0…−16, 28→70, −95…−146) | ~150 m |
| 5 | Faro del Alba | (0, 70, −152…−170) | base 42×36 |
| 6 | Arboleda Quiríes | (95, 18, 35) | 75×60 |
| 7 | Sendero de Oryn | (58, 12, 8…−40) | ~105 m × 4-8 |
| 8 | Santuario Desafío | (−55, 28, −95) | 42×34 |

## Arquitectura

- Casas (Lower): 6.5–9 m ancho × 6.5–8.5 m alto, puertas 2.4 m
- Edificios (Mid): 11–14 m ancho × 10.5–14 m alto, balcones, puertas 3.2 m
- Templos (Upper): base 18×14, alto ~15 m
- Arcos ceremoniales: luz 5–5.5 m, altura útil ~5 m
- Plazas: Costera 18×16 · Mercado ⌀12 · Segunda ⌀16 · Mirador 12×10 · Atrio 16×14 · Claro Quiríes ⌀18
- Escaleras: contrahuella 0.20 m, huella 0.30–0.34 m (InstancedMesh)
- Rampas principales: 5–6 m de ancho, pendiente 14–27°

## Vegetación (jerarquía)

small 5 m · mediana 8.5 m · hero 12.5 m · gigantes fantasy de la
Arboleda 11–16 m (copa 8–13 m) · hierba instanciada 0.35–0.6 m

## Rutas y atajos

- Principal: spawn → R1 (playa→y12) → R2+descansillo (→y28) → Ruta
  Vertical (plataformas/ledges/viento → y58) → camino ceremonial →
  rampas zigzag → atrio y70 → hélice del faro → galería 107.5
- Corrientes de viento: 2 (x6,z−134 → y59 · x−16,z−146 → y60)
- Pads de atajo: playa→y12, y12→y28 (mirador), Coral→acantilado, Arboleda
- Cueva Azul: la salida teletransporta al hub (atajo de retorno)
- Checkpoints: 11 (spawn, Coral, Arboleda, Sendero, Bajo, Medio,
  terraza Ruta Vertical, Alto, Atrio, Desafío, Cueva)

## Validación de gameplay (lista FASE 5)

- [x] Mannequins: Mael 1.72 / puertas 2.4-3.2 / pisos ~3 m
- [x] El faro es visible desde el spawn y desde las 4 bandas
- [x] 3 rutas legibles desde el spawn (N ciudad, O coral, E arboleda)
- [x] Saltos de la Ruta Vertical: 3–4.5 m (cómodo-exigente)
- [x] Plataformas ≥ 4×4 en ruta principal, 3.2×3.2 solo en desafío
- [x] Rampas ≤ 27°, escaleras 0.20/0.30
- [x] Combate del Coral: arena 85×50 sin obstáculos en el centro
- [x] Retornos: atajo cueva→hub, pads, caída libre permitida al mar
- [x] Vistas técnicas: ?view=top (grid 20 m + labels) · ?view=side
- [x] Sombras siguen al jugador (frustum ±70 m móvil)
- [x] 60 fps objetivo: instancing en escaleras/hierba/lumas, fog 560
