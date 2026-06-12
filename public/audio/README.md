# Música del juego

Pistas actuales (libres, CC0 — dominio público):

- `menu.mp3` — pantalla de título, **45 %** de volumen. Empieza con el
  primer toque en el menú. ("Theme 6", pack Ninja Adventure)
- `music.mp3` — durante el juego, **35 %** de volumen, en bucle.
  ("Theme 1", pack Ninja Adventure)

Origen: [Superpowers Asset Packs](https://github.com/sparklinlabs/superpowers-asset-packs)
(licencia CC0 — sin atribución obligatoria; normalizadas a −16 LUFS y
comprimidas a MP3 128 kbps). Ver `public/models/LICENSES.md`.

## Cómo reemplazarlas por tu propia música

1. Exporta como **MP3** (128-192 kbps; ideal < 4 MB para móvil) y pensado
   para **loop** (sin final abrupto).
2. Sobrescribe `menu.mp3` y/o `music.mp3` en esta carpeta:
   - Desde GitHub web: Add file → Upload files en `public/audio/`
     de la rama del juego, o
   - dímelo a mí y lo integro (comprimo y normalizo el volumen).
3. Commit → en el siguiente deploy suena en el juego.

## Dónde conseguir música

- **IA**: [Suno](https://suno.com) o [Udio](https://udio.com) — pídeles
  "tropical adventure game music, loop, orchestral ukulele steel drums,
  no vocals". Revisa la licencia de tu plan para uso comercial.
- **Libre de derechos**: Pixabay Music, FreePD, Kevin MacLeod
  (incompetech, CC-BY con crédito).
