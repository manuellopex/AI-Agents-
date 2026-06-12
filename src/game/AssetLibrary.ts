import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applyCloudShadows } from './CloudShadows';

/**
 * AssetLibrary — Paso 2 del plan Coastal World: arte real
 * ---------------------------------------------------------
 * Carga modelos GLB desde public/models/ (generados con Meshy/Tripo desde
 * los concept arts, o esculpidos en Blender). Si un archivo no existe, el
 * juego usa su versión procedural: los modelos finales se "enchufan"
 * soltando el .glb en la carpeta, sin tocar código.
 *
 * Convenciones (ver public/models/README.md):
 *  - nombres: mael.glb, oryn.glb, tree.glb, rock.glb, house.glb…
 *  - escala en metros (Mael ≈ 1.75 de alto), pies en el origen, frente +Z
 *  - personajes: clips de animación con palabras clave en el nombre
 *    (idle, run, jump, fall, spin/attack, punch)
 */
/**
 * Slots con arte de librerías libres ya integrado (Kenney, licencia MIT —
 * ver public/models/LICENSES.md). Cada slot apunta a un archivo dentro de
 * public/models/; los GLB de Kenney referencian Textures/colormap.png
 * relativo, por eso se conserva la estructura de subcarpetas.
 */
const SLOT_PATHS: Record<string, string> = {
  house: 'kenney-city/building-small-a',
  house2: 'kenney-city/building-small-b',
  house3: 'kenney-city/building-small-c',
  house4: 'kenney-city/building-small-d',
  fountain: 'kenney-city/pavement-fountain',
  garden: 'kenney-city/grass-trees',
  garden2: 'kenney-city/grass-trees-tall',
  flag: 'kenney-plat/flag',
  crate: 'kenney-plat/brick',
};

export class AssetLibrary {
  private cache = new Map<string, THREE.Group | null>();
  private clips = new Map<string, THREE.AnimationClip[]>();
  private loader: GLTFLoader;

  constructor() {
    this.loader = new GLTFLoader();
    // Soporte Draco (modelos comprimidos de Meshy/Tripo)
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    this.loader.setDRACOLoader(draco);
  }

  /** Prefijo de ruta correcto tanto en local como en GitHub Pages. */
  private basePath(): string {
    if (typeof window === 'undefined') return '';
    const path = window.location.pathname;
    const idx = path.indexOf('/game');
    return idx > 0 ? path.slice(0, idx) : '';
  }

  /**
   * Intenta cargar una lista de modelos; los que falten quedan en null.
   * Primero busca `<nombre>.glb` en la raíz (arte propio, drop-in); si no
   * existe y el slot tiene arte de librería libre, usa ese como respaldo.
   */
  async preload(names: string[]): Promise<void> {
    await Promise.all(names.map(async (name) => {
      const candidates = [name];
      if (SLOT_PATHS[name]) candidates.push(SLOT_PATHS[name]);
      for (const file of candidates) {
        try {
          const gltf = await this.loader.loadAsync(`${this.basePath()}/models/${file}.glb`);
          gltf.scene.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (mesh.isMesh) {
              mesh.castShadow = true;
              // Coherencia con el mundo: las nubes también ensombrecen los GLB
              const mat = mesh.material as THREE.MeshStandardMaterial;
              if (mat && mat.isMeshStandardMaterial) applyCloudShadows(mat);
            }
          });
          this.cache.set(name, gltf.scene);
          this.clips.set(name, gltf.animations ?? []);
          return;
        } catch {
          // probar siguiente candidato
        }
      }
      this.cache.set(name, null); // no existe: se usará el procedural
    }));
  }

  has(name: string): boolean {
    return !!this.cache.get(name);
  }

  /**
   * Clon listo para colocar (soporta mallas con esqueleto).
   * @param targetHeight si se indica, normaliza la altura total en metros
   */
  getClone(name: string, targetHeight?: number): THREE.Group | null {
    const source = this.cache.get(name);
    if (!source) return null;
    const model = skeletonClone(source) as THREE.Group;
    if (targetHeight) {
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      if (size.y > 0.0001) {
        const s = targetHeight / size.y;
        model.scale.setScalar(s);
        // Pies al origen
        model.position.y = -box.min.y * s;
      }
    }
    return model;
  }

  getAnimations(name: string): THREE.AnimationClip[] {
    return this.clips.get(name) ?? [];
  }
}
