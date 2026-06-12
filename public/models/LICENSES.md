# Licencias de assets de terceros

Todo el IP del juego (personajes, historia, nombres, mundo) es 100 % original.
Los modelos listados abajo son arte de librería libre usado como decorado y
props, bajo licencia MIT. Cada carpeta incluye su copia de la licencia.

## Kenney — Starter Kit City Builder (`kenney-city/`)

- Fuente: https://github.com/KenneyNL/Starter-Kit-City-Builder
- Licencia: MIT — Copyright (c) 2025 Kenney (ver `kenney-city/LICENSE.md`)
- Archivos: `building-small-a/b/c/d.glb` (casas del Lower District),
  `pavement-fountain.glb` (fuentes de plaza), `grass-trees.glb` y
  `grass-trees-tall.glb` (jardines), `Textures/colormap.png`

## Kenney — Starter Kit 3D Platformer (`kenney-plat/`)

- Fuente: https://github.com/KenneyNL/Starter-Kit-3D-Platformer
- Licencia: MIT — Copyright (c) 2025 Kenney (ver `kenney-plat/LICENSE.md`)
- Archivos: `flag.glb` (banderas de checkpoint), `brick.glb` (cajas
  rompibles), `Textures/colormap.png`

## Superpowers Asset Packs — música (`public/audio/`)

- Fuente: https://github.com/sparklinlabs/superpowers-asset-packs
- Licencia: CC0 1.0 (dominio público, sin atribución obligatoria)
- Archivos: `audio/menu.mp3` (Ninja Adventure "Theme 6") y
  `audio/music.mp3` (Ninja Adventure "Theme 1"), normalizados a −16 LUFS
  y recodificados a MP3 128 kbps

## Notas técnicas

- Los `.glb` de Kenney referencian `Textures/colormap.png` con ruta relativa:
  conservar la subcarpeta `Textures/` junto a los modelos.
- `AssetLibrary` carga primero `<slot>.glb` en la raíz de `models/` (arte
  propio drop-in) y usa estos archivos solo como respaldo del slot.
