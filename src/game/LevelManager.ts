import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { applyCloudShadows } from './CloudShadows';
import type { AssetLibrary } from './AssetLibrary';
import type { CorruptRock } from './CaracoralBrute';
import { WaterSurface, IslandShore } from './WaterSurface';

/** Obstáculo cilíndrico simple (árboles, rocas, cajas) para colisión lateral. */
export interface Obstacle {
  position: THREE.Vector3;
  radius: number;
}

/** Definición de patrulla de un enemigo (de pointA a pointB y vuelta). */
export interface EnemyDef {
  pointA: THREE.Vector3;
  pointB: THREE.Vector3;
}

/** Caja rompible que suelta Lumas al romperse. */
export interface Crate {
  mesh: THREE.Mesh;
  obstacle: Obstacle;
  broken: boolean;
}

/** Trampolín que lanza al jugador hacia arriba (atajos del LDD). */
export interface BouncePad {
  position: THREE.Vector3;
  power: number;
  mesh: THREE.Mesh;
}

/** Punto de interacción narrativo. */
export interface Trigger {
  id: string;
  position: THREE.Vector3;
  radius: number;
}

/**
 * LevelManager — "Costa Brillante" a escala del Level Design Document
 * ----------------------------------------------------------------------
 * Una ÚNICA isla grande (mapa de la página 3 del LDD) con tres terrazas
 * de altura y las 8 áreas a distancia real (~70 unidades del spawn al
 * faro):
 *
 *   1. Hub Inicial – Playa Central (sur, y=1: aldea, spawn, 3 rutas)
 *   2. Playa del Coral Dormido (costa oeste: Caracoral + 3 rocas)
 *   3. Cueva Azul (acantilado oeste de la meseta, tras la cascada)
 *   4. Ruta Vertical del Faro (espiral en el pico norte)
 *   5. Faro del Alba (cima, visible desde toda la isla)
 *   6. Arboleda de los Quiríes (este del hub: 5 Notas de Luz)
 *   7. Sendero de Oryn (camino del este: reliquia enterrada)
 *   8. Santuario del Desafío (terraza noreste: arena de oleadas)
 *
 * Conectividad: pendientes caminables entre terrazas, escalones en las
 * rutas principales y 4 trampolines de atajo.
 */
export class LevelManager {
  readonly group = new THREE.Group();
  readonly groundMeshes: THREE.Mesh[] = [];
  readonly obstacles: Obstacle[] = [];
  readonly crates: Crate[] = [];
  readonly crystalPositions: THREE.Vector3[] = [];
  readonly enemyDefs: EnemyDef[] = [];
  readonly checkpoints: THREE.Vector3[] = [];
  readonly pads: BouncePad[] = [];
  readonly triggers: Trigger[] = [];
  readonly killY = -0.45;

  // --- Faro del Alba (área 5, pico norte) ---
  readonly faroPedestalPos = new THREE.Vector3(0, 8, -38.5);
  readonly faroDestelloPos = new THREE.Vector3(0, 21.6, -44);
  private faroCrystal!: THREE.Mesh;
  private faroBeam!: THREE.Mesh;
  private faroCrystalMat!: THREE.MeshStandardMaterial;
  private faroActivated = false;

  // --- Playa del Coral Dormido (área 2, oeste) ---
  readonly corruptRocks: CorruptRock[] = [];
  readonly westCenter = new THREE.Vector3(-36, 1.15, 4);
  readonly westBounds = { minX: -44, maxX: -28, minZ: -4, maxZ: 12 };
  readonly coralDestelloPos = new THREE.Vector3(-36, 2.6, 4);

  // --- Sendero de Oryn (área 7, este) ---
  readonly orynZoneCenter = new THREE.Vector3(32, 1, -2);
  readonly orynZoneRadius = 12;
  readonly moundPos = new THREE.Vector3(38, 1, -6);
  readonly orynDestelloPos = new THREE.Vector3(38, 2.4, -6);
  private mound!: THREE.Mesh;
  private relic!: THREE.Group;
  private relicRise = -1;

  // --- Cueva Azul (área 3: interior remoto, entrada en el acantilado) ---
  readonly caveInsidePos = new THREE.Vector3(83, 7.1, -18);
  readonly caveOutsidePos = new THREE.Vector3(-23.5, 4.7, -14);
  readonly caveExitPos = new THREE.Vector3(82, 7.1, -14.5);
  readonly cavePlates: { mesh: THREE.Mesh; pressed: boolean; pos: THREE.Vector3 }[] = [];
  readonly caveChestPos = new THREE.Vector3(97, 7.6, -18);
  readonly caveDestelloPos = new THREE.Vector3(97, 9, -18);
  private caveBridge!: THREE.Mesh;
  private caveChestLid!: THREE.Mesh;
  caveBridgeOpen = false;
  caveChestOpened = false;

  // --- Arboleda de los Quiríes (área 6) ---
  readonly notes: { group: THREE.Group; collected: boolean; position: THREE.Vector3 }[] = [];
  readonly quiriAltarPos = new THREE.Vector3(16, 1, 8);
  readonly quiriDestelloPos = new THREE.Vector3(16, 3.2, 8);

  // --- Santuario del Desafío (área 8, terraza noreste) ---
  readonly arenaCenter = new THREE.Vector3(20, 4.55, -34);
  readonly arenaDestelloPos = new THREE.Vector3(20, 7, -34);
  private braziers: THREE.Mesh[] = [];

  private time = 0;
  private water2!: WaterSurface;
  private shores: IslandShore[] = [];
  private quiries: { mesh: THREE.Group; phase: number }[] = [];
  private glimmers: { mesh: THREE.Mesh; phase: number }[] = [];

