# Mael & Oryn: El Primer Destello 🏝️✨

Prototipo jugable de **platformer 3D de aventura para móvil vertical (9:16)**,
homenaje original a los collectathons clásicos de principios de los 2000.
IP 100 % original: personajes, mundo, historia, enemigos, nombres y assets
propios (todo generado por código con primitivas low-poly, reemplazable por
arte final).

> «La luz más pequeña puede convertirse en la razón más grande para salvar un mundo.»

## Historia (Capítulo 1 · Costa Brillante)

La explosión de **Noxia** (la energía corrupta) dispersó los **Lumas** —los
cristales de **Auralis**, la energía viva de **Isla Auria** — y transformó a
**Oryn**, el fiel compañero de **Mael Veyra**, en una criatura pequeña y
brillante con cola de agua luminosa. Guiados por la voz de **Elaria del
Alba** y la luz dorada de **Liora** (el Primer Destello), Mael y Oryn
recorren la Costa Brillante recuperando Lumas, esquivando a los **Grubs**
corrompidos y despertando el santuario antiguo al final de la costa.

- **Mael Veyra** — protagonista jugable (tercera persona)
- **Oryn** — compañero cómico que flota junto a Mael
- **Elaria del Alba** — guía espiritual (voz en burbujas violeta)
- **Liora** — luz dorada que señala el camino; **brilla más cuantos más Lumas recoges**
- **Lumas** — ~40 coleccionables en el nivel (incluye los escondidos en cajas)
- **Grubs** — criaturas corrompidas por la Noxia que patrullan
- **Meta** — tótem-portal de energía entre ruinas antiguas

## Stack

Web: **Next.js + Three.js + TypeScript**. Se eligió la alternativa web del
brief porque permite un prototipo *jugable hoy mismo* en cualquier teléfono
(sin builds nativas). La arquitectura replica los scripts pedidos para que
portar a Unity C# sea casi mecánico (ver tabla al final).

## Cómo ejecutarlo

```bash
npm install
npm run dev
```

Abre **http://localhost:3000/game**.

### Probar en el teléfono (recomendado)

1. Asegúrate de que el teléfono y el PC están en la misma red Wi-Fi.
2. Arranca con `npm run dev -- -H 0.0.0.0`.
3. En el teléfono abre `http://<IP-de-tu-PC>:3000/game`.
4. Juega en vertical. (Opcional: «Añadir a pantalla de inicio» para modo
   pantalla completa.)

### Simular móvil en escritorio

- Abre las DevTools del navegador → modo dispositivo (Ctrl/Cmd+Shift+M) →
  elige un teléfono en vertical. La página ya limita el lienzo a una franja
  9:16 centrada, así que también puedes jugar sin DevTools.
- Controles de teclado para pruebas: **WASD/flechas** mover, **Espacio**
  saltar (dos veces = doble salto), **J/K** atacar. El joystick también
  funciona con el ratón.

## Controles táctiles

| Control | Posición | Acción |
|---|---|---|
| Joystick virtual | abajo-izquierda | caminar (suave) / correr (a fondo) |
| SALTO | abajo-derecha | salto; en el aire, doble salto |
| GIRO | sobre el salto | quieto/lento: ataque giratorio · corriendo: golpe hacia adelante |
| ⏸ | arriba-derecha | pausa |

## Diseño del nivel (mini mundo abierto)

Costa Brillante ya no es un pasillo: es un hub con **3 caminos visibles**
y el **Faro del Alba** dominando el horizonte. El objetivo es reunir
**3 Destellos de Auralis (de 6)** — cada uno con un reto distinto — y
activar el faro:

