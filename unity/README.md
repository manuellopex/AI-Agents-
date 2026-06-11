# Mael & Oryn — Sistema de personajes 3D (Unity + URP)

Proyecto Unity con el pipeline visual y técnico de los 6 personajes del
juego: shader toon estilizado, librería de materiales con la paleta
oficial, modelos proxy con silueta y personalidad, animaciones
placeholder, prefabs estructurados para reemplazo por arte final y la
escena de revisión `CharacterShowcase`.

## Requisitos

- **Unity 2022.3 LTS** (o superior) con el módulo Android/iOS si vas a
  probar en dispositivo.
- El paquete **URP** se instala solo (está en `Packages/manifest.json`).

## Puesta en marcha (5 minutos)

1. Abre esta carpeta (`unity/`) con Unity Hub → *Add project from disk*.
2. Crea el asset de URP (una sola vez):
   *Assets → Create → Rendering → URP Asset (with Universal Renderer)*,
   y asígnalo en *Edit → Project Settings → Graphics → Default Render
   Pipeline*. Activa *Soft Shadows* en el asset URP.
3. Menú **Isla Auria → 1. Generar materiales estilizados**.
4. Menú **Isla Auria → 2. Character Prefab Builder** → *★ Construir TODOS*.
5. Menú **Isla Auria → 3. Generar escena CharacterShowcase**.
6. Abre `Assets/Scenes/CharacterShowcase.unity`, pulsa **Play**:
   - Arrastra con el ratón/dedo para orbitar; rueda/pellizco para zoom.
   - Teclas **1-7**, flechas, o los botones en pantalla cambian la
     animación de todos los personajes a la vez.

## Qué incluye

| Pieza | Dónde |
|---|---|
| Shader toon URP (ramp, rim, emisión, outline, móvil) | `Assets/Shaders/Stylized/StylizedToon.shader` |
| Librería de materiales (MAT_Skin_Warm, MAT_Gold_Stylized, glows…) | generada en `Assets/Characters/_Shared/Materials` |
| Proxies con personalidad (Mael, Oryn, Elaria, Liora, Varkon, Seralya) | `ProxyMeshFactory.cs` → prefabs en `Assets/Characters/<N>/Prefabs` |
| Animaciones placeholder + AnimatorControllers | generadas en `Assets/Characters/<N>/Animations` |
| Attachment points, colliders, glow, VFX | dentro de cada prefab |
| Comportamientos: seguimiento de Oryn, espíritu Liora, pulso de glow | `Assets/Characters/_Shared/Scripts` |
| Herramientas de editor (menú Isla Auria) | `Assets/Editor/CharacterTools` |
| Scripts Blender para proxies orgánicos (GLB) | `Tools/Blender/generate_*_proxy.py` |
| Guía de reemplazo por modelos finales y presupuestos móviles | `Assets/Characters/Character_Art_Implementation_Guide.md` |

## Filosofía del pipeline

Los assets serializados (materiales, prefabs, clips, escena) **se generan
con las herramientas del menú**, no viven en el repositorio: así siempre
son válidos para tu versión de Unity y se regeneran tras cualquier cambio
de diseño. El código fuente (shader, C#, Python) es la única fuente de
verdad.

Coloca tus concept arts en `Assets/Art/References/` — son la referencia
canónica para los modelos finales que reemplazarán a los proxies.