  // Materiales compartidos — paleta caribeña de Isla Auria
  private matRock = new THREE.MeshStandardMaterial({ color: 0xb3ab98, roughness: 0.9 });
  private matTrunk = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 });
  private matLeaf = new THREE.MeshStandardMaterial({ color: 0x2fa05e, roughness: 0.85 });
  private matCrate = new THREE.MeshStandardMaterial({ color: 0xc96f4a, roughness: 0.8 });
  private matStone = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.85 });
  private matNoxia = new THREE.MeshStandardMaterial({
    color: 0x5a3a78, emissive: 0x3a1060, emissiveIntensity: 0.6,
  });
  private matGoldGlow = new THREE.MeshStandardMaterial({
    color: 0xffd34d, emissive: 0xffaa00, emissiveIntensity: 0.8,
  });
  /** Material único del terreno: vertex colors + nubes + matices splat. */
  private terrainMat = (() => {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
    applyCloudShadows(mat, true);
    return mat;
  })();

  private assets: AssetLibrary | null;

  constructor(scene: THREE.Scene, assets: AssetLibrary | null = null) {
    this.assets = assets;
    this.buildTerrain();
    this.buildCliffRocks();
    this.buildFloatingIsles();
    this.buildWater();
    this.buildVista();
    this.buildHubArea();
    this.buildCoralBeach();
    this.buildFaro();
    this.buildSendero();
    this.buildGroveAndArena();
    this.buildCaveEntrance();
    this.buildCaveInterior();
    this.buildNotes();
    this.buildDecorations();
    this.buildCrates();
    this.buildPads();
    this.buildGlimmers();
    this.placeLumas();
    this.placeEnemies();
    scene.add(this.group);
  }

  // ------------------------------------------------------------------
  // Terreno: una isla continental con tres terrazas
  // ------------------------------------------------------------------

  private addPlatform(x: number, yTop: number, z: number, w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(0.12, h * 0.25)), mat);
    mesh.position.set(x, yTop - h / 2, z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this.group.add(mesh);
    this.groundMeshes.push(mesh);
    return mesh;
  }

  /** Montículo/isla esculpida con costa irregular y colores por vértice. */
  private addIsland(cx: number, cz: number, rx: number, rz: number, topY: number,
    topColor: number, seed: number, registerShore = false): void {
    const SEG = 52;
    const geo = new THREE.PlaneGeometry(2, 2, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const cTop = new THREE.Color(topColor);
    const cSand = new THREE.Color(0xeed3a0);
    const cWet = new THREE.Color(0xc9a96e);
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const nx = pos.getX(i);
      const nz = pos.getZ(i);
      const ang = Math.atan2(nz, nx);
      const rMod = 1 + 0.09 * Math.sin(3 * ang + seed) + 0.06 * Math.sin(7 * ang + seed * 2.3);
      const e = Math.hypot(nx, nz) / rMod;
      let h: number;
      if (e < 0.78) {
        h = topY + Math.sin(nx * 9 + seed) * Math.cos(nz * 8 + seed) * 0.05;
      } else {
        const t = Math.min((e - 0.78) / 0.27, 1);
        const sm = t * t * (3 - 2 * t);
        h = topY - sm * (topY + 1.5);
      }
      pos.setXYZ(i, nx * rx, h, nz * rz);
      if (e < 0.7) tmp.copy(cTop);
      else if (e < 0.85) tmp.copy(cTop).lerp(cSand, (e - 0.7) / 0.15);
      else tmp.copy(cSand).lerp(cWet, Math.min((e - 0.85) / 0.15, 1));
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, this.terrainMat);
    mesh.position.set(cx, 0, cz);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.groundMeshes.push(mesh);
    if (registerShore) this.shores.push({ x: cx, z: cz, rx, rz });
  }

  /** La isla continental: base (playa) + meseta central + tierras altas. */
  private buildTerrain(): void {
    this.addIsland(0, -8, 52, 44, 1, 0x58b368, 2.1, true);      // base: playa sur y costas
    this.addIsland(0, -22, 34, 26, 4.5, 0x4ca65e, 5.3);         // meseta central
    this.addIsland(0, -40, 23, 17, 8, 0x58b368, 9.7);           // tierras altas del norte
    this.addIsland(-36, 4, 13, 11, 1.15, 0xeed3a0, 7.7);        // arenal del Coral Dormido
  }

  /**
   * Riscos instanciados bordeando las terrazas: los bordes de las mesetas
   * ganan volumen 3D real en lugar de una pendiente lisa (1 draw call).
   */
  private buildCliffRocks(): void {
    const rings: [number, number, number, number, number, number, number][] = [
      // cx, cz, rx, rz, yTop, cantidad, escala
      [0, -22, 34, 26, 4.4, 34, 1.5],   // borde de la meseta central
      [0, -40, 23, 17, 7.9, 26, 1.3],   // borde de las tierras altas
      [0, -8, 52, 44, 0.9, 30, 1.8],    // costa de la isla base
    ];
    const total = rings.reduce((sum, r) => sum + r[5], 0);
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xb9b09b, roughness: 0.95 });
    applyCloudShadows(mat);
    const rocks = new THREE.InstancedMesh(geo, mat, total);
    rocks.frustumCulled = false;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (const [cx, cz, rx, rz, yTop, count, scale] of rings) {
      for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2 + Math.sin(k * 7.3) * 0.15;
        // Sobre la pendiente, justo bajo el borde de la meseta (e ≈ 0.83)
        const e = 0.83 + Math.random() * 0.06;
        dummy.position.set(cx + Math.cos(a) * rx * e, yTop - 0.7 - Math.random() * 0.6, cz + Math.sin(a) * rz * e);
        dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * 0.5);
        dummy.scale.set(
          scale * (0.7 + Math.random() * 0.8),
          scale * (0.5 + Math.random() * 0.5),
          scale * (0.7 + Math.random() * 0.6),
        );
        dummy.updateMatrix();
        rocks.setMatrixAt(i++, dummy.matrix);
      }
    }
    this.group.add(rocks);
  }

  /**
   * Islas flotantes sobre las bahías: verticalidad explorable con Lumas
   * en anillo y lianas colgando. Se puede aterrizar en ellas.
   */
  private buildFloatingIsles(): void {
    const isles: [number, number, number, number][] = [
      // x, y, z, radio
      [-26, 7, 16, 3.2], [40, 8.5, 8, 2.6], [-12, 11, -58, 3],
    ];
    const rockMat = new THREE.MeshStandardMaterial({ color: 0xa89a82, roughness: 0.95 });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x58b368, roughness: 0.9 });
    const vineMat = new THREE.MeshStandardMaterial({ color: 0x3f7d4a, roughness: 0.9 });
    for (const [x, y, z, r] of isles) {
      // Base rocosa en punta invertida + tapa de césped pisable
      const base = new THREE.Mesh(new THREE.ConeGeometry(r, r * 1.6, 9), rockMat);
      base.rotation.x = Math.PI;
      base.position.set(x, y - r * 0.8, z);
      base.castShadow = true;
      this.group.add(base);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, 0.5, 12), grassMat);
      top.position.set(x, y + 0.25, z);
      top.receiveShadow = true;
      this.group.add(top);
      this.groundMeshes.push(top);
      // Lianas colgando (profundidad vertical)
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + 0.5;
        const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 1.6 + Math.random(), 5), vineMat);
        vine.position.set(x + Math.cos(a) * r * 0.8, y - 0.9, z + Math.sin(a) * r * 0.8);
        vine.rotation.z = (Math.random() - 0.5) * 0.2;
        this.group.add(vine);
      }
      // Recompensa: anillo de Lumas sobre la isla
      this.lumaRing(x, y + 1.6, z, r * 0.6, 5);
    }
  }

  private buildWater(): void {
    this.water2 = new WaterSurface(this.group as unknown as THREE.Scene, this.shores, new THREE.Vector3(18, 35, -10));
  }

  // ------------------------------------------------------------------
  // Área 1: Hub Inicial — Playa Central
  // ------------------------------------------------------------------
  private buildHubArea(): void {
    this.checkpoints.push(new THREE.Vector3(0, 1, 24)); // spawn

    // Aldea pastel
    this.addHouse(-7, 1, 18, 0xf2917e, 0.4);
    this.addHouse(7, 1, 19, 0x8fd6cf, -0.4);
    this.addHouse(12, 1, 12, 0xf5e6c4, -0.9);

    // Santuario de corazones (Lumas como moneda)
    const heartBase = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.5, 8), this.matStone);
    heartBase.position.set(10, 1.25, 17);
    this.group.add(heartBase);
    const heart = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xff6b8a, emissive: 0xa01030, emissiveIntensity: 0.6 }),
    );
    heart.position.set(10, 1.9, 17);
    this.group.add(heart);
    this.triggers.push({ id: 'corazones', position: new THREE.Vector3(10, 1, 17), radius: 2 });
    this.obstacles.push({ position: new THREE.Vector3(10, 1, 17), radius: 0.9 });

    // Calzadas: ruta principal al norte + ramales oeste y este
    this.addRoad(0, 22, 0, 2, 1.05);                  // hub → subida a la meseta
    this.addRoadX(-3, -28, 6, 1.05);                  // oeste → Playa del Coral
    this.addRoadX(3, 30, 2, 1.05);                    // este → Sendero de Oryn
    this.addRoad(0, -6, 0, -20, 4.6);                 // meseta: hacia el norte
    this.addRoad(0, -28, 0, -36, 8.05);               // tierras altas → faro

    // Escalones de transición entre terrazas
    this.addPlatform(0, 2.2, 0.2, 7, 1.2, 3, this.matRock);
    this.addPlatform(0, 3.4, -2.2, 7, 1.2, 3, this.matRock);
    this.addPlatform(0, 5.8, -23.5, 7, 1.2, 3, this.matRock);
    this.addPlatform(0, 7.1, -25.8, 7, 1.2, 3, this.matRock);

    // Estandartes marcando las rutas
    this.addBanner(-1.9, 1, 8, 0x2ec4b6);
    this.addBanner(1.9, 1, 8, 0xffd34d);
    this.addBanner(-12, 1, 5.2, 0x2ec4b6);
    this.addBanner(14, 1, 1, 0xffd34d);
    this.addBanner(-1.9, 4.55, -10, 0xffd34d);
    this.addBanner(1.9, 4.55, -10, 0x2ec4b6);
  }

  // ------------------------------------------------------------------
  // Área 2: Playa del Coral Dormido
  // ------------------------------------------------------------------
  private buildCoralBeach(): void {
    this.checkpoints.push(new THREE.Vector3(-29, 1.15, 4));
    for (const [x, z] of [[-42, 0], [-30, -2], [-40, 9]] as const) {
      const rockGroup = new THREE.Group();
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 1), this.matNoxia);
      rock.position.y = 0.9;
      rock.rotation.set(Math.random(), Math.random(), 0);
      rock.castShadow = true;
      rockGroup.add(rock);
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), this.matNoxia);
      shard.position.set(0.5, 1.7, 0.2);
      rockGroup.add(shard);
      rockGroup.position.set(x, 1.15, z);
      this.group.add(rockGroup);
      this.corruptRocks.push({ mesh: rockGroup, position: new THREE.Vector3(x, 1.15, z), broken: false });
    }
  }

  // ------------------------------------------------------------------
  // Áreas 4 y 5: Ruta Vertical + Faro del Alba (pico norte)
  // ------------------------------------------------------------------
  private buildFaro(): void {
    this.checkpoints.push(new THREE.Vector3(0, 8, -36));
    this.checkpoints.push(new THREE.Vector3(0, 4.55, -20)); // meseta central

    // Torre del faro: corona el pico norte, visible desde toda la isla
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.7, 12, 28), this.matStone);
    tower.position.set(0, 14, -44);
    tower.castShadow = true;
    this.group.add(tower);
    this.obstacles.push({ position: new THREE.Vector3(0, 8, -44), radius: 2.45 });
    for (const y of [11, 14, 17]) {
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(2.3 - (y - 11) * 0.05, 2.34 - (y - 11) * 0.05, 0.7, 24),
        new THREE.MeshStandardMaterial({ color: 0x2aa6a0 }));
      stripe.position.set(0, y, -44);
      this.group.add(stripe);
    }
    const top = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.5, 18), this.matStone);
    top.position.set(0, 20.05, -44);
    this.group.add(top);
    this.groundMeshes.push(top);

    this.faroCrystalMat = new THREE.MeshStandardMaterial({ color: 0x9fb8c8, emissive: 0x223344, emissiveIntensity: 0.3 });
    this.faroCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.0), this.faroCrystalMat);
    this.faroCrystal.position.set(0, 21.5, -44);
    this.group.add(this.faroCrystal);

    this.faroBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 1.5, 34, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.0, side: THREE.DoubleSide }),
    );
    this.faroBeam.position.set(0, 38, -44);
    this.group.add(this.faroBeam);

    // Pedestal de activación al pie de la torre
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 0.6, 8), this.matStone);
    pedestal.position.set(0, 8.3, -38.5);
    this.group.add(pedestal);
    this.groundMeshes.push(pedestal);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const socket = new THREE.Mesh(new THREE.OctahedronGeometry(0.16),
        new THREE.MeshStandardMaterial({ color: 0x6a6052 }));
      socket.position.set(Math.cos(a) * 0.55, 8.72, -38.5 + Math.sin(a) * 0.55);
      this.group.add(socket);
    }

    // Ruta Vertical: espiral de plataformas alrededor de la torre
    const spiral: [number, number, number][] = [
      [0, 9.4, -39.5], [3.2, 10.7, -41], [4.5, 12, -44], [3.2, 13.3, -47],
      [0, 14.6, -48.5], [-3.2, 15.9, -47], [-4.5, 17.2, -44], [-3.2, 18.4, -41],
    ];
    for (const [x, y, z] of spiral) {
      this.addPlatform(x, y, z, 2.6, 0.6, 2.6, this.matRock);
    }

    // Ruinas ceremoniales alrededor del pedestal
    this.addColumn(-3, 8, -40, 2.4, false);
    this.addColumn(3, 8, -40, 2.4, false);
    this.addColumn(-4, 8, -47, 1.6, true);
    this.addColumn(4.2, 8, -46.5, 2, true);
  }

  // ------------------------------------------------------------------
  // Área 7: Sendero de Oryn (este)
  // ------------------------------------------------------------------
  private buildSendero(): void {
    this.checkpoints.push(new THREE.Vector3(28, 1, -2));
    this.addColumn(30, 1, 2.5, 2.2, false);
    this.addColumn(35, 1, 1, 1.4, true);
    this.addColumn(31, 1, -7, 1.8, true);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 0.6), this.matStone);
    lintel.position.set(30.5, 2.9, 2.2);
    lintel.rotation.z = 0.22;
    this.group.add(lintel);

    // Montículo de la reliquia (lo detecta el olfato de Oryn)
    this.mound = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 12, 9),
      new THREE.MeshStandardMaterial({ color: 0xc9a96e, roughness: 0.95 }),
    );
    this.mound.scale.y = 0.45;
    this.mound.position.copy(this.moundPos);
    this.group.add(this.mound);

    this.relic = new THREE.Group();
    const relicBody = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.8, 6), this.matGoldGlow);
    relicBody.position.y = 0.4;
    this.relic.add(relicBody);
    const relicGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), this.matGoldGlow);
    relicGem.position.y = 1.0;
    this.relic.add(relicGem);
    this.relic.position.copy(this.moundPos);
    this.relic.visible = false;
    this.group.add(this.relic);
  }

  // ------------------------------------------------------------------
  // Áreas 6 y 8: Arboleda de los Quiríes + Santuario del Desafío
  // ------------------------------------------------------------------
  private buildGroveAndArena(): void {
    const grove = this.quiriAltarPos;
    this.checkpoints.push(new THREE.Vector3(13, 1, 10));
    const altar = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.95, 0.9, 8), this.matStone);
    altar.position.set(grove.x, 1.45, grove.z);
    this.group.add(altar);
    this.obstacles.push({ position: grove.clone(), radius: 0.95 });
    this.buildQuiriesAt([
      [grove.x - 0.5, 2.2, grove.z + 0.3], [grove.x + 0.5, 2.15, grove.z], [grove.x, 2.4, grove.z - 0.5],
    ]);
    this.triggers.push({ id: 'quiries', position: grove.clone(), radius: 3 });

    // Arena del Santuario del Desafío (terraza noreste)
    const c = this.arenaCenter;
    this.checkpoints.push(new THREE.Vector3(c.x, c.y, c.z + 5));
    const shrine = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 1.2, 6), this.matStone);
    shrine.position.set(c.x, c.y + 0.6, c.z);
    this.group.add(shrine);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.35),
      new THREE.MeshStandardMaterial({ color: 0xffb070, emissive: 0x803010, emissiveIntensity: 0.6 }));
    crystal.position.set(c.x, c.y + 1.6, c.z);
    this.group.add(crystal);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.12, 8, 36),
      new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.8 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(c.x, c.y + 0.06, c.z);
    this.group.add(ring);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      const bx = c.x + Math.cos(a) * 4.6;
      const bz = c.z + Math.sin(a) * 4.0;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.3, 8), this.matStone);
      post.position.set(bx, c.y + 0.65, bz);
      this.group.add(post);
      const brazier = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x553322, emissive: 0x202020, emissiveIntensity: 0.3 }));
      brazier.position.set(bx, c.y + 1.4, bz);
      this.group.add(brazier);
      this.braziers.push(brazier);
      this.obstacles.push({ position: new THREE.Vector3(bx, c.y, bz), radius: 0.35 });
    }
    this.triggers.push({ id: 'desafio', position: c.clone(), radius: 2.5 });
    this.obstacles.push({ position: c.clone(), radius: 1.1 });
  }

  // ------------------------------------------------------------------
  // Área 3: Cueva Azul (entrada con cascada + sala interior remota)
  // ------------------------------------------------------------------
  private buildCaveEntrance(): void {
    const fall = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 5.5),
      new THREE.MeshBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    fall.position.set(-28.2, 2.6, -14);
    fall.rotation.y = Math.PI / 2;
    this.group.add(fall);
    const foam = new THREE.Mesh(
      new THREE.CircleGeometry(2, 14),
      new THREE.MeshBasicMaterial({ color: 0xeafcff, transparent: true, opacity: 0.6 }),
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(-29.5, 0.22, -14);
    this.group.add(foam);
    const door = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 1.3, 0.25, 12),
      new THREE.MeshStandardMaterial({ color: 0x2a3a52, emissive: 0x102040, emissiveIntensity: 0.5 }),
    );
    door.rotation.z = Math.PI / 2;
    door.position.set(-27.6, 2.2, -14);
    this.group.add(door);
    this.triggers.push({ id: 'cueva', position: new THREE.Vector3(-28, 2, -14), radius: 3.2 });
  }

  private buildCaveInterior(): void {
    const darkStone = new THREE.MeshStandardMaterial({ color: 0x3a4a5c, roughness: 0.9 });
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x6fd8ff, emissive: 0x2090c0, emissiveIntensity: 1.1, roughness: 0.3,
    });
    this.addPlatform(86, 7, -18, 11, 1.2, 14, darkStone);
    this.addPlatform(96.5, 7, -18, 6, 1.2, 10, darkStone);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2c3a48, roughness: 1 });
    for (const [x, z, w, d] of [[89.5, -26, 21, 1.5], [89.5, -10, 21, 1.5], [79.5, -18, 1.5, 16], [100, -18, 1.5, 16]] as const) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 7, d), wallMat);
      wall.position.set(x, 9.5, z);
      this.group.add(wall);
    }
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(23, 0.6, 17), wallMat);
    ceiling.position.set(89.5, 13.3, -18);
    this.group.add(ceiling);
    for (const [x, y, z, sc] of [[83, 7.6, -23, 1.1], [87, 7.6, -12.5, 0.8], [95, 7.6, -22.5, 1.3], [81.5, 7.6, -14, 0.7]] as const) {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(sc), crystalMat);
      crystal.position.set(x, y + sc * 0.6, z);
      crystal.rotation.set(0.3, Math.random() * 3, 0.2);
      this.group.add(crystal);
      this.obstacles.push({ position: new THREE.Vector3(x, y, z), radius: sc * 0.8 });
    }
    const light1 = new THREE.PointLight(0x4db8e8, 1.6, 16);
    light1.position.set(86, 10, -18);
    this.group.add(light1);
    const light2 = new THREE.PointLight(0x4db8e8, 1.2, 12);
    light2.position.set(96, 10, -18);
    this.group.add(light2);

    for (const [x, z] of [[85, -23], [85, -13]] as const) {
      const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.9, 0.18, 12),
        new THREE.MeshStandardMaterial({ color: 0x7a92a8, emissive: 0x101820, emissiveIntensity: 0.5 }),
      );
      plate.position.set(x, 7.68, z);
      this.group.add(plate);
      this.cavePlates.push({ mesh: plate, pressed: false, pos: new THREE.Vector3(x, 7.6, z) });
    }

    this.caveBridge = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.35, 3.2),
      new THREE.MeshStandardMaterial({
        color: 0x9fe8ff, emissive: 0x3aa8d8, emissiveIntensity: 0.8, transparent: true, opacity: 0.85,
      }));
    this.caveBridge.position.set(92.3, 7.4, -18);
    this.caveBridge.visible = false;
    this.group.add(this.caveBridge);

    const chestMat = new THREE.MeshStandardMaterial({ color: 0x8a6238, roughness: 0.7 });
    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.8), chestMat);
    chest.position.set(97, 7.95, -18);
    this.group.add(chest);
    this.caveChestLid = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xc89638, metalness: 0.5, roughness: 0.4 }));
    this.caveChestLid.position.set(97, 8.42, -18);
    this.group.add(this.caveChestLid);

    const exitPortal = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.2, 14), crystalMat);
    exitPortal.rotation.z = Math.PI / 2;
    exitPortal.position.set(80.6, 8.4, -14.5);
    this.group.add(exitPortal);

    this.checkpoints.push(this.caveInsidePos.clone());
  }

  openCaveBridge(): void {
    this.caveBridgeOpen = true;
    this.caveBridge.visible = true;
    this.groundMeshes.push(this.caveBridge);
  }

  pressPlate(plate: { mesh: THREE.Mesh; pressed: boolean }): void {
    plate.pressed = true;
    plate.mesh.position.y -= 0.08;
    (plate.mesh.material as THREE.MeshStandardMaterial).emissive.set(0x2ec4b6);
    (plate.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2;
  }

  openCaveChest(): void {
    this.caveChestOpened = true;
    this.caveChestLid.rotation.x = -1.1;
    this.caveChestLid.position.add(new THREE.Vector3(0, 0.1, -0.35));
  }

  /** Las 5 Notas de Luz: árbol, ruinas, cueva, cascada y altura. */
  private buildNotes(): void {
    const noteMat = new THREE.MeshStandardMaterial({
      color: 0xffe9a0, emissive: 0xffb820, emissiveIntensity: 1.2, roughness: 0.3,
    });
    const spots: [number, number, number][] = [
      [-14, 3.6, 14],        // 1. copa del árbol grande del hub
      [33, 2.6, 0],          // 2. ruinas del Sendero de Oryn
      [94, 8.6, -22.5],      // 3. dentro de la Cueva Azul
      [-25.5, 5.4, -16],     // 4. sobre la cascada (borde de la meseta)
      [3.2, 13.9, -47],      // 5. plataforma elevada de la espiral
    ];
    for (const [x, y, z] of spots) {
      const note = new THREE.Group();
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), noteMat);
      head.scale.set(1, 0.75, 1);
      head.rotation.z = -0.4;
      note.add(head);
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.5, 0.045), noteMat);
      stem.position.set(0.13, 0.28, 0);
      note.add(stem);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.045), noteMat);
      flag.position.set(0.24, 0.49, 0);
      flag.rotation.z = -0.4;
      note.add(flag);
      note.position.set(x, y, z);
      this.group.add(note);
      this.notes.push({ group: note, collected: false, position: new THREE.Vector3(x, y, z) });
    }
  }

  // ------------------------------------------------------------------
  // Eventos del mundo
  // ------------------------------------------------------------------

  setArenaWave(wave: number): void {
    this.braziers.forEach((brazier, i) => {
      const mat = brazier.material as THREE.MeshStandardMaterial;
      if (i < wave) {
        mat.emissive.set(0xff8a30);
        mat.emissiveIntensity = 1.4;
      } else {
        mat.emissive.set(0x202020);
        mat.emissiveIntensity = 0.3;
      }
    });
  }

  setFaroCharge(charge: number): void {
    const t = Math.min(charge / 3, 1);
    this.faroCrystalMat.color.lerpColors(new THREE.Color(0x9fb8c8), new THREE.Color(0xffe9a0), t);
    this.faroCrystalMat.emissive.lerpColors(new THREE.Color(0x223344), new THREE.Color(0xffaa00), t);
    this.faroCrystalMat.emissiveIntensity = 0.3 + t * 0.9;
  }

  purifyIsland(): void {
    const mats = [0xf2917e, 0xffd34d, 0xe85a8a, 0x9fe8ff].map(
      (c) => new THREE.MeshStandardMaterial({ color: c }),
    );
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const r = 6 + (i % 4) * 4.5;
      const flower = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), mats[i % 4]);
      flower.position.set(Math.cos(a) * r, 1.12, 12 + Math.sin(a) * r * 0.6);
      this.group.add(flower);
    }
  }

  purifyWestZone(): void {
    const flowers: [number, number][] = [
      [-40, 1], [-33, -1], [-39, 8], [-31, 8], [-36, 2], [-42, 5], [-29, 4],
    ];
    const mats = [0xf2917e, 0xffd34d, 0xe85a8a].map(
      (c) => new THREE.MeshStandardMaterial({ color: c }),
    );
    flowers.forEach(([x, z], i) => {
      const flower = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), mats[i % 3]);
      flower.position.set(x, 1.27, z);
      this.group.add(flower);
    });
    for (const [x, z] of [[-40, 4], [-32, 1], [-37, 9]] as const) {
      const glimmer = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0x6fffe0, transparent: true, opacity: 0.6 }),
      );
      glimmer.position.set(x, 1.45, z);
      this.group.add(glimmer);
      this.glimmers.push({ mesh: glimmer, phase: Math.random() * Math.PI * 2 });
    }
  }

  digMound(): void {
    this.mound.visible = false;
    this.relic.visible = true;
    this.relicRise = 0;
  }

  get moundDug(): boolean {
    return !this.mound.visible;
  }

  activateFaro(): void {
    this.faroActivated = true;
    this.setFaroCharge(3);
    this.faroCrystalMat.emissiveIntensity = 1.6;
  }

  // ------------------------------------------------------------------
  // Decoración, vista y utilidades
  // ------------------------------------------------------------------

  private buildVista(): void {
    const cliffMat = new THREE.MeshStandardMaterial({ color: 0xd8c9a8, roughness: 0.95 });
    const topMat = new THREE.MeshStandardMaterial({ color: 0x58b368, roughness: 0.9 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xc96f4a, roughness: 0.8 });
    const cliffs: [number, number, number, number][] = [
      [70, -30, 15, 11], [76, -52, 19, 13], [66, -70, 13, 10],
      [-72, -35, 12, 11], [-78, -58, 17, 13],
      [20, -78, 16, 13], [-18, -76, 13, 11],
    ];
    for (const [x, z, h, w] of cliffs) {
      const cliff = new THREE.Mesh(new THREE.BoxGeometry(w, h, 11), cliffMat);
      cliff.position.set(x, h / 2 - 1, z);
      cliff.rotation.y = (Math.random() - 0.5) * 0.3;
      this.group.add(cliff);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, 0.8, 10.5), topMat);
      cap.position.set(x, h - 0.6, z);
      cap.rotation.y = cliff.rotation.y;
      this.group.add(cap);
    }
    for (const [x, z, baseY, r] of [[76, -52, 19, 1.3], [73, -54, 19, 0.9], [20, -78, 16, 1.2], [23, -76, 16, 0.8]] as const) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, 3.4, 7), this.matStone);
      tower.position.set(x, baseY + 1.4, z);
      this.group.add(tower);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(r * 1.15, 1.7, 7), roofMat);
      roof.position.set(x, baseY + 3.9, z);
      this.group.add(roof);
    }
    const sailMat = new THREE.MeshStandardMaterial({ color: 0xfdf6e0, side: THREE.DoubleSide });
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
    for (const [x, z, rot] of [[-58, 22, 0.6], [60, 16, -0.8], [0, -72, 2.4]] as const) {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.7), hullMat);
      hull.position.y = 0.15;
      boat.add(hull);
      const sail = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.7, 4), sailMat);
      sail.scale.z = 0.08;
      sail.position.y = 1.2;
      boat.add(sail);
      boat.position.set(x, 0.12, z);
      boat.rotation.y = rot;
      this.group.add(boat);
    }
  }

  private addHouse(x: number, yGround: number, z: number, wallColor: number, rotY = 0): void {
    const gltfHouse = this.assets?.getClone('house', 2.9);
    if (gltfHouse) {
      gltfHouse.position.set(x, yGround + gltfHouse.position.y, z);
      gltfHouse.rotation.y = rotY;
      this.group.add(gltfHouse);
      this.obstacles.push({ position: new THREE.Vector3(x, yGround, z), radius: 1.25 });
      return;
    }
    const house = new THREE.Group();
    const wall = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.85 });
    const body = new THREE.Mesh(new RoundedBoxGeometry(1.8, 1.5, 1.6, 2, 0.08), wall);
    body.position.y = 0.75;
    body.castShadow = true;
    house.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.9, 4),
      new THREE.MeshStandardMaterial({ color: 0xc96f4a, roughness: 0.8 }));
    roof.position.y = 1.95;
    roof.rotation.y = Math.PI / 4;
    house.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.8, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x7a4a2e }));
    door.position.set(0, 0.4, 0.83);
    house.add(door);
    house.position.set(x, yGround, z);
    house.rotation.y = rotY;
    this.group.add(house);
    this.obstacles.push({ position: new THREE.Vector3(x, yGround, z), radius: 1.25 });
  }

  private addRoad(x: number, z0: number, _unused: number, z1: number, yTop: number): void {
    const tileGeo = new THREE.BoxGeometry(1.3, 0.08, 1.0);
    for (let z = z0; z >= z1; z -= 1.25) {
      const tile = new THREE.Mesh(tileGeo, this.matStone);
      tile.position.set(x + (Math.random() - 0.5) * 0.15, yTop + 0.02, z);
      tile.rotation.y = (Math.random() - 0.5) * 0.2;
      tile.receiveShadow = true;
      this.group.add(tile);
    }
  }

  private addRoadX(x0: number, x1: number, z: number, yTop: number): void {
    const tileGeo = new THREE.BoxGeometry(1.0, 0.08, 1.3);
    const step = x1 > x0 ? 1.25 : -1.25;
    for (let x = x0; step > 0 ? x <= x1 : x >= x1; x += step) {
      const tile = new THREE.Mesh(tileGeo, this.matStone);
      tile.position.set(x, yTop + 0.02, z + (Math.random() - 0.5) * 0.15);
      tile.rotation.y = (Math.random() - 0.5) * 0.2;
      this.group.add(tile);
    }
  }

  private addColumn(x: number, yGround: number, z: number, height: number, broken: boolean): void {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, height, 9), this.matStone);
    col.position.set(x, yGround + height / 2, z);
    if (broken) col.rotation.z = 0.12;
    col.castShadow = true;
    this.group.add(col);
    if (!broken) {
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.16),
        new THREE.MeshStandardMaterial({ color: 0x6fd8ff, emissive: 0x2090c0, emissiveIntensity: 1 }));
      gem.position.set(x, yGround + height + 0.3, z);
      this.group.add(gem);
    }
    this.obstacles.push({ position: new THREE.Vector3(x, yGround, z), radius: 0.5 });
  }

  private addTree(x: number, yGround: number, z: number, scale = 1): void {
    // Modelo final si existe public/models/tree.glb (pipeline Paso 2)
    const gltfTree = this.assets?.getClone('tree', 3.2 * scale);
    if (gltfTree) {
      gltfTree.position.set(x, yGround + gltfTree.position.y, z);
      gltfTree.rotation.y = Math.random() * Math.PI * 2;
      this.group.add(gltfTree);
      this.obstacles.push({ position: new THREE.Vector3(x, yGround, z), radius: 0.45 * scale });
      return;
    }
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.26 * scale, 1.8 * scale, 7), this.matTrunk);
    trunk.position.y = 0.9 * scale;
    trunk.castShadow = true;
    tree.add(trunk);
    const blobGeo = new THREE.IcosahedronGeometry(0.75 * scale, 2);
    for (const [ox, oy, oz] of [[0, 2.1, 0], [0.5, 1.8, 0.3], [-0.5, 1.85, -0.2], [0.1, 1.75, -0.5]]) {
      const blob = new THREE.Mesh(blobGeo, this.matLeaf);
      blob.position.set(ox * scale, oy * scale, oz * scale);
      blob.castShadow = true;
      tree.add(blob);
    }
    tree.position.set(x, yGround, z);
    this.group.add(tree);
    this.obstacles.push({ position: new THREE.Vector3(x, yGround, z), radius: 0.45 * scale });
  }

  private addRock(x: number, yGround: number, z: number, scale = 1): void {
    const gltfRock = this.assets?.getClone('rock', 1.1 * scale);
    if (gltfRock) {
      gltfRock.position.set(x, yGround + gltfRock.position.y, z);
      gltfRock.rotation.y = Math.random() * Math.PI * 2;
      this.group.add(gltfRock);
      this.obstacles.push({ position: new THREE.Vector3(x, yGround, z), radius: 0.55 * scale });
      return;
    }
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55 * scale, 1), this.matRock);
    rock.position.set(x, yGround + 0.3 * scale, z);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    rock.castShadow = true;
    this.group.add(rock);
    this.obstacles.push({ position: new THREE.Vector3(x, yGround, z), radius: 0.55 * scale });
  }

  private buildDecorations(): void {
    // Hub / playa sur
    this.addTree(-14, 1, 14, 1.3);
    this.addTree(14, 1, 16, 1.0);
    this.addTree(-18, 1, 4, 1.1);
    this.addTree(-8, 1, 8, 0.9);
    this.addTree(20, 1, 12, 1.15);
    this.addTree(8, 1, 4, 0.85);
    this.addRock(-4, 1, 14, 1.1);
    this.addRock(18, 1, 6);
    // Arboleda (más densa: es su identidad)
    this.addTree(13, 1, 5, 1.2);
    this.addTree(19, 1, 9, 1.0);
    this.addTree(17, 1, 4, 0.8);
    // Camino oeste y arenal del coral
    this.addTree(-24, 1, 7, 0.95);
    this.addTree(-33, 1.15, 11, 0.9);
    this.addRock(-26, 1, 1);
    // Sendero este
    this.addTree(26, 1, 1, 1.0);
    this.addTree(36, 1, -10, 0.9);
    this.addRock(29, 1, -5, 0.9);
    // Meseta central
    this.addTree(-10, 4.55, -16, 1.25);
    this.addTree(10, 4.55, -14, 1.0);
    this.addTree(-16, 4.55, -28, 1.1);
    this.addTree(14, 4.55, -26, 0.9);
    this.addTree(-6, 4.55, -34, 1.0);
    this.addRock(6, 4.55, -30);
    this.addRock(-20, 4.55, -20, 1.2);
    // Tierras altas
    this.addTree(-9, 8, -38, 1.1);
    this.addTree(9, 8, -50, 0.95);
    this.addTree(-7, 8, -49, 0.85);
    this.addRock(8, 8, -38);
    // Flores
    const flowerMats = [0xf2917e, 0xffd34d, 0xe85a8a].map(
      (c) => new THREE.MeshStandardMaterial({ color: c }));
    const spots: [number, number, number][] = [
      [-5, 1, 20], [4, 1, 12], [-10, 1, 11], [9, 1, 8], [-3, 4.55, -12],
      [5, 4.55, -18], [-8, 4.55, -24], [3, 8, -34], [-4, 8, -42],
    ];
    spots.forEach(([x, y, z], i) => {
      const flower = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), flowerMats[i % 3]);
      flower.position.set(x, y + 0.1, z);
      this.group.add(flower);
    });
  }

  private addBanner(x: number, yGround: number, z: number, color: number): void {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), this.matTrunk);
    pole.position.set(x, yGround + 1.2, z);
    this.group.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.4),
      new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide }));
    flag.position.set(x + (x > 0 ? -0.36 : 0.36), yGround + 2.15, z);
    this.group.add(flag);
  }

  private buildQuiriesAt(spots: [number, number, number][]): void {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xffe28a, emissive: 0xc9962a, emissiveIntensity: 0.8,
    });
    for (const [x, y, z] of spots) {
      const quiri = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 7), bodyMat);
      quiri.add(body);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 5),
        new THREE.MeshStandardMaterial({ color: 0xc96f4a }));
      beak.position.set(0, 0, 0.12);
      beak.rotation.x = Math.PI / 2;
      quiri.add(beak);
      quiri.position.set(x, y, z);
      quiri.rotation.y = Math.random() * Math.PI * 2;
      this.group.add(quiri);
      this.quiries.push({ mesh: quiri, phase: Math.random() * Math.PI * 2 });
    }
  }

  private buildGlimmers(): void {
    const mat = new THREE.MeshBasicMaterial({ color: 0x6fffe0, transparent: true, opacity: 0.6 });
    for (const [x, z] of [[30, 18], [-30, 20], [-48, -2], [44, -14], [16, -58], [-16, -56]] as const) {
      const glimmer = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), mat.clone());
      glimmer.position.set(x, 0.25, z);
      this.group.add(glimmer);
      this.glimmers.push({ mesh: glimmer, phase: Math.random() * Math.PI * 2 });
    }
  }

  private buildCrates(): void {
    this.addCrate(-12, 1, 16);
    this.addCrate(-38, 1.15, -1);
    this.addCrate(34, 1, 3);
    this.addCrate(-12, 4.55, -22);
    this.addCrate(12, 4.55, -30);
    this.addCrate(-6, 8, -44);
  }

  private addCrate(x: number, yGround: number, z: number): void {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.09), this.matCrate);
    mesh.position.set(x, yGround + 0.5, z);
    mesh.castShadow = true;
    this.group.add(mesh);
    const obstacle: Obstacle = { position: new THREE.Vector3(x, yGround, z), radius: 0.7 };
    this.obstacles.push(obstacle);
    this.crates.push({ mesh, obstacle, broken: false });
  }

  private buildPads(): void {
    // Atajos del LDD: hub→meseta, meseta→tierras altas, coral, sendero→arboleda
    this.addPad(4, 1, -1, 16);
    this.addPad(4, 4.55, -24.5, 15);
    this.addPad(-31, 1.15, 10, 12);
    this.addPad(24, 1, 4, 12);
  }

  private addPad(x: number, yGround: number, z: number, power: number): void {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.0, 0.25, 12), this.matStone);
    base.position.set(x, yGround + 0.12, z);
    this.group.add(base);
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 0.18, 12),
      new THREE.MeshStandardMaterial({ color: 0x2ec4b6, emissive: 0x18887e, emissiveIntensity: 0.7 }),
    );
    top.position.set(x, yGround + 0.32, z);
    this.group.add(top);
    this.pads.push({ position: new THREE.Vector3(x, yGround + 0.35, z), power, mesh: top });
  }

  // ------------------------------------------------------------------
  // Lumas y enemigos (distribución del LDD §8 a la nueva escala)
  // ------------------------------------------------------------------

  private lumaLine(ax: number, ay: number, az: number, bx: number, by: number, bz: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      this.crystalPositions.push(new THREE.Vector3(
        ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t));
    }
  }

  private lumaRing(cx: number, y: number, cz: number, r: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.crystalPositions.push(new THREE.Vector3(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r * 0.85));
    }
  }

  private placeLumas(): void {
    const add = (x: number, y: number, z: number) => this.crystalPositions.push(new THREE.Vector3(x, y, z));
    // RUTA PRINCIPAL (la más densa): spawn → meseta → tierras altas → faro
    this.lumaLine(0, 2, 22, 0, 2, 3, 9);
    add(0, 3.2, 0.2); add(0, 4.4, -2.2);
    this.lumaLine(0, 5.5, -6, 0, 5.5, -20, 7);
    add(0, 6.8, -23.5); add(0, 8.1, -25.8);
    this.lumaLine(0, 9, -28, 0, 9, -36, 5);
    // FARO: espiral + cima + base
    add(0, 10.4, -39.5); add(3.2, 11.7, -41); add(4.5, 13, -44); add(3.2, 14.3, -47);
    add(0, 15.6, -48.5); add(-3.2, 16.9, -47); add(-4.5, 18.2, -44); add(-3.2, 19.4, -41);
    this.lumaRing(0, 21.2, -44, 1.7, 6);
    this.lumaRing(0, 9.2, -44, 6.5, 10);
    // HUB: anillo + aldea
    this.lumaRing(0, 2, 12, 12, 12);
    this.lumaLine(-7, 2, 18, 12, 2, 12, 5);
    // RAMALES oeste y este
    this.lumaLine(-5, 2, 6, -26, 2, 6, 8);
    this.lumaLine(5, 2, 2, 28, 2, 2, 8);
    // CORAL DORMIDO
    this.lumaRing(-36, 2, 4, 8, 12);
    this.lumaLine(-42, 2, -2, -30, 2, 10, 6);
    // SENDERO DE ORYN
    this.lumaRing(32, 2, -2, 7, 10);
    this.lumaLine(28, 2, 4, 38, 2, -8, 6);
    // ARBOLEDA Y ARENA
    this.lumaRing(16, 2.2, 8, 3.5, 6);
    this.lumaRing(20, 5.7, -34, 4.6, 8);
    // MESETA: anillos laterales
    this.lumaRing(-14, 5.6, -22, 6, 8);
    this.lumaRing(14, 5.6, -22, 6, 8);
    // CUEVA AZUL y su antesala
    this.lumaLine(83, 8.2, -21, 89, 8.2, -14, 6);
    this.lumaRing(96.5, 8.4, -18, 2, 6);
    add(-27, 3, -10); add(-27, 3, -18); add(-25, 5.6, -14);
    // SECRETOS: orillas, vadeos y rincones
    this.lumaRing(0, 0.8, -8, 47, 14);
    add(-46, 1.4, 12); add(46, 1.4, -16); add(0, 1.2, -56); add(24, 1.3, 22); add(-24, 1.3, 22);
    add(-24, 5.6, -10); add(-24, 5.6, -18);
  }

  private placeEnemies(): void {
    const def = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) =>
      this.enemyDefs.push({ pointA: new THREE.Vector3(ax, ay, az), pointB: new THREE.Vector3(bx, by, bz) });
    // Hub (introducción suave)
    def(-4, 1, 6, 4, 1, 6);
    // Camino oeste + arenal del coral
    def(-18, 1, 5, -24, 1, 7);
    def(-34, 1.15, 0, -38, 1.15, 8);
    def(-40, 1.15, 2, -32, 1.15, -2);
    // Sendero de Oryn
    def(26, 1, 0, 34, 1, -4);
    def(36, 1, -8, 30, 1, -8);
    // Meseta central
    def(-6, 4.55, -14, 6, 4.55, -14);
    def(-12, 4.55, -26, -4, 4.55, -30);
    def(10, 4.55, -28, 16, 4.55, -22);
    // Tierras altas (guardia del faro)
    def(-6, 8, -36, 6, 8, -36);
    def(5, 8, -48, -5, 8, -48);
  }

  breakCratesNear(center: THREE.Vector3, radius: number): THREE.Vector3[] {
    const broken: THREE.Vector3[] = [];
    for (const crate of this.crates) {
      if (crate.broken) continue;
      if (crate.mesh.position.distanceTo(center) <= radius + 0.5) {
        crate.broken = true;
        crate.mesh.visible = false;
        const idx = this.obstacles.indexOf(crate.obstacle);
        if (idx >= 0) this.obstacles.splice(idx, 1);
        broken.push(crate.mesh.position.clone());
      }
    }
    return broken;
  }

  /** Animaciones ambientales. */
  update(dt: number): void {
    this.time += dt;
    this.water2.update(dt);
    for (const q of this.quiries) {
      q.mesh.scale.setScalar(1 + Math.sin(this.time * 5 + q.phase) * 0.12);
    }
    for (const g of this.glimmers) {
      (g.mesh.material as THREE.MeshBasicMaterial).opacity = 0.35 + (Math.sin(this.time * 1.6 + g.phase) + 1) * 0.2;
    }
    for (const note of this.notes) {
      if (note.collected) continue;
      note.group.position.y = note.position.y + Math.sin(this.time * 2.4 + note.position.x) * 0.12;
      note.group.rotation.y += dt * 1.8;
    }
    for (const pad of this.pads) {
      pad.mesh.position.y = pad.position.y - 0.03 + Math.sin(this.time * 3) * 0.04;
    }
    if (this.relicRise >= 0 && this.relicRise < 1) {
      this.relicRise += dt * 1.2;
      const t = Math.min(this.relicRise, 1);
      this.relic.position.y = this.moundPos.y - 0.8 + t * 1.0;
      this.relic.rotation.y += dt * 3;
    }
    if (this.faroActivated) {
      this.faroCrystal.rotation.y += dt * 2;
      const beamMat = this.faroBeam.material as THREE.MeshBasicMaterial;
      beamMat.opacity = Math.min(beamMat.opacity + dt * 0.3, 0.45) + Math.sin(this.time * 3) * 0.05;
    } else {
      this.faroCrystal.rotation.y += dt * 0.3;
    }
  }
}