| Destello | Reto | Estado |
|---|---|---|
| Del Faro | Ruta vertical de plataformas en espiral | ✔ jugable |
| Del Coral Dormido | Usar las embestidas del **Caracoral Brute** para romper 3 rocas corruptas y purificar la playa | ✔ jugable |
| De Oryn | Seguir el olfato de Oryn (ladrido + huellas brillantes) hasta una reliquia enterrada y excavarla con un ataque | ✔ jugable |
| De los Quiríes | Mini-misión de las 5 notas de luz | teaser (próx.) |
| De la Cueva Azul | Puzzle tras la cascada sellada | teaser (próx.) |
| Del Desafío de Mael | Ruta cronometrada del santuario | teaser (próx.) |

## Reglas del juego

- **Los Lumas son moneda**, no el objetivo: caen de enemigos y cajas, y
  el santuario rosa de la aldea cura toda la vida por 10 Lumas.
- 3 corazones; invulnerabilidad breve con parpadeo tras cada golpe.
- Caer al agua resta un corazón y te devuelve al último checkpoint.
- **Salta sobre un Grub** para aplastarlo y rebotar; **ataca en el aire**
  para hacer ground pound de área; los **trampolines teal** te lanzan a
  los atajos.
- El Caracoral es invulnerable: atácalo o ponte en línea con una roca
  corrupta para que su embestida la rompa.
- Con 3 Destellos, vuelve al pedestal del faro → secuencia de activación
  y pantalla de progreso del nivel.

## Estructura del código (`src/game/`)

| Archivo | Responsabilidad | Equivalente Unity |
|---|---|---|
| `GameManager.ts` | Estados, bucle, cableado entre sistemas, diálogo inicial | `GameManager.cs` |
| `PlayerController.ts` | Movimiento, saltos, ataques, respawn/checkpoints | `PlayerController.cs` + `RespawnSystem.cs` |
| `CameraController.ts` | Cámara tercera persona vertical suavizada | `CameraController.cs` (o Cinemachine) |
| `MobileInputController.ts` | Joystick virtual + botones + teclado | `MobileInputController.cs` |
| `LevelManager.ts` | Construcción del nivel, cajas (`BreakableBox`), ruinas | escena + `LevelManager.cs`/`BreakableBox.cs` |
| `CollectibleManager.ts` | Lumas: flotación, imán, recogida | `CollectibleManager.cs` |
| `EnemyController.ts` | Grubs: patrulla, contacto, derrota | `EnemyController.cs` |
| `HealthSystem.ts` | Corazones e invulnerabilidad | `HealthSystem.cs` |
| `UIManager.ts` | HUD, pantallas, burbujas de diálogo por personaje | `UIManager.cs` (Canvas) |
| `GoalPortal.ts` | Tótem de meta y disparo de victoria | `GoalPortal.cs` |
| `CompanionOryn.ts` | Compañero volador con física de muelle | `CompanionOryn.cs` |
| `Liora.ts` | Luz guía dorada; intensidad ligada al progreso | `Liora.cs` |
| `AudioManager.ts` | SFX y música placeholder (WebAudio sintetizado) | `AudioManager.cs` |
| `Effects.ts` | Partículas: estallidos y anillo de ataque | ParticleSystem |

## Parámetros rápidos de tuning

En `PlayerController.ts`: `walkSpeed`, `runSpeed`, `gravity`, `jumpVelocity`,
`doubleJumpVelocity`, radio/cooldown del ataque. En `CameraController.ts`:
`offset`, `lookAhead`, `followLerp`. El layout del nivel está en
`LevelManager.ts` con coordenadas comentadas zona por zona. Los diálogos del
capítulo están en `GameManager.ts` (`playIntro` y `storyMoments`).

## Identidad visual

La dirección de arte completa (paleta caribeña, personajes, Quiríes,
calzadas de piedra, pueblito pastel y temas por región) está en
[`ART_DIRECTION.md`](./ART_DIRECTION.md).

## Próximas regiones (hoja de ruta)

Selva del Canto → Pueblo de Solarena → Acantilados de Bruma Azul →
Bosque de Lluvia Dorada → Volcán del Núcleo → Santuario del Primer
Destello. La estructura modular (`LevelManager` por nivel) está pensada
para añadirlas como capítulos independientes.
