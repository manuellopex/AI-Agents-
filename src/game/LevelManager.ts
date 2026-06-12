import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { applyCloudShadows } from './CloudShadows';
import type { AssetLibrary } from './AssetLibrary';
import type { CorruptRock } from './CaracoralBrute';
import { WaterSurface, IslandShore } from './WaterSurface';

/** Obstáculo cilíndrico simple para colisión lateral. */
export interface Obstacle {
  position: THREE.Vector3;
  radius: number;
}

export interface EnemyDef {
  pointA: THREE.Vector3;
  pointB: THREE.Vector3;
}

export interface Crate {
  mesh: THREE.Object3D;
  obstacle: Obstacle;
  broken: boolean;
}

export interface BouncePad {
  position: THREE.Vector3;
  power: number;
  mesh: THREE.Mesh;
}

export interface Trigger {
  id: string;
  position: THREE.Vector3;
  radius: number;
}

/** Corriente de viento ascendente (Ruta Vertical). */
export interface Updraft {
  x: number;
  z: number;
  r: number;
  topY: number;
  lift: number;
}

/**
 * LevelManager — COSTA BRILLANTE a escala de aventura 3D clásica
 * =================================================================
 * 1 unidad = 1 metro. Métricas del documento de escala:
 *
 *   ISLA: 420 m (N-S) × 310 m (E-O) · mar y=0 · cumbre visual ≈ 112 m
 *
 *   BANDAS DE ALTURA
 *     y 0-4    Playa / Hub inicial (sur)
 *     y 6-15   Acantilados bajos / Lower Terrace District (y12)
 *     y 18-38  Ciudad media / Mid Terrace District (y28)
 *     y 45-70  Distrito alto sagrado (y58) y base del faro (y70)
 *     y 70-108 Faro del Alba (torre 38 m) · cristal ≈ 112 m
 *
 *   ÁREAS (dimensiones de la spec)
 *     1 Hub Playa Central 70×55 (y2)      5 Faro del Alba (base 42×36, torre ⌀12×38)
 *     2 Playa del Coral 85×50 (y2)        6 Arboleda Quiríes 75×60 (meseta y18)
 *     3 Cueva Azul int. 55×38 (y8-14)     7 Sendero de Oryn ~105 m (y12→28)
 *     4 Ruta Vertical 140-170 m (28→70)   8 Santuario del Desafío 42×34 (y28)
 *
 *   CONEXIONES: rampas principales 5-6 m de ancho, escaleras instanciadas
 *   (huella 0.30 m, contrahuella 0.20 m), 2 corrientes de viento, pads de
 *   atajo y retorno al hub (salida de la Cueva Azul = atajo al hub).
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
  readonly updrafts: Updraft[] = [];
  /** Muros reales (cajas orientadas): edificios, murallas, cueva. */
  readonly boxColliders: { cx: number; cz: number; hx: number; hz: number; rotY: number; y0: number; y1: number }[] = [];
  /** Acantilados de las mesas (paredes elípticas verticales). */
  readonly ellipseColliders: { cx: number; cz: number; rx: number; rz: number; y1: number }[] = [];
  readonly killY = -0.45;

  // --- Área 5: Faro del Alba ---
  readonly faroPedestalPos = new THREE.Vector3(0, 70.1, -154);
  readonly faroDestelloPos = new THREE.Vector3(0, 110.5, -170);
  private faroCrystal!: THREE.Mesh;
  private faroBeam!: THREE.Mesh;
  private faroCrystalMat!: THREE.MeshStandardMaterial;
  private faroActivated = false;

  // --- Área 2: Playa del Coral Dormido (85×50 en y2) ---
  readonly corruptRocks: CorruptRock[] = [];
  readonly westCenter = new THREE.Vector3(-85, 2, 80);
  readonly westBounds = { minX: -126, maxX: -45, minZ: 56, maxZ: 104 };
  readonly coralDestelloPos = new THREE.Vector3(-85, 4, 80);

  // --- Área 7: Sendero de Oryn ---
  readonly orynZoneCenter = new THREE.Vector3(58, 12, -18);
  readonly orynZoneRadius = 22;
  readonly moundPos = new THREE.Vector3(66, 12, -22);
  readonly orynDestelloPos = new THREE.Vector3(66, 13.6, -22);
  private mound!: THREE.Mesh;
  private relic!: THREE.Group;
  private relicRise = -1;

  // --- Área 3: Cueva Azul (interior 55×38, alto 8-14) ---
  readonly caveInsidePos = new THREE.Vector3(402, 9.3, 10);
  /** La salida es un ATAJO: te deja en la plaza del hub. */
  readonly caveOutsidePos = new THREE.Vector3(0, 2.3, 140);
  readonly caveExitPos = new THREE.Vector3(398, 9.2, -10);
  readonly cavePlates: { mesh: THREE.Mesh; pressed: boolean; pos: THREE.Vector3 }[] = [];
  readonly caveChestPos = new THREE.Vector3(432, 9.6, 6);
  readonly caveDestelloPos = new THREE.Vector3(432, 11, 6);
  private caveBridge!: THREE.Mesh;
  private caveChestLid!: THREE.Mesh;
  caveBridgeOpen = false;
  caveChestOpened = false;

  // --- Área 6: Arboleda de los Quiríes (meseta propia y18) ---
  readonly notes: { group: THREE.Group; collected: boolean; position: THREE.Vector3 }[] = [];
  readonly quiriAltarPos = new THREE.Vector3(95, 18, 35);
  readonly quiriDestelloPos = new THREE.Vector3(95, 21, 35);

  // --- Área 8: Santuario del Desafío (42×34 en y28, reto cronometrado) ---
  readonly arenaCenter = new THREE.Vector3(-55, 28, -95);
  readonly arenaDestelloPos = new THREE.Vector3(-55, 42.5, -112);
  /** Pedestal flotante al final del reto de plataformas temporales. */
  readonly challengePedestalPos = new THREE.Vector3(-55, 41, -112);
  private challengeGroup!: THREE.Group;
  private braziers: THREE.Mesh[] = [];

  private time = 0;
  private water2!: WaterSurface;
  private shores: IslandShore[] = [];
  private quiries: { mesh: THREE.Group; phase: number }[] = [];
  private glimmers: { mesh: THREE.Mesh; phase: number }[] = [];
  private assets: AssetLibrary | null;
  private stairSteps: THREE.Matrix4[] = [];

  // Materiales compartidos
  private matRock = new THREE.MeshStandardMaterial({ color: 0xb3ab98, roughness: 0.9 });
  private matTrunk = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 });
  private matLeaf = new THREE.MeshStandardMaterial({ color: 0x2fa05e, roughness: 0.85 });
  private matCrate = new THREE.MeshStandardMaterial({ color: 0xc96f4a, roughness: 0.8 });
  private matStone = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.85 });
  private matStoneDark = new THREE.MeshStandardMaterial({ color: 0xcfc2a8, roughness: 0.9 });
  private matWood = new THREE.MeshStandardMaterial({ color: 0xb07a5a, roughness: 0.85 });
  private matNoxia = new THREE.MeshStandardMaterial({
    color: 0x5a3a78, emissive: 0x3a1060, emissiveIntensity: 0.6,
  });
  private matGoldGlow = new THREE.MeshStandardMaterial({
    color: 0xffd34d, emissive: 0xffaa00, emissiveIntensity: 0.8,
  });
  private matAuralis = new THREE.MeshStandardMaterial({
    color: 0x6fd8ff, emissive: 0x2090c0, emissiveIntensity: 1.1, roughness: 0.3,
  });
  private matCliff = new THREE.MeshStandardMaterial({ color: 0xcdb98e, roughness: 0.95 });
  private mesaTopMat = (() => {
    const mat = new THREE.MeshStandardMaterial({ color: 0x55b066, roughness: 0.92 });
    applyCloudShadows(mat, true);
    return mat;
  })();
  private terrainMat = (() => {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
    applyCloudShadows(mat, true);
    return mat;
  })();

  constructor(scene: THREE.Scene, assets: AssetLibrary | null = null) {
    this.assets = assets;
    // FASE 1-2: terreno por bandas + footprints de áreas
    this.buildTerrain();
    this.buildWater();
    // FASE 3: rutas (rampas, escaleras, pads, viento)
    this.buildMainRoutes();
    // ÁREAS
    this.buildHub();              // 1
    this.buildCoralBeach();       // 2
    this.buildCaveEntrance();     // 3 (entrada)
    this.buildCaveInterior();     // 3 (interior)
    this.buildVerticalRoute();    // 4
    this.buildFaro();             // 5
    this.buildGrove();            // 6
    this.buildSendero();          // 7
    this.buildChallenge();        // 8
    // FASE 4: ciudad por distritos
    this.buildLowerDistrict();
    this.buildMidDistrict();
    this.buildUpperDistrict();
    // Art pass básico (ya validado): vegetación, props, vida
    this.buildNotes();
    this.buildDecorations();
    this.buildCrates();
    this.buildGlimmers();
    this.placeLumas();
    this.flushStairs();
    this.snapLumasToGround();
    this.placeEnemies();
    this.placeCheckpointFlags();
    scene.add(this.group);
  }

  // ==================================================================
  // TERRENO — bandas de elevación (FASE 1)
  // ==================================================================

  private addPlatform(x: number, yTop: number, z: number, w: number, h: number, d: number,
    mat: THREE.Material = this.matRock): THREE.Mesh {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(0.12, h * 0.25)), mat);
    mesh.position.set(x, yTop - h / 2, z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this.group.add(mesh);
    this.groundMeshes.push(mesh);
    return mesh;
  }

  /** Rampa caminable (las pendientes de las mesetas son demasiado bruscas). */
  private addRamp(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
    width: number, mat: THREE.Material = this.matStone): void {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const slopeLen = Math.hypot(len, dy);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(width, 0.5, slopeLen + 1), mat);
    ramp.position.set((x0 + x1) / 2, (y0 + y1) / 2 + 0.05, (z0 + z1) / 2);
    ramp.rotation.y = Math.atan2(dx, dz);
    ramp.rotation.x = -Math.atan2(dy, len);
    ramp.receiveShadow = true;
    ramp.castShadow = true;
    this.group.add(ramp);
    this.groundMeshes.push(ramp);
  }

  /** Escalera real (huella 0.30 / contrahuella 0.20) — instanciada. */
  private addStairs(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, width: number): void {
    const rise = y1 - y0;
    const steps = Math.max(2, Math.round(rise / 0.2));
    // Cada peldaño cubre su tramo completo del recorrido: sin huecos entre
    // escalones aunque la pendiente sea tendida (si no, no se puede subir).
    const run = Math.hypot(x1 - x0, z1 - z0);
    const depth = Math.max(0.3, (run / steps) * 1.06);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(x1 - x0, z1 - z0));
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      m.compose(
        new THREE.Vector3(x0 + (x1 - x0) * t, y0 + rise * (i + 1) / steps - 0.1, z0 + (z1 - z0) * t),
        q,
        new THREE.Vector3(width, 0.22, depth),
      );
      this.stairSteps.push(m.clone());
    }
  }

  private flushStairs(): void {
    if (this.stairSteps.length === 0) return;
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.matStoneDark, this.stairSteps.length);
    this.stairSteps.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.frustumCulled = false;
    this.group.add(inst);
    this.groundMeshes.push(inst as unknown as THREE.Mesh);
  }

  /** Meseta esculpida con costa irregular y colores por vértice. */
  private addIsland(cx: number, cz: number, rx: number, rz: number, topY: number,
    topColor: number, seed: number, registerShore = false): void {
    const SEG = 56;
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
      const rMod = 1 + 0.07 * Math.sin(3 * ang + seed) + 0.05 * Math.sin(7 * ang + seed * 2.3);
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

  /**
   * Mesa de pared VERTICAL (estilo plataformero clásico): cima plana
   * caminable + acantilado infranqueable con colisionador elíptico.
   * Solo se sube por rampas, escaleras, pads o corrientes de viento.
   */
  private addMesa(cx: number, cz: number, rx: number, rz: number, topY: number): void {
    const h = topY + 2; // baja hasta y −2 (bajo el mar)
    const geo = new THREE.CylinderGeometry(1, 1.04, 1, 48, 1, false);
    const mesh = new THREE.Mesh(geo, [this.matCliff, this.mesaTopMat, this.matCliff]);
    mesh.scale.set(rx, h, rz);
    mesh.position.set(cx, topY - h / 2, cz);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this.group.add(mesh);
    this.groundMeshes.push(mesh);
    // Pared sólida hasta 5 m bajo el borde (las rampas coronan por encima)
    this.ellipseColliders.push({ cx, cz, rx: rx + 0.2, rz: rz + 0.2, y1: topY - 5 });
  }

  /** Isla base esculpida (playas) + 4 mesas + meseta de la Arboleda. */
  private buildTerrain(): void {
    this.addIsland(0, 0, 155, 205, 2, 0x58b368, 3.1, true);  // playa (0-4)
    this.addMesa(0, -55, 120, 135, 12);                      // acantilados bajos y12
    this.addMesa(0, -98, 70, 70, 28);                        // ciudad media y28
    this.addMesa(0, -140, 50, 42, 58);                       // distrito alto y58
    this.addMesa(0, -168, 26, 18, 70);                       // base del faro y70
    this.addMesa(95, 35, 44, 36, 18);                        // meseta de la Arboleda y18
  }

  private buildWater(): void {
    this.water2 = new WaterSurface(this.group as unknown as THREE.Scene, this.shores, new THREE.Vector3(60, 120, 40));
  }

  // ==================================================================
  // FASE 3 — RUTAS PRINCIPALES, RAMPAS, PADS Y ATAJOS
  // ==================================================================
  private buildMainRoutes(): void {
    // R1: playa → mesa baja (corona el borde sur de la mesa y12)
    this.addRamp(0, 2, 96, 0, 12.3, 72, 6);
    // R2: mesa baja → ciudad media (corona el borde sur de la mesa y28)
    this.addRamp(0, 12.2, 2, 0, 28.3, -36, 6);
    // R4: distrito alto → base del faro (zigzag ceremonial)
    this.addRamp(-6, 58.2, -136, -6, 64, -144, 5);
    this.addPlatform(-2, 64, -147, 9, 1, 7, this.matStone);
    this.addRamp(2, 64, -146, 2, 70.4, -156, 5);
    // Acceso a la Arboleda desde la playa (corona el borde oeste)
    this.addRamp(22, 2, 40, 54, 18.3, 40, 5);
    // Sendero de Oryn → ciudad media (corona el borde este)
    this.addRamp(54, 12.2, -38, 40, 28.3, -66, 5);

    // ATAJOS con bounce pads (potencias para g=28)
    this.addPad(16, 2, 86, 26);    // playa → mesa baja directo
    this.addPad(24, 12, -20, 31);  // mesa baja → ciudad media
    this.addPad(-70, 2, 60, 26);   // playa del Coral → mesa baja oeste
    this.addPad(80, 18, 10, 14);   // arboleda: brinco panorámico

    // Caminos de piedra marcando la ruta principal
    this.addRoad(0, 130, 0, 86, 2.05);
    this.addRoad(0, 60, 0, 6, 12.05);
    this.addRoad(0, -42, 0, -82, 28.05);
    this.addRoad(0, -104, 0, -132, 58.05);
    this.addRoadX(-6, -68, 70, 2.05);   // hub → playa del Coral
    this.addRoadX(8, 20, 40, 2.05);     // hub → rampa de la Arboleda
  }

  // ==================================================================
  // ÁREA 1 — HUB PLAYA CENTRAL (70×55, y 0-4)
  // ==================================================================
  private buildHub(): void {
    this.checkpoints.push(new THREE.Vector3(0, 2, 160)); // spawn

    // Plaza Costera obligatoria (18×16) con santuario inicial
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(10, 10.5, 0.5, 24), this.matStone);
    plaza.position.set(0, 2.05, 145);
    plaza.receiveShadow = true;
    this.group.add(plaza);
    this.groundMeshes.push(plaza);

    // Santuario inicial (curación con Lumas)
    const heartBase = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 1.2, 8), this.matStone);
    heartBase.position.set(7, 2.6, 140);
    this.group.add(heartBase);
    const heart = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 9),
      new THREE.MeshStandardMaterial({ color: 0xff6b8a, emissive: 0xa01030, emissiveIntensity: 0.6 }));
    heart.position.set(7, 3.9, 140);
    this.group.add(heart);
    this.triggers.push({ id: 'corazones', position: new THREE.Vector3(7, 2, 140), radius: 3.2 });
    this.obstacles.push({ position: new THREE.Vector3(7, 2, 140), radius: 1.9 });

    // Estandartes señalando las 3 rutas visibles desde el spawn
    this.addBanner(-3.5, 2, 120, 0x2ec4b6);
    this.addBanner(3.5, 2, 120, 0xffd34d);
    this.addBanner(-40, 2, 74, 0x2ec4b6);   // oeste: Coral
    this.addBanner(30, 2, 48, 0xffd34d);    // este: Arboleda
  }

  // ==================================================================
  // ÁREA 2 — PLAYA DEL CORAL DORMIDO (85×50, y 0-6)
  // ==================================================================
  private buildCoralBeach(): void {
    this.checkpoints.push(new THREE.Vector3(-52, 2, 78));
    for (const [x, z] of [[-112, 70], [-66, 64], [-100, 98]] as const) {
      const rockGroup = new THREE.Group();
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(2.4, 1), this.matNoxia);
      rock.position.y = 2;
      rock.rotation.set(Math.random(), Math.random(), 0);
      rock.castShadow = true;
      rockGroup.add(rock);
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), this.matNoxia);
      shard.position.set(1.1, 3.8, 0.4);
      rockGroup.add(shard);
      rockGroup.position.set(x, 2, z);
      this.group.add(rockGroup);
      this.corruptRocks.push({ mesh: rockGroup, position: new THREE.Vector3(x, 2, z), broken: false });
    }
    // Cristales de Noxia ambientando la corrupción
    for (const [x, z, s] of [[-120, 86, 1.4], [-58, 90, 1.1], [-92, 58, 1.7]] as const) {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(s), this.matNoxia);
      crystal.position.set(x, 2 + s * 0.7, z);
      crystal.rotation.set(0.4, Math.random() * 3, 0.2);
      this.group.add(crystal);
      this.obstacles.push({ position: new THREE.Vector3(x, 2, z), radius: s * 0.8 });
    }
  }

  // ==================================================================
  // ÁREA 3 — CUEVA AZUL (interior 55×38, alto 8-14)
  // ==================================================================
  private buildCaveEntrance(): void {
    // Hero waterfall (26 m) cayendo del borde oeste de la ciudad media
    // Cae de la cima de la ciudad media (y28) a la mesa baja (y12): 16 m
    const fall = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 17),
      new THREE.MeshBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.65, side: THREE.DoubleSide }),
    );
    fall.position.set(-58.5, 20.5, -60);
    fall.rotation.y = Math.PI / 2;
    this.group.add(fall);
    const foam = new THREE.Mesh(new THREE.CircleGeometry(5, 18),
      new THREE.MeshBasicMaterial({ color: 0xeafcff, transparent: true, opacity: 0.55 }));
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(-61, 12.25, -60);
    this.group.add(foam);
    // Puerta oculta tras la cascada
    const door = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.4, 14),
      new THREE.MeshStandardMaterial({ color: 0x2a3a52, emissive: 0x102040, emissiveIntensity: 0.5 }));
    door.rotation.z = Math.PI / 2;
    door.position.set(-57.2, 14, -60);
    this.group.add(door);
    this.triggers.push({ id: 'cueva', position: new THREE.Vector3(-59, 12.5, -60), radius: 5 });
  }

  private buildCaveInterior(): void {
    const darkStone = new THREE.MeshStandardMaterial({ color: 0x3a4a5c, roughness: 0.9 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2c3a48, roughness: 1 });
    // Sala principal 30×30 + ala de recompensa 18×16, foso entre ambas
    this.addPlatform(404, 8, 0, 30, 2, 30, darkStone);
    this.addPlatform(432, 8, 6, 18, 2, 16, darkStone);
    // Agua somera brillante en el foso
    const pool = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 26),
      new THREE.MeshStandardMaterial({ color: 0x2a6a88, emissive: 0x103a50, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 }));
    pool.position.set(421.5, 5.5, 2);
    this.group.add(pool);
    this.groundMeshes.push(pool);
    // Muros y techo (interior 8-14 m)
    for (const [x, z, w, d] of [[412, -17, 50, 2], [412, 17, 50, 2], [387, 0, 2, 36], [442, 6, 2, 20]] as const) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 13, d), wallMat);
      wall.position.set(x, 13.5, z);
      this.group.add(wall);
      this.boxColliders.push({ cx: x, cz: z, hx: w / 2, hz: d / 2, rotY: 0, y0: 6, y1: 20 });
    }
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(58, 1, 38), wallMat);
    ceiling.position.set(414, 20.5, 0);
    this.group.add(ceiling);
    // Hero crystals interiores (4-7 m)
    for (const [x, y, z, s] of [[396, 9, -12, 2.6], [410, 9, 12, 1.8], [428, 9, -2, 3.2], [394, 9, 8, 1.4]] as const) {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(s), this.matAuralis);
      crystal.position.set(x, y + s * 0.6, z);
      crystal.rotation.set(0.3, Math.random() * 3, 0.2);
      this.group.add(crystal);
      this.obstacles.push({ position: new THREE.Vector3(x, y, z), radius: s * 0.7 });
    }
    const light1 = new THREE.PointLight(0x4db8e8, 2.2, 40);
    light1.position.set(406, 16, 0);
    this.group.add(light1);
    const light2 = new THREE.PointLight(0x4db8e8, 1.6, 26);
    light2.position.set(432, 15, 6);
    this.group.add(light2);

    // Puzzle: 2 placas de presión → puente cristalino sobre el foso
    for (const [x, z] of [[398, -10], [398, 12]] as const) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.25, 14),
        new THREE.MeshStandardMaterial({ color: 0x7a92a8, emissive: 0x101820, emissiveIntensity: 0.5 }));
      plate.position.set(x, 9.1, z);
      this.group.add(plate);
      this.cavePlates.push({ mesh: plate, pressed: false, pos: new THREE.Vector3(x, 9, z) });
    }
    this.caveBridge = new THREE.Mesh(new THREE.BoxGeometry(9, 0.5, 5),
      new THREE.MeshStandardMaterial({
        color: 0x9fe8ff, emissive: 0x3aa8d8, emissiveIntensity: 0.8, transparent: true, opacity: 0.85,
      }));
    this.caveBridge.position.set(421.5, 8.7, 6);
    this.caveBridge.visible = false;
    this.group.add(this.caveBridge);
    // Plataformas de cristal alternativas (salto exigente sobre el foso)
    this.addPlatform(419, 8.6, -8, 3, 0.6, 3, this.matAuralis);
    this.addPlatform(425, 9.6, -12, 3, 0.6, 3, this.matAuralis);

    // Cofre en la sala de recompensa
    const chest = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x8a6238, roughness: 0.7 }));
    chest.position.set(432, 9.9, 6);
    this.group.add(chest);
    this.caveChestLid = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xc89638, metalness: 0.5, roughness: 0.4 }));
    this.caveChestLid.position.set(432, 10.85, 6);
    this.group.add(this.caveChestLid);

    // Portal de salida = ATAJO al hub
    const exitPortal = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.35, 16), this.matAuralis);
    exitPortal.rotation.z = Math.PI / 2;
    exitPortal.position.set(389, 10.5, -10);
    this.group.add(exitPortal);

    this.checkpoints.push(this.caveInsidePos.clone());
  }

  // ==================================================================
  // ÁREA 4 — RUTA VERTICAL DEL FARO (28 → 70 m, recorrido ≈ 150 m)
  // ==================================================================
  private buildVerticalRoute(): void {
    // Arranque: escalera corta desde la plaza norte de la ciudad media
    this.addStairs(0, 28, -84, 0, 31, -90, 4.5);
    this.addPlatform(0, 31, -92, 5, 1, 5);
    // Tramo 1: plataformas amplias 5×5 con saltos de 3-4.5 m
    // (todas FUERA del muro de la mesa alta, que pasa por z ≈ −98)
    this.addPlatform(9, 34, -94, 5, 1, 5);
    this.addPlatform(16, 37, -90, 5, 1, 5);
    // Terraza de descanso 1 + CHECKPOINT intermedio
    this.addPlatform(8, 40, -84, 9, 1.2, 9, this.matStone);
    this.checkpoints.push(new THREE.Vector3(8, 41, -84));
    // Tramo 2: ledges (mantle 1.2 m)
    this.addPlatform(-1, 41.2, -88, 4, 1, 4);
    this.addPlatform(-9, 44, -92, 4.5, 1, 4.5);
    // Terraza de descanso 2 con bounce pad
    this.addPlatform(-16, 47, -86, 8, 1.2, 8, this.matStone);
    this.addPad(-16, 47.6, -86, 18);
    // Tramo 3: corrientes de viento que coronan el distrito alto
    this.addPlatform(-8, 50, -94, 4, 1, 4); // base de la corriente 1
    this.updrafts.push({ x: -8, z: -94, r: 3.2, topY: 59.5, lift: 26 });
    const windPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(2.8, 3.4, 16, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xcdf6ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide }),
    );
    windPillar.position.set(-8, 53, -94);
    this.group.add(windPillar);
    this.updrafts.push({ x: 8, z: -96, r: 2.8, topY: 59.5, lift: 24 });
    const windPillar2 = windPillar.clone();
    windPillar2.position.set(8, 53, -96);
    windPillar2.scale.set(0.9, 1, 0.9);
    this.group.add(windPillar2);
    this.addPlatform(8, 44, -96, 4, 1, 4); // base de la corriente 2
  }

  // ==================================================================
  // ÁREA 5 — FARO DEL ALBA (torre ⌀12 × 38 m sobre base y70)
  // ==================================================================
  private buildFaro(): void {
    this.checkpoints.push(new THREE.Vector3(0, 70, -150));
    this.checkpoints.push(new THREE.Vector3(0, 58, -125)); // distrito alto

    // Atrio del Faro (16×14) con el pedestal de activación
    const atrium = new THREE.Mesh(new THREE.BoxGeometry(16, 0.6, 14), this.matStone);
    atrium.position.set(0, 70.0, -152);
    atrium.receiveShadow = true;
    this.group.add(atrium);
    this.groundMeshes.push(atrium);
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 0.9, 8), this.matStone);
    pedestal.position.set(0, 70.7, -154);
    this.group.add(pedestal);
    this.groundMeshes.push(pedestal);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const socket = new THREE.Mesh(new THREE.OctahedronGeometry(0.28),
        new THREE.MeshStandardMaterial({ color: 0x6a6052 }));
      socket.position.set(Math.cos(a) * 0.9, 71.35, -154 + Math.sin(a) * 0.9);
      this.group.add(socket);
    }

    // LA TORRE: 38 m, diámetro 12 — el landmark que se ve desde todo el mapa
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 6, 38, 28), this.matStone);
    tower.position.set(0, 89, -170);
    tower.castShadow = true;
    this.group.add(tower);
    this.obstacles.push({ position: new THREE.Vector3(0, 70, -170), radius: 6.4 });
    for (const y of [80, 89, 98]) {
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(5.4 - (y - 80) * 0.04, 5.5 - (y - 80) * 0.04, 2, 24),
        new THREE.MeshStandardMaterial({ color: 0x2aa6a0 }));
      stripe.position.set(0, y, -170);
      this.group.add(stripe);
    }
    // Galería superior pisable
    const top = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 1, 22), this.matStone);
    top.position.set(0, 107.5, -170);
    this.group.add(top);
    this.groundMeshes.push(top);
    // Cristal del faro (≈ 112 m: el punto más alto de la isla)
    this.faroCrystalMat = new THREE.MeshStandardMaterial({ color: 0x9fb8c8, emissive: 0x223344, emissiveIntensity: 0.3 });
    this.faroCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(2.2), this.faroCrystalMat);
    this.faroCrystal.position.set(0, 110.5, -170);
    this.group.add(this.faroCrystal);
    this.faroBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 3.4, 70, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0, side: THREE.DoubleSide }),
    );
    this.faroBeam.position.set(0, 145, -170);
    this.group.add(this.faroBeam);

    // Subida final a la galería: escalera helicoidal de plataformas (4×4, saltos 3-4 m)
    const spiral: [number, number, number][] = [
      [9, 73, -163], [13, 76.5, -170], [9, 80, -177], [0, 83.5, -180],
      [-9, 87, -177], [-13, 90.5, -170], [-9, 94, -163], [0, 97.5, -160],
      [8, 101, -163], [11, 104.5, -170],
    ];
    for (const [x, y, z] of spiral) {
      this.addPlatform(x, y, z, 4, 0.8, 4);
    }
  }

  // ==================================================================
  // ÁREA 6 — ARBOLEDA DE LOS QUIRÍES (75×60, meseta y18)
  // ==================================================================
  private buildGrove(): void {
    this.checkpoints.push(new THREE.Vector3(80, 18, 38));
    // Claro de los Quiríes (14×18) con altar
    const clearing = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.5, 0.4, 22), this.matStoneDark);
    clearing.position.set(95, 18.05, 35);
    clearing.receiveShadow = true;
    this.group.add(clearing);
    this.groundMeshes.push(clearing);
    const altar = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.7, 1.6, 8), this.matStone);
    altar.position.set(95, 18.9, 35);
    this.group.add(altar);
    this.obstacles.push({ position: this.quiriAltarPos.clone(), radius: 1.8 });
    this.buildQuiriesAt([[94, 20.4, 35.6], [96, 20.3, 35], [95, 20.7, 34.2]]);
    this.triggers.push({ id: 'quiries', position: this.quiriAltarPos.clone(), radius: 5 });

    // Árboles grandes fantasy (10-16 m) rodeando el claro — hogar, no decorado
    const giants: [number, number, number][] = [
      [78, 35, 15], [112, 30, 14], [86, 52, 16], [108, 50, 12], [70, 20, 13], [118, 40, 11],
    ];
    for (const [x, z, h] of giants) {
      this.addGiantTree(x, 18, z, h);
    }
  }

  /** Árbol fantasy gigante: tronco grueso + copa enorme (8-15 m de copa). */
  private addGiantTree(x: number, yGround: number, z: number, height: number): void {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(height * 0.07, height * 0.11, height * 0.62, 9), this.matTrunk);
    trunk.position.y = height * 0.31;
    trunk.castShadow = true;
    tree.add(trunk);
    const crownR = height * 0.42;
    for (const [ox, oy, oz, s] of [[0, 0.78, 0, 1], [0.3, 0.66, 0.22, 0.7], [-0.32, 0.7, -0.15, 0.75], [0.1, 0.62, -0.3, 0.6]] as const) {
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(crownR * s, 2), this.matLeaf);
      blob.position.set(ox * height * 0.4, oy * height, oz * height * 0.4);
      blob.castShadow = true;
      tree.add(blob);
    }
    tree.position.set(x, yGround, z);
    this.group.add(tree);
    this.obstacles.push({ position: new THREE.Vector3(x, yGround, z), radius: height * 0.11 });
  }

  // ==================================================================
  // ÁREA 7 — SENDERO DE ORYN (≈105 m, ancho 4-8, semi-cerrado)
  // ==================================================================
  private buildSendero(): void {
    this.checkpoints.push(new THREE.Vector3(58, 12, -8));
    // Camino de piedra serpenteante con muros de roca a los lados
    this.addRoadX(62, 56, 8, 12.05);
    this.addRoad(56, 4, 0, -40, 12.05);
    const walls: [number, number, number][] = [
      [50, -4, 0.3], [64, -2, -0.2], [49, -16, 0.1], [65, -18, 0.4],
      [50, -30, -0.3], [63, -34, 0.2], [52, 6, 0.5],
    ];
    for (const [x, z, rot] of walls) {
      const wall = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6, 0), this.matRock);
      wall.position.set(x, 13, z);
      wall.rotation.set(rot, Math.random() * 3, 0.3);
      wall.scale.set(1.4, 1, 1);
      this.group.add(wall);
      this.obstacles.push({ position: new THREE.Vector3(x, 12, z), radius: 2.6 });
    }
    // Desvío 1: mirador al mar (este)
    this.addRoadX(64, 74, -12, 12.05);
    // Desvío 2: rincón con cofre (oeste)
    this.addRoadX(50, 44, -24, 12.05);

    // Montículo de la reliquia (lo huele Oryn)
    this.mound = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 9),
      new THREE.MeshStandardMaterial({ color: 0xc9a96e, roughness: 0.95 }));
    this.mound.scale.y = 0.45;
    this.mound.position.copy(this.moundPos);
    this.group.add(this.mound);
    this.relic = new THREE.Group();
    const relicBody = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 1.5, 6), this.matGoldGlow);
    relicBody.position.y = 0.75;
    this.relic.add(relicBody);
    const relicGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.38), this.matGoldGlow);
    relicGem.position.y = 1.9;
    this.relic.add(relicGem);
    this.relic.position.copy(this.moundPos);
    this.relic.visible = false;
    this.group.add(this.relic);
  }

  // ==================================================================
  // ÁREA 8 — SANTUARIO DEL DESAFÍO (42×34): reto cronometrado
  // ==================================================================
  private buildChallenge(): void {
    this.checkpoints.push(new THREE.Vector3(-55, 28, -86));
    // Entrada clara: arco + santuario
    this.addArch(-55, 28, -82, 5, 4.5);
    const shrine = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2, 2.2, 6), this.matStone);
    shrine.position.set(-55, 29.1, -90);
    this.group.add(shrine);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.7),
      new THREE.MeshStandardMaterial({ color: 0xffb070, emissive: 0x803010, emissiveIntensity: 0.6 }));
    crystal.position.set(-55, 31, -90);
    this.group.add(crystal);
    this.triggers.push({ id: 'desafio', position: new THREE.Vector3(-55, 28, -90), radius: 4 });
    this.obstacles.push({ position: new THREE.Vector3(-55, 28, -90), radius: 2.1 });

    // Plataformas TEMPORALES ascendiendo al pedestal flotante
    this.challengeGroup = new THREE.Group();
    const tempMat = new THREE.MeshStandardMaterial({
      color: 0x9fe8ff, emissive: 0x3aa8d8, emissiveIntensity: 0.9, transparent: true, opacity: 0.85,
    });
    const platforms: [number, number, number][] = [
      [-48, 30.5, -96], [-42, 33, -102], [-48, 35.5, -108], [-56, 37.5, -112],
      [-64, 39.5, -108], [-62, 41, -100],
    ];
    for (const [x, y, z] of platforms) {
      const p = new THREE.Mesh(new RoundedBoxGeometry(3.2, 0.6, 3.2, 2, 0.1), tempMat);
      p.position.set(x, y, z);
      this.challengeGroup.add(p);
      this.groundMeshes.push(p);
    }
    // Pedestal de recompensa flotante
    const podium = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 1, 10), this.matStone);
    podium.position.set(-55, 40.5, -112);
    this.challengeGroup.add(podium);
    this.groundMeshes.push(podium);
    this.challengeGroup.visible = false;
    this.group.add(this.challengeGroup);
  }

  /** Activa/desactiva las plataformas temporales del desafío. */
  setChallengeActive(active: boolean): void {
    this.challengeGroup.visible = active;
  }

  /** (Compat.) los braseros se mantienen para feedback de progreso. */
  setArenaWave(wave: number): void {
    this.braziers.forEach((brazier, i) => {
      const mat = brazier.material as THREE.MeshStandardMaterial;
      mat.emissive.set(i < wave ? 0xff8a30 : 0x202020);
      mat.emissiveIntensity = i < wave ? 1.4 : 0.3;
    });
  }

  // ==================================================================
  // FASE 4 — CIUDAD EN 3 DISTRITOS
  // ==================================================================

  /** Lower Terrace District (y12): casas 6-9 m, calles, muros, plaza. */
  private buildLowerDistrict(): void {
    this.checkpoints.push(new THREE.Vector3(0, 12, 10));
    const houses: [number, number, number, number, number][] = [
      // x, z, ancho, alto, rotY (todo en la cima plana de la mesa y12)
      // Nota: x32 deja libre la escalera del mirador (x22, z12→20)
      [-24, 18, 7, 7, 0.3], [-32, 2, 8, 7.5, 0.9], [32, 13, 7.5, 6.5, -0.4],
      [34, 0, 6.5, 8, -1.1], [-16, -8, 9, 8.5, 0.1], [16, -10, 7, 7, 0.2],
    ];
    for (const [x, z, w, h, rot] of houses) {
      this.addHouseScaled(x, 12, z, w, h, [0xf2917e, 0x8fd6cf, 0xf5e6c4][Math.floor(Math.random() * 3)], rot);
    }
    // Calles y muros bajos (con colisión real)
    this.addRoadX(-26, 26, 6, 12.05);
    for (const [x, z, len, rot] of [[-40, 8, 16, 0], [40, 6, 14, 0], [0, 24, 30, Math.PI / 2]] as const) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 1.1, len), this.matStoneDark);
      wall.position.set(x, 12.55, z);
      wall.rotation.y = rot;
      this.group.add(wall);
      this.boxColliders.push({
        cx: x, cz: z, hx: rot === 0 ? 0.5 : len / 2, hz: rot === 0 ? len / 2 : 0.5,
        rotY: 0, y0: 12, y1: 13.1,
      });
    }
    // Plaza del mercado
    const market = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.4, 0.4, 18), this.matStone);
    market.position.set(14, 12.05, 4);
    this.group.add(market);
    this.groundMeshes.push(market);
    this.addFountain(14, 12.25, 4);
    // Jardines entre las casas (arte de librería; si falta, la vegetación procedural cubre)
    this.addGarden(-8, 12, 18, 'garden');
    this.addGarden(6, 12, -16, 'garden2');
    this.addGarden(-26, 12, -14, 'garden');
    // Escaleras urbanas + mirador a la playa
    this.addStairs(22, 12, 12, 22, 14.4, 20, 2.5);
    this.addPlatform(22, 14.4, 24, 7, 1, 7, this.matStone);
  }

  /** Mid Terrace District (y28): edificios 10-16 m, balcones, puentes, mirador. */
  private buildMidDistrict(): void {
    this.checkpoints.push(new THREE.Vector3(0, 28, -60));
    const buildings: [number, number, number, number, number, number][] = [
      // x, z, ancho, fondo, alto, rotY
      [-26, -58, 12, 10, 12, 0.2], [26, -56, 14, 11, 13, -0.3],
      [-34, -82, 11, 9, 11, 0.5], [34, -84, 12, 10, 14, -0.2],
      [-18, -104, 13, 10, 12, 0.1], [20, -106, 11, 9, 10.5, -0.5],
    ];
    for (const [x, z, w, d, h, rot] of buildings) {
      this.addBuilding(x, 28, z, w, d, h, rot);
    }
    // Segunda plaza (con fuente)
    const plaza2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8.5, 0.4, 22), this.matStone);
    plaza2.position.set(0, 28.05, -72);
    this.group.add(plaza2);
    this.groundMeshes.push(plaza2);
    this.addFountain(0, 28.25, -72);

    // Jardines junto a los edificios
    this.addGarden(-10, 28, -52, 'garden2');
    this.addGarden(12, 28, -90, 'garden');

    // Terraza Mirador (12×10) asomada al mar este, con barandilla
    const mirador = new THREE.Mesh(new THREE.BoxGeometry(12, 0.8, 10), this.matStone);
    mirador.position.set(56, 28, -74);
    this.group.add(mirador);
    this.groundMeshes.push(mirador);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(12, 1, 0.3), this.matStoneDark);
    rail.position.set(56, 29, -79);
    this.group.add(rail);
    this.boxColliders.push({ cx: 56, cz: -79, hx: 6, hz: 0.3, rotY: 0, y0: 28, y1: 29.6 });
    this.addRoadX(34, 50, -74, 28.05);

    // Puente corto sobre el canal ornamental
    const canal = new THREE.Mesh(new THREE.BoxGeometry(40, 0.4, 4),
      new THREE.MeshStandardMaterial({ color: 0x2a6a88, emissive: 0x103a50, emissiveIntensity: 0.5, transparent: true, opacity: 0.85 }));
    canal.position.set(0, 27.4, -90);
    this.group.add(canal);
    for (const bx of [-8, 8]) {
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.5, 8), this.matWood);
      bridge.position.set(bx, 28.2, -90);
      this.group.add(bridge);
      this.groundMeshes.push(bridge);
    }

  }

  /** Upper Sacred District (y58): monumental, ruinas, templos, camino ceremonial. */
  private buildUpperDistrict(): void {
    // Camino ceremonial flanqueado por arcos y columnas
    for (const z of [-116, -128, -140]) {
      this.addArch(0, 58, z, 5.5, 5);
    }
    for (const side of [-1, 1]) {
      for (const z of [-110, -122, -134, -146]) {
        this.addColumn(7 * side, 58, z, 6, Math.random() > 0.6);
      }
    }
    // Templos pequeños (18×14, alto 15)
    this.addTemple(-30, 58, -128);
    this.addTemple(30, 58, -132);
    // Hero crystals (6-10 m)
    for (const [x, z, s] of [[-18, -152, 4.2], [20, -158, 3.4], [-26, -108, 2.8]] as const) {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(s), this.matAuralis);
      crystal.position.set(x, 58 + s * 0.7, z);
      crystal.rotation.set(0.3, Math.random() * 3, 0.15);
      this.group.add(crystal);
      this.obstacles.push({ position: new THREE.Vector3(x, 58, z), radius: s * 0.7 });
    }
  }

  /** Rota entre las variantes de casa de la librería para que el barrio no se repita. */
  private houseVariant = 0;
  private static readonly HOUSE_SLOTS = ['house', 'house2', 'house3', 'house4'];

  private addHouseScaled(x: number, yGround: number, z: number, w: number, h: number, color: number, rotY: number): void {
    const slot = LevelManager.HOUSE_SLOTS[this.houseVariant % LevelManager.HOUSE_SLOTS.length];
    const gltfHouse = this.assets?.getClone(slot, h) ?? this.assets?.getClone('house', h);
    if (gltfHouse) {
      this.houseVariant++;
      // Colisión a partir de la huella real del modelo (antes de rotarlo)
      const box = new THREE.Box3().setFromObject(gltfHouse);
      const hx = Math.max((box.max.x - box.min.x) / 2, 1);
      const hz = Math.max((box.max.z - box.min.z) / 2, 1);
      gltfHouse.position.set(x, yGround + gltfHouse.position.y, z);
      gltfHouse.rotation.y = rotY;
      this.group.add(gltfHouse);
      this.boxColliders.push({ cx: x, cz: z, hx, hz, rotY, y0: yGround, y1: yGround + h });
      return;
    }
    const house = new THREE.Group();
    const wall = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    const d = w * 0.85;
    const body = new THREE.Mesh(new RoundedBoxGeometry(w, h * 0.62, d, 2, 0.1), wall);
    body.position.y = h * 0.31;
    body.castShadow = true;
    house.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.78, h * 0.42, 4),
      new THREE.MeshStandardMaterial({ color: 0xc96f4a, roughness: 0.8 }));
    roof.position.y = h * 0.82;
    roof.rotation.y = Math.PI / 4;
    house.add(roof);
    // Puerta a escala humana (2.4 m) y ventanas
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.4, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x7a4a2e }));
    door.position.set(0, 1.2, d / 2 + 0.02);
    house.add(door);
    for (const side of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1, 1.1, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x4090a8, emissiveIntensity: 0.4 }));
      win.position.set(side * w * 0.26, h * 0.36, d / 2 + 0.02);
      house.add(win);
    }
    house.position.set(x, yGround, z);
    house.rotation.y = rotY;
    this.group.add(house);
    // Colisión de caja orientada: las paredes son paredes
    this.boxColliders.push({ cx: x, cz: z, hx: w / 2, hz: d / 2, rotY, y0: yGround, y1: yGround + h });
  }

  /** Edificio mediano con balcón (Mid District). */
  private addBuilding(x: number, yGround: number, z: number, w: number, d: number, h: number, rotY: number): void {
    const building = new THREE.Group();
    const wall = new THREE.MeshStandardMaterial({ color: [0xf5e6c4, 0xe8cba8, 0xd8b8d0][Math.floor(Math.random() * 3)], roughness: 0.85 });
    const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.12), wall);
    body.position.y = h / 2;
    body.castShadow = true;
    building.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, h * 0.32, 4),
      new THREE.MeshStandardMaterial({ color: 0xc96f4a, roughness: 0.8 }));
    roof.position.y = h + h * 0.15;
    roof.rotation.y = Math.PI / 4;
    building.add(roof);
    // Balcón con barandilla a media altura
    const balcony = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.3, 2), this.matStoneDark);
    balcony.position.set(0, h * 0.55, d / 2 + 1);
    building.add(balcony);
    const bRail = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.8, 0.15), this.matStoneDark);
    bRail.position.set(0, h * 0.55 + 0.5, d / 2 + 2);
    building.add(bRail);
    // Puerta 3 m (arco habitable)
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.2, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x7a4a2e }));
    door.position.set(0, 1.6, d / 2 + 0.05);
    building.add(door);
    building.position.set(x, yGround, z);
    building.rotation.y = rotY;
    this.group.add(building);
    this.boxColliders.push({ cx: x, cz: z, hx: w / 2, hz: d / 2, rotY, y0: yGround, y1: yGround + h });
  }

  /** Templo pequeño monumental (Upper District). */
  private addTemple(x: number, yGround: number, z: number): void {
    const base = new THREE.Mesh(new THREE.BoxGeometry(18, 2, 14), this.matStone);
    base.position.set(x, yGround + 1, z);
    this.group.add(base);
    this.groundMeshes.push(base);
    for (const [cx, cz] of [[-6, -4], [6, -4], [-6, 4], [6, 4]] as const) {
      this.addColumn(x + cx, yGround + 2, z + cz, 8, false);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(17, 1.6, 13), this.matStoneDark);
    roof.position.set(x, yGround + 11, z);
    roof.castShadow = true;
    this.group.add(roof);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), this.matAuralis);
    gem.position.set(x, yGround + 13.4, z);
    this.group.add(gem);
    this.addStairs(x, yGround, z + 10, x, yGround + 2, z + 7, 5);
  }

  /** Arco monumental (altura útil 4.5-5 m). */
  private addArch(x: number, yGround: number, z: number, width: number, height: number): void {
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.1, height, 1.1), this.matStone);
      pillar.position.set(x + side * width / 2, yGround + height / 2, z);
      pillar.castShadow = true;
      this.group.add(pillar);
      this.obstacles.push({ position: new THREE.Vector3(x + side * width / 2, yGround, z), radius: 0.9 });
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(width + 1.6, 1, 1.4), this.matStone);
    lintel.position.set(x, yGround + height + 0.5, z);
    this.group.add(lintel);
  }

  // ==================================================================
  // Resto de sistemas (cueva, notas, eventos, decoración, lumas)
  // ==================================================================

  openCaveBridge(): void {
    this.caveBridgeOpen = true;
    this.caveBridge.visible = true;
    this.groundMeshes.push(this.caveBridge);
  }

  pressPlate(plate: { mesh: THREE.Mesh; pressed: boolean }): void {
    plate.pressed = true;
    plate.mesh.position.y -= 0.1;
    (plate.mesh.material as THREE.MeshStandardMaterial).emissive.set(0x2ec4b6);
    (plate.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2;
  }

  openCaveChest(): void {
    this.caveChestOpened = true;
    this.caveChestLid.rotation.x = -1.1;
    this.caveChestLid.position.add(new THREE.Vector3(0, 0.2, -0.7));
  }

  /** Notas de Luz: árbol de la arboleda, sendero, cueva, cascada y ruta vertical. */
  private buildNotes(): void {
    const noteMat = new THREE.MeshStandardMaterial({
      color: 0xffe9a0, emissive: 0xffb820, emissiveIntensity: 1.2, roughness: 0.3,
    });
    const spots: [number, number, number][] = [
      [78, 28, 15],          // 1. copa de un árbol gigante de la Arboleda
      [70, 13.6, -12],       // 2. mirador del Sendero de Oryn
      [410, 10.6, 12],       // 3. dentro de la Cueva Azul
      [-56, 29.5, -60],      // 4. sobre la cascada (borde de la ciudad media)
      [-16, 49.4, -86],      // 5. terraza alta de la Ruta Vertical
    ];
    for (const [x, y, z] of spots) {
      const note = new THREE.Group();
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), noteMat);
      head.scale.set(1, 0.75, 1);
      head.rotation.z = -0.4;
      note.add(head);
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1, 0.09), noteMat);
      stem.position.set(0.26, 0.56, 0);
      note.add(stem);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.09), noteMat);
      flag.position.set(0.48, 0.98, 0);
      flag.rotation.z = -0.4;
      note.add(flag);
      note.position.set(x, y, z);
      this.group.add(note);
      this.notes.push({ group: note, collected: false, position: new THREE.Vector3(x, y, z) });
    }
  }

  setFaroCharge(charge: number): void {
    const t = Math.min(charge / 3, 1);
    this.faroCrystalMat.color.lerpColors(new THREE.Color(0x9fb8c8), new THREE.Color(0xffe9a0), t);
    this.faroCrystalMat.emissive.lerpColors(new THREE.Color(0x223344), new THREE.Color(0xffaa00), t);
    this.faroCrystalMat.emissiveIntensity = 0.3 + t * 0.9;
  }

  purifyIsland(): void {
    const mats = [0xf2917e, 0xffd34d, 0xe85a8a, 0x9fe8ff].map(
      (c) => new THREE.MeshStandardMaterial({ color: c }));
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      const r = 12 + (i % 4) * 9;
      const flower = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), mats[i % 4]);
      flower.position.set(Math.cos(a) * r, 2.25, 130 + Math.sin(a) * r * 0.6);
      this.group.add(flower);
    }
  }

  purifyWestZone(): void {
    const mats = [0xf2917e, 0xffd34d, 0xe85a8a].map(
      (c) => new THREE.MeshStandardMaterial({ color: c }));
    const flowers: [number, number][] = [
      [-108, 68], [-72, 62], [-100, 94], [-62, 86], [-86, 76], [-116, 80], [-54, 72],
    ];
    flowers.forEach(([x, z], i) => {
      const flower = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), mats[i % 3]);
      flower.position.set(x, 2.3, z);
      this.group.add(flower);
    });
    for (const [x, z] of [[-104, 74], [-66, 70], [-90, 90]] as const) {
      const glimmer = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0x6fffe0, transparent: true, opacity: 0.6 }));
      glimmer.position.set(x, 2.6, z);
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
  // Decoración, vegetación jerárquica y vida
  // ------------------------------------------------------------------

  private addRoad(x: number, z0: number, _u: number, z1: number, yTop: number): void {
    const tileGeo = new THREE.BoxGeometry(2.2, 0.12, 1.7);
    for (let z = z0; z >= z1; z -= 2.1) {
      const tile = new THREE.Mesh(tileGeo, this.matStone);
      tile.position.set(x + (Math.random() - 0.5) * 0.3, yTop + 0.02, z);
      tile.rotation.y = (Math.random() - 0.5) * 0.18;
      tile.receiveShadow = true;
      this.group.add(tile);
    }
  }

  private addRoadX(x0: number, x1: number, z: number, yTop: number): void {
    const tileGeo = new THREE.BoxGeometry(1.7, 0.12, 2.2);
    const step = x1 > x0 ? 2.1 : -2.1;
    for (let x = x0; step > 0 ? x <= x1 : x >= x1; x += step) {
      const tile = new THREE.Mesh(tileGeo, this.matStone);
      tile.position.set(x, yTop + 0.02, z + (Math.random() - 0.5) * 0.3);
      tile.rotation.y = (Math.random() - 0.5) * 0.18;
      this.group.add(tile);
    }
  }

  private addColumn(x: number, yGround: number, z: number, height: number, broken: boolean): void {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, height, 9), this.matStone);
    col.position.set(x, yGround + height / 2, z);
    if (broken) col.rotation.z = 0.12;
    col.castShadow = true;
    this.group.add(col);
    if (!broken) {
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), this.matAuralis);
      gem.position.set(x, yGround + height + 0.5, z);
      this.group.add(gem);
    }
    this.obstacles.push({ position: new THREE.Vector3(x, yGround, z), radius: 0.85 });
  }

  /** Palmera con jerarquía de tamaño: small 5 m, mediana 8.5 m, hero 12.5 m. */
  private addTree(x: number, yGround: number, z: number, size: 'small' | 'med' | 'hero' = 'med'): void {
    const height = size === 'small' ? 5 : size === 'med' ? 8.5 : 12.5;
    const gltfTree = this.assets?.getClone('tree', height);
    if (gltfTree) {
      gltfTree.position.set(x, yGround + gltfTree.position.y, z);
      gltfTree.rotation.y = Math.random() * Math.PI * 2;
      this.group.add(gltfTree);
      this.obstacles.push({ position: new THREE.Vector3(x, yGround, z), radius: height * 0.06 + 0.3 });
      return;
    }
    const scale = height / 3.2;
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

  private buildDecorations(): void {
    // Hub: palmeras con jerarquía
    this.addTree(-26, 2, 150, 'hero');
    this.addTree(28, 2, 156, 'med');
    this.addTree(-36, 2, 120, 'med');
    this.addTree(40, 2, 128, 'small');
    this.addTree(-16, 2, 100, 'med');
    this.addTree(22, 2, 92, 'small');
    this.addTree(48, 2, 70, 'hero');
    // Coral
    this.addTree(-50, 2, 96, 'med');
    this.addTree(-130, 2, 76, 'small');
    // Distrito bajo
    this.addTree(-40, 12, -28, 'med');
    this.addTree(42, 12, -30, 'small');
    // Ciudad media
    this.addTree(-44, 28, -70, 'med');
    this.addTree(46, 28, -94, 'med');
    this.addTree(-12, 28, -52, 'small');
    // Distrito alto: vegetación escasa, monumental
    this.addTree(-38, 58, -150, 'hero');
    this.addTree(38, 58, -118, 'med');
  }

  private addBanner(x: number, yGround: number, z: number, color: number): void {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4.4, 6), this.matTrunk);
    pole.position.set(x, yGround + 2.2, z);
    this.group.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8),
      new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide }));
    flag.position.set(x + (x > 0 ? -0.7 : 0.7), yGround + 3.9, z);
    this.group.add(flag);
  }

  private buildQuiriesAt(spots: [number, number, number][]): void {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xffe28a, emissive: 0xc9962a, emissiveIntensity: 0.8,
    });
    for (const [x, y, z] of spots) {
      const quiri = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 7), bodyMat);
      quiri.add(body);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 5),
        new THREE.MeshStandardMaterial({ color: 0xc96f4a }));
      beak.position.set(0, 0, 0.24);
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
    for (const [x, z] of [[60, 150], [-70, 140], [-140, 30], [140, -10], [40, -180], [-50, -185]] as const) {
      const glimmer = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5), mat.clone());
      glimmer.position.set(x, 0.3, z);
      this.group.add(glimmer);
      this.glimmers.push({ mesh: glimmer, phase: Math.random() * Math.PI * 2 });
    }
  }

  private buildCrates(): void {
    this.addCrate(-20, 2, 134);
    this.addCrate(-100, 2, 62);
    this.addCrate(44, 12, 14);
    this.addCrate(-30, 28, -76);
    this.addCrate(70, 12, -14);
    this.addCrate(-10, 58, -120);
  }

  private addCrate(x: number, yGround: number, z: number): void {
    let mesh: THREE.Object3D | null = this.assets?.getClone('crate', 1.4) ?? null;
    if (mesh) {
      // El GLB ya trae los pies en el origen tras normalizar la altura
      mesh.position.x = x;
      mesh.position.y += yGround;
      mesh.position.z = z;
      mesh.rotation.y = Math.random() * Math.PI * 2;
    } else {
      mesh = new THREE.Mesh(new RoundedBoxGeometry(1.4, 1.4, 1.4, 2, 0.1), this.matCrate);
      mesh.position.set(x, yGround + 0.7, z);
      mesh.castShadow = true;
    }
    this.group.add(mesh);
    const obstacle: Obstacle = { position: new THREE.Vector3(x, yGround, z), radius: 0.95 };
    this.obstacles.push(obstacle);
    this.crates.push({ mesh, obstacle, broken: false });
  }

  /** Fuente de plaza: modelo de librería con respaldo de cristal procedural. */
  private addFountain(x: number, yGround: number, z: number): void {
    const gltf = this.assets?.getClone('fountain', 2.2);
    if (gltf) {
      gltf.position.x = x;
      gltf.position.y += yGround;
      gltf.position.z = z;
      this.group.add(gltf);
      this.obstacles.push({ position: new THREE.Vector3(x, yGround, z), radius: 2.1 });
      return;
    }
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.6), this.matAuralis);
    crystal.position.set(x, yGround + 1.9, z);
    this.group.add(crystal);
    this.obstacles.push({ position: new THREE.Vector3(x, yGround, z), radius: 2 });
  }

  /** Parche de jardín decorativo (sin colisión: se puede atravesar el césped). */
  private addGarden(x: number, yGround: number, z: number, slot: 'garden' | 'garden2'): void {
    const gltf = this.assets?.getClone(slot, slot === 'garden2' ? 4.2 : 2.8);
    if (!gltf) return;
    gltf.position.x = x;
    gltf.position.y += yGround;
    gltf.position.z = z;
    gltf.rotation.y = Math.random() * Math.PI * 2;
    this.group.add(gltf);
  }

  /** Bandera en cada checkpoint: el jugador ve dónde reaparecerá. */
  private placeCheckpointFlags(): void {
    for (let i = 1; i < this.checkpoints.length; i++) {
      const cp = this.checkpoints[i];
      const flag = this.assets?.getClone('flag', 2.6);
      if (!flag) return;
      // A un lado del punto exacto para no estorbar el paso
      flag.position.x += cp.x + 1.6;
      flag.position.y += cp.y;
      flag.position.z += cp.z;
      this.group.add(flag);
    }
  }

  private addPad(x: number, yGround: number, z: number, power: number): void {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.4, 12), this.matStone);
    base.position.set(x, yGround + 0.2, z);
    this.group.add(base);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.3, 12),
      new THREE.MeshStandardMaterial({ color: 0x2ec4b6, emissive: 0x18887e, emissiveIntensity: 0.7 }));
    top.position.set(x, yGround + 0.55, z);
    this.group.add(top);
    this.pads.push({ position: new THREE.Vector3(x, yGround + 0.6, z), power, mesh: top });
  }

  // ------------------------------------------------------------------
  // Lumas y enemigos
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
    // RUTA PRINCIPAL (spawn → faro)
    this.lumaLine(0, 3, 156, 0, 3, 90, 12);
    this.lumaLine(0, 4, 80, 0, 13, 48, 7);
    this.lumaLine(0, 13, 40, 0, 13, 2, 8);
    this.lumaLine(0, 14, 0, 0, 29, -34, 7);
    this.lumaLine(0, 29, -42, 0, 29, -80, 8);
    // RUTA VERTICAL: cada plataforma + corrientes
    add(0, 33, -92); add(9, 36, -94); add(16, 39, -90); add(8, 42.5, -84);
    add(-1, 43.5, -88); add(-9, 46, -92); add(-16, 49.5, -86);
    this.lumaLine(-8, 53, -94, -8, 58.5, -94, 4);  // dentro del viento
    this.lumaLine(0, 60, -104, 0, 60, -132, 5);
    // FARO: hélice + galería
    add(9, 75, -163); add(13, 78.5, -170); add(9, 82, -177); add(0, 85.5, -180);
    add(-9, 89, -177); add(-13, 92.5, -170); add(-9, 96, -163); add(0, 99.5, -160);
    this.lumaRing(0, 109.5, -170, 3.4, 6);
    // HUB + plaza
    this.lumaRing(0, 3.2, 145, 12, 10);
    // CORAL
    this.lumaRing(-85, 3.4, 80, 16, 12);
    this.lumaLine(-120, 3.4, 64, -56, 3.4, 96, 7);
    // ARBOLEDA
    this.lumaRing(95, 19.5, 35, 11, 10);
    this.lumaLine(40, 3.5, 42, 60, 19.5, 42, 6);
    // SENDERO DE ORYN
    this.lumaLine(58, 13.4, 4, 58, 13.4, -38, 9);
    add(70, 13.6, -12); add(46, 13.6, -24);
    // DESAFÍO (anillo de la entrada)
    this.lumaRing(-55, 29.5, -90, 6, 6);
    // CUEVA
    this.lumaLine(398, 10.4, -8, 410, 10.4, 10, 6);
    this.lumaRing(432, 10.6, 6, 4, 6);
    // CIUDAD: plazas y mirador
    this.lumaRing(14, 13.4, 4, 5, 6);
    this.lumaRing(0, 29.5, -72, 6.5, 8);
    add(56, 29.6, -74); add(22, 15.8, 24);
    // SECRETOS: orillas y rincones
    this.lumaRing(0, 1, 40, 148, 14);
    add(-140, 2.6, 30); add(142, 2.6, -20); add(0, 2.4, -198); add(120, 2.4, 90);
    add(-56, 30.5, -60); // sobre la cascada
  }

  private placeEnemies(): void {
    const def = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) =>
      this.enemyDefs.push({ pointA: new THREE.Vector3(ax, ay, az), pointB: new THREE.Vector3(bx, by, bz) });
    // Camino del hub (introducción, lejos del spawn)
    def(-8, 2, 96, 8, 2, 96);
    // Coral (3)
    def(-78, 2, 70, -94, 2, 86);
    def(-110, 2, 78, -98, 2, 64);
    def(-60, 2, 88, -72, 2, 96);
    // Sendero de Oryn (2)
    def(56, 12, -6, 60, 12, -22);
    def(52, 12, -32, 62, 12, -36);
    // Distrito bajo (2)
    def(-22, 12, 12, -2, 12, 8);
    def(20, 12, -4, 34, 12, 6);
    // Ciudad media (3)
    def(-20, 28, -64, -8, 28, -78);
    def(18, 28, -88, 30, 28, -72);
    def(-30, 28, -98, -16, 28, -108);
    // Distrito alto (2, guardianes)
    def(-12, 58, -118, 12, 58, -118);
    def(14, 58, -144, -14, 58, -144);
  }

  breakCratesNear(center: THREE.Vector3, radius: number): THREE.Vector3[] {
    const broken: THREE.Vector3[] = [];
    for (const crate of this.crates) {
      if (crate.broken) continue;
      if (crate.mesh.position.distanceTo(center) <= radius + 0.7) {
        crate.broken = true;
        crate.mesh.visible = false;
        const idx = this.obstacles.indexOf(crate.obstacle);
        if (idx >= 0) this.obstacles.splice(idx, 1);
        broken.push(crate.mesh.position.clone());
      }
    }
    return broken;
  }

  private snapLumasToGround(): void {
    const raycaster = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    for (const pos of this.crystalPositions) {
      raycaster.set(new THREE.Vector3(pos.x, pos.y + 16, pos.z), down);
      raycaster.far = 60;
      const hit = raycaster.intersectObjects(this.groundMeshes, false)[0];
      if (!hit) continue;
      const ideal = hit.point.y + 1.2;
      if (Math.abs(pos.y - ideal) < 3) pos.y = ideal;
    }
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
      note.group.position.y = note.position.y + Math.sin(this.time * 2.4 + note.position.x) * 0.18;
      note.group.rotation.y += dt * 1.8;
    }
    for (const pad of this.pads) {
      pad.mesh.position.y = pad.position.y - 0.05 + Math.sin(this.time * 3) * 0.06;
    }
    if (this.relicRise >= 0 && this.relicRise < 1) {
      this.relicRise += dt * 1.2;
      const t = Math.min(this.relicRise, 1);
      this.relic.position.y = this.moundPos.y - 1.6 + t * 2;
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
