import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
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

/** Trampolín que lanza al jugador hacia arriba (atajos y juice). */
export interface BouncePad {
  position: THREE.Vector3;
  power: number;
  mesh: THREE.Mesh;
}

/** Punto de interacción narrativo (teasers de contenido futuro, tienda…). */
export interface Trigger {
  id: string;
  position: THREE.Vector3;
  radius: number;
}

/**
 * LevelManager — "Costa Brillante" (Isla Auria), rediseño mundo abierto
 * ----------------------------------------------------------------------
 * Ya no es un pasillo: es un mini mundo abierto compacto con la playa
 * central como hub. Desde el spawn se ven 3 caminos y el Faro del Alba:
 *
 *   · NORTE — el Faro del Alba sobre su acantilado: ruta vertical de
 *     plataformas en espiral hasta la cima (Destello del Faro) y el
 *     pedestal de activación en la base.
 *   · OESTE — playa de combate: el Caracoral Brute y las 3 rocas
 *     corruptas (Destello del Coral Dormido al purificar la zona).
 *   · ESTE — ruinas antiguas donde Oryn olfatea una reliquia enterrada
 *     (Destello de Oryn), con la cascada y la puerta sellada de la
 *     Cueva Azul visibles pero inaccesibles (teaser).
 *
 * En el hub además: aldea pastel, santuario de corazones (los Lumas son
 * moneda), los Quiríes con su misión futura y el santuario del desafío
 * dormido. Los Lumas son recompensa secundaria repartida por todos los
 * caminos; el objetivo son los Destellos.
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

  // --- Faro del Alba ---
  readonly faroPedestalPos = new THREE.Vector3(0, 4, -19.5);
  readonly faroDestelloPos = new THREE.Vector3(0, 16.8, -26);
  private faroCrystal!: THREE.Mesh;
  private faroBeam!: THREE.Mesh;
  private faroActivated = false;

  // --- Zona oeste (Caracoral) ---
  readonly corruptRocks: CorruptRock[] = [];
  readonly westCenter = new THREE.Vector3(-26, 0.8, -4);
  readonly westBounds = { minX: -34, maxX: -18, minZ: -11, maxZ: 3 };
  readonly coralDestelloPos = new THREE.Vector3(-26, 2.2, -4);

  // --- Secreto de Oryn (este) ---
  readonly orynZoneCenter = new THREE.Vector3(26, 1.2, -6);
  readonly orynZoneRadius = 11;
  readonly moundPos = new THREE.Vector3(30, 1.2, -10);
  readonly orynDestelloPos = new THREE.Vector3(30, 2.6, -10);
  private mound!: THREE.Mesh;
  private relic!: THREE.Group;
  private relicRise = -1;

  private time = 0;
  private quiries: { mesh: THREE.Group; phase: number }[] = [];
  private glimmers: { mesh: THREE.Mesh; phase: number }[] = [];

  // Materiales compartidos — paleta caribeña de Isla Auria
  private matGrass = new THREE.MeshStandardMaterial({ color: 0x58b368 });
  private matSand = new THREE.MeshStandardMaterial({ color: 0xeed3a0 });
  private matWood = new THREE.MeshStandardMaterial({ color: 0xb07a5a });
  private matRock = new THREE.MeshStandardMaterial({ color: 0xb3ab98 });
  private matTrunk = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
  private matLeaf = new THREE.MeshStandardMaterial({ color: 0x2fa05e });
  private matCrate = new THREE.MeshStandardMaterial({ color: 0xc96f4a });
  private matStone = new THREE.MeshStandardMaterial({ color: 0xe8dcc0 });
  private matNoxia = new THREE.MeshStandardMaterial({
    color: 0x5a3a78, emissive: 0x3a1060, emissiveIntensity: 0.6,
  });
  private matGoldGlow = new THREE.MeshStandardMaterial({
    color: 0xffd34d, emissive: 0xffaa00, emissiveIntensity: 0.8,
  });

  constructor(scene: THREE.Scene) {
    this.buildHub();
    this.buildFaro();
    this.buildWestZone();
    this.buildEastZone();
    this.buildWater();
    this.buildVista();
    this.buildDecorations();
    this.buildShrines();
    this.buildCrates();
    this.buildPads();
    this.buildGlimmers();
    this.placeLumas();
    this.placeEnemies();
    scene.add(this.group);
  }

  // ------------------------------------------------------------------
  // Construcción de zonas
  // ------------------------------------------------------------------

  /** Costas registradas para la espuma del agua. */
  private shores: IslandShore[] = [];
  private water2!: WaterSurface;

  /**
   * Isla orgánica esculpida: malla con costa irregular, meseta superior
   * caminable y playa en pendiente hacia el mar. Colores por vértice
   * (cima → arena → arena mojada) en lugar de cajas apiladas.
   */
  private addIsland(cx: number, cz: number, rx: number, rz: number, topY: number,
    topColor: number, seed: number): void {
    const SEG = 44;
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
      // Costa irregular: radio modulado por ángulo
      const rMod = 1 + 0.09 * Math.sin(3 * ang + seed) + 0.06 * Math.sin(7 * ang + seed * 2.3);
      const e = Math.hypot(nx, nz) / rMod;
      // Perfil: meseta (e<0.78) → playa en pendiente → fondo marino
      let h: number;
      if (e < 0.78) {
        h = topY + Math.sin(nx * 9 + seed) * Math.cos(nz * 8 + seed) * 0.05;
      } else {
        const t = Math.min((e - 0.78) / 0.27, 1);
        const sm = t * t * (3 - 2 * t); // smoothstep
        h = topY - sm * (topY + 1.5);
      }
      pos.setXYZ(i, nx * rx, h, nz * rz);
      // Color por altura/borde: cima → arena seca → arena mojada
      if (e < 0.7) tmp.copy(cTop);
      else if (e < 0.85) tmp.copy(cTop).lerp(cSand, (e - 0.7) / 0.15);
      else tmp.copy(cSand).lerp(cWet, Math.min((e - 0.85) / 0.15, 1));
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.92, metalness: 0,
    }));
    mesh.position.set(cx, 0, cz);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.groundMeshes.push(mesh);
    this.shores.push({ x: cx, z: cz, rx, rz });
  }

  private addPlatform(x: number, yTop: number, z: number, w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(0.12, h * 0.25)), mat);
    mesh.position.set(x, yTop - h / 2, z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this.group.add(mesh);
    this.groundMeshes.push(mesh);
    return mesh;
  }

  /** Hub central: playa grande con aldea al sur y vistas a los 3 caminos. */
  private buildHub(): void {
    this.addIsland(0, 0, 17, 15, 1, 0x58b368, 1.7);
    this.checkpoints.push(new THREE.Vector3(0, 1, 8)); // spawn

    // Aldea pastel (zona segura)
    this.addHouse(-5, 1, 9, 0xf2917e, 0.4);
    this.addHouse(5, 1, 9.5, 0x8fd6cf, -0.4);
    this.addHouse(9.5, 1, 5, 0xf5e6c4, -0.9);

    // Calzadas que marcan los 3 caminos desde el spawn
    this.addRoad(0, 8, 0, -12, 1.05);          // norte → faro
    this.addRoadX(-2, -14, -1, 1.05);          // oeste → playa de combate
    this.addRoadX(2, 14, -2, 1.05);            // este → ruinas

    // Puentes a las islas laterales
    this.addPlatform(-16.5, 1, -2, 5, 0.5, 3, this.matWood);
    this.addPlatform(16.5, 1, -3, 5, 0.5, 3, this.matWood);

    // Escalones de subida al acantilado del faro
    this.addPlatform(0, 2, -14.8, 7, 2, 3.2, this.matRock);
    this.addPlatform(0, 3, -17.5, 7, 2, 3, this.matRock);
  }

  /** El Faro del Alba: visible desde todo el nivel, con ruta en espiral. */
  private buildFaro(): void {
    // Promontorio verde del faro (esculpido, se puede subir por la ladera)
    this.addIsland(0, -24, 10.5, 9, 4, 0x58b368, 4.2);
    this.checkpoints.push(new THREE.Vector3(0, 4, -19));

    // Torre del faro (cuerpo + franjas + cabina)
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.6, 11, 28), this.matStone);
    tower.position.set(0, 9.5, -26);
    tower.castShadow = true;
    this.group.add(tower);
    this.obstacles.push({ position: new THREE.Vector3(0, 4, -26), radius: 2.35 });
    for (const y of [6.5, 9.5, 12.5]) {
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(2.32 - (y - 6.5) * 0.06, 2.36 - (y - 6.5) * 0.06, 0.7, 12),
        new THREE.MeshStandardMaterial({ color: 0x2aa6a0 }));
      stripe.position.set(0, y, -26);
      this.group.add(stripe);
    }
    // Plataforma superior (se puede pisar)
    const top = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.5, 12), this.matStone);
    top.position.set(0, 15.25, -26);
    this.group.add(top);
    this.groundMeshes.push(top);

    // Cristal del faro (se enciende al activarlo)
    this.faroCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.9),
      new THREE.MeshStandardMaterial({ color: 0x9fb8c8, emissive: 0x223344, emissiveIntensity: 0.3 }),
    );
    this.faroCrystal.position.set(0, 16.6, -26);
    this.group.add(this.faroCrystal);

    // Haz de luz (oculto hasta la activación)
    this.faroBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 1.4, 30, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.0, side: THREE.DoubleSide }),
    );
    this.faroBeam.position.set(0, 30, -26);
    this.group.add(this.faroBeam);

    // Pedestal de activación con 3 huecos para Destellos
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 0.6, 8), this.matStone);
    pedestal.position.set(0, 4.3, -19.5);
    this.group.add(pedestal);
    this.groundMeshes.push(pedestal);
    for (let i = 0; i < 3; i++) {
      const socket = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.16),
        new THREE.MeshStandardMaterial({ color: 0x6a6052 }),
      );
      const a = (i / 3) * Math.PI * 2;
      socket.position.set(Math.cos(a) * 0.55, 4.72, -19.5 + Math.sin(a) * 0.55);
      socket.name = `socket_${i}`;
      this.group.add(socket);
    }

    // Ruta vertical: plataformas en espiral alrededor de la torre
    const spiral: [number, number, number][] = [
      [0, 5.2, -21.6], [3.1, 6.5, -23], [4.3, 7.8, -26], [3.1, 9.1, -29],
      [0, 10.4, -30.4], [-3.1, 11.7, -29], [-4.3, 13, -26], [-3.1, 14.2, -23],
    ];
    for (const [x, y, z] of spiral) {
      this.addPlatform(x, y, z, 2.6, 0.6, 2.6, this.matRock);
    }

    // Cascada y puerta sellada de la Cueva Azul (visible, aún inaccesible)
    const fall = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 6.5),
      new THREE.MeshBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    fall.position.set(9.2, 3.6, -22);
    fall.rotation.y = Math.PI / 2;
    this.group.add(fall);
    const door = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 1.3, 0.25, 10),
      new THREE.MeshStandardMaterial({ color: 0x2a3a52, emissive: 0x102040, emissiveIntensity: 0.5 }),
    );
    door.rotation.z = Math.PI / 2;
    door.position.set(9.4, 1.6, -22);
    this.group.add(door);
    this.triggers.push({ id: 'cueva', position: new THREE.Vector3(10.5, 1, -22), radius: 3.2 });
  }

  /** Playa oeste: arena de combate del Caracoral con las 3 rocas corruptas. */
  private buildWestZone(): void {
    this.addIsland(-26, -4, 11, 10, 0.8, 0xeed3a0, 8.9);
    this.checkpoints.push(new THREE.Vector3(-21, 0.8, -2));

    // Rocas corruptas de Noxia (solo la embestida del Caracoral las rompe)
    for (const [x, z] of [[-32, -9], [-21, -10.5], [-31.5, 2]] as const) {
      const rockGroup = new THREE.Group();
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 1), this.matNoxia);
      rock.position.y = 0.9;
      rock.rotation.set(Math.random(), Math.random(), 0);
      rock.castShadow = true;
      rockGroup.add(rock);
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), this.matNoxia);
      shard.position.set(0.5, 1.7, 0.2);
      rockGroup.add(shard);
      rockGroup.position.set(x, 0.8, z);
      this.group.add(rockGroup);
      this.corruptRocks.push({ mesh: rockGroup, position: new THREE.Vector3(x, 0.8, z), broken: false });
    }
  }

  /** Ruinas del este: el terreno de juego del olfato de Oryn. */
  private buildEastZone(): void {
    this.addIsland(26, -6, 10, 9, 1.2, 0x58b368, 13.4);
    this.checkpoints.push(new THREE.Vector3(21, 1.2, -4));

    // Ruinas antiguas
    this.addColumn(23, 1.2, -2, 2.2, false);
    this.addColumn(29, 1.2, -1.5, 1.4, true);
    this.addColumn(24, 1.2, -10, 1.8, true);
    this.addColumn(32, 1.2, -4, 2.4, false);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 0.6), this.matStone);
    lintel.position.set(26, 3.1, -1.8);
    lintel.rotation.z = 0.22;
    this.group.add(lintel);

    // Montículo donde está enterrada la reliquia (lo detecta Oryn)
    this.mound = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xc9a96e }),
    );
    this.mound.scale.y = 0.45;
    this.mound.position.copy(this.moundPos);
    this.group.add(this.mound);

    // Reliquia oculta (emerge al excavar)
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

  /** Santuarios y NPCs del hub: corazones, Quiríes y desafío dormido. */
  private buildShrines(): void {
    // Santuario de corazones: los Lumas son moneda (10 = curación total)
    const heartBase = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.5, 8), this.matStone);
    heartBase.position.set(8, 1.25, 9.5);
    this.group.add(heartBase);
    const heart = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xff6b8a, emissive: 0xa01030, emissiveIntensity: 0.6 }),
    );
    heart.position.set(8, 1.9, 9.5);
    heart.name = 'heartIcon';
    this.group.add(heart);
    this.triggers.push({ id: 'corazones', position: new THREE.Vector3(8, 1, 9.5), radius: 2 });
    this.obstacles.push({ position: new THREE.Vector3(8, 1, 9.5), radius: 0.9 });

    // Los Quiríes (su misión de las 5 notas llega en la próxima versión)
    const grove = new THREE.Vector3(10.5, 1, 3.5);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 1), this.matRock);
    rock.position.set(grove.x, 1.5, grove.z);
    this.group.add(rock);
    this.obstacles.push({ position: grove.clone(), radius: 0.9 });
    this.buildQuiriesAt([
      [grove.x - 0.4, 2.2, grove.z + 0.3], [grove.x + 0.5, 2.1, grove.z], [grove.x, 2.4, grove.z - 0.4],
    ]);
    this.triggers.push({ id: 'quiries', position: grove.clone(), radius: 2.8 });

    // Santuario del Desafío de Mael (dormido por ahora)
    const shrine = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 1.2, 6), this.matStone);
    shrine.position.set(-11, 1.6, 6);
    this.group.add(shrine);
    const dimCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.35),
      new THREE.MeshStandardMaterial({ color: 0x8a93a8, emissive: 0x202838, emissiveIntensity: 0.4 }),
    );
    dimCrystal.position.set(-11, 2.6, 6);
    this.group.add(dimCrystal);
    this.triggers.push({ id: 'desafio', position: new THREE.Vector3(-11, 1, 6), radius: 2.5 });
    this.obstacles.push({ position: new THREE.Vector3(-11, 1, 6), radius: 1.1 });
  }

  private buildPads(): void {
    // Atajo del hub al acantilado del faro + rebote en la playa oeste
    this.addPad(4.5, 1, -11.5, 15);
    this.addPad(-19, 0.8, 2, 12);
  }

  private addPad(x: number, yGround: number, z: number, power: number): void {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.0, 0.25, 10), this.matStone);
    base.position.set(x, yGround + 0.12, z);
    this.group.add(base);
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 0.18, 10),
      new THREE.MeshStandardMaterial({ color: 0x2ec4b6, emissive: 0x18887e, emissiveIntensity: 0.7 }),
    );
    top.position.set(x, yGround + 0.32, z);
    this.group.add(top);
    this.pads.push({ position: new THREE.Vector3(x, yGround + 0.35, z), power, mesh: top });
  }

  // ------------------------------------------------------------------
  // Eventos del mundo (purificación, excavación, faro)
  // ------------------------------------------------------------------

  /** Purifica la playa oeste: flores, brillos y color de vuelta. */
  purifyWestZone(): void {
    const flowers: [number, number][] = [
      [-30, -8], [-23, -9], [-29, 1], [-22, 2], [-26, -1], [-32, -4], [-20, -5],
    ];
    const mats = [0xf2917e, 0xffd34d, 0xe85a8a].map(
      (c) => new THREE.MeshStandardMaterial({ color: c }),
    );
    flowers.forEach(([x, z], i) => {
      const flower = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), mats[i % 3]);
      flower.position.set(x, 0.92, z);
      this.group.add(flower);
    });
    for (const [x, z] of [[-30, -6], [-22, -7], [-28, 1]] as const) {
      const glimmer = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0x6fffe0, transparent: true, opacity: 0.6 }),
      );
      glimmer.position.set(x, 1.1, z);
      this.group.add(glimmer);
      this.glimmers.push({ mesh: glimmer, phase: Math.random() * Math.PI * 2 });
    }
  }

  /** Excava el montículo: la reliquia emerge con una pequeña animación. */
  digMound(): void {
    this.mound.visible = false;
    this.relic.visible = true;
    this.relicRise = 0;
  }

  get moundDug(): boolean {
    return !this.mound.visible;
  }

  /** Enciende el Faro del Alba: cristal dorado + haz hacia el cielo. */
  activateFaro(): void {
    this.faroActivated = true;
    const mat = this.faroCrystal.material as THREE.MeshStandardMaterial;
    mat.color.set(0xffe9a0);
    mat.emissive.set(0xffaa00);
    mat.emissiveIntensity = 1.4;
  }

  // ------------------------------------------------------------------
  // Decoración y ambiente (agua, vista, árboles, lumas…)
  // ------------------------------------------------------------------

  private buildWater(): void {
    // Mar con shader: gradiente de profundidad, fresnel, caustics y espuma
    // en la orilla de cada isla (ver WaterSurface.ts)
    this.water2 = new WaterSurface(this.group as unknown as THREE.Scene, this.shores, new THREE.Vector3(18, 35, -10));
  }

  /** Fondo escénico: ciudad-acantilado lejana, farallones y veleros. */
  private buildVista(): void {
    const cliffMat = new THREE.MeshStandardMaterial({ color: 0xd8c9a8 });
    const topMat = new THREE.MeshStandardMaterial({ color: 0x58b368 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xc96f4a });

    const cliffs: [number, number, number, number][] = [
      [46, -20, 14, 10], [50, -38, 18, 12], [44, -55, 12, 9],
      [-48, -25, 11, 10], [-52, -45, 16, 12],
      [10, -55, 15, 12], [-12, -52, 12, 10],
    ];
    for (const [x, z, h, w] of cliffs) {
      const cliff = new THREE.Mesh(new THREE.BoxGeometry(w, h, 10), cliffMat);
      cliff.position.set(x, h / 2 - 1, z);
      cliff.rotation.y = (Math.random() - 0.5) * 0.3;
      this.group.add(cliff);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, 0.8, 9.5), topMat);
      cap.position.set(x, h - 0.6, z);
      cap.rotation.y = cliff.rotation.y;
      this.group.add(cap);
    }
    // Torres lejanas de la ciudad antigua
    for (const [x, z, baseY, r] of [[50, -38, 18, 1.3], [47.5, -40, 18, 0.9], [10, -55, 15, 1.2], [12.8, -53, 15, 0.8]] as const) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, 3.4, 7), this.matStone);
      tower.position.set(x, baseY + 1.4, z);
      this.group.add(tower);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(r * 1.15, 1.7, 7), roofMat);
      roof.position.set(x, baseY + 3.9, z);
      this.group.add(roof);
    }
    // Veleros
    const sailMat = new THREE.MeshStandardMaterial({ color: 0xfdf6e0, side: THREE.DoubleSide });
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
    for (const [x, z, rot] of [[-38, 14, 0.6], [40, 10, -0.8], [0, -45, 2.4]] as const) {
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
    const house = new THREE.Group();
    const wall = new THREE.MeshStandardMaterial({ color: wallColor });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.5, 1.6), wall);
    body.position.y = 0.75;
    body.castShadow = true;
    house.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.9, 4),
      new THREE.MeshStandardMaterial({ color: 0xc96f4a }));
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
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, height, 7), this.matStone);
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
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.26 * scale, 1.8 * scale, 6), this.matTrunk);
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
    // Hub
    this.addTree(-12, 1, 6, 1.2);
    this.addTree(13, 1, 0.5, 1.0);
    this.addTree(-13, 1, -6, 0.9);
    this.addTree(-7, 1, -9.5, 1.1);
    this.addTree(11, 1, -8, 0.95);
    // Oeste
    this.addTree(-25, 0.8, 2.5, 0.9);
    // Este
    this.addTree(20, 1.2, -11, 1.0);
    this.addTree(33, 1.2, 0, 0.85);
    // Acantilado del faro
    this.addTree(-5, 4, -27, 1.15);
    this.addTree(5.2, 4, -27.5, 0.9);
    // Estandartes marcando los caminos
    this.addBanner(-1.8, 1, -6.5, 0x2ec4b6);
    this.addBanner(1.8, 1, -6.5, 0xffd34d);
    this.addBanner(-14.5, 1, -0.2, 0x2ec4b6);
    this.addBanner(14.5, 1, -3.8, 0xffd34d);
    // Flores del hub
    const flowerMats = [0xf2917e, 0xffd34d, 0xe85a8a].map(
      (c) => new THREE.MeshStandardMaterial({ color: c }));
    const spots: [number, number][] = [
      [-3, 4], [4, 2], [-8, 1], [7, -3], [-4, -7], [10, 7], [-9, 8], [2, -10],
    ];
    spots.forEach(([x, z], i) => {
      const flower = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), flowerMats[i % 3]);
      flower.position.set(x, 1.1, z);
      this.group.add(flower);
    });
  }

  private addBanner(x: number, yGround: number, z: number, color: number): void {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5), this.matTrunk);
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
    for (const [x, z] of [[18, 8], [-18, 9], [-36, -4], [36, -7], [12, -16], [-12, -15]] as const) {
      const glimmer = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), mat.clone());
      glimmer.position.set(x, 0.25, z);
      this.group.add(glimmer);
      this.glimmers.push({ mesh: glimmer, phase: Math.random() * Math.PI * 2 });
    }
  }

  private buildCrates(): void {
    this.addCrate(-12, 1, 2);
    this.addCrate(-29, 0.8, -1);
    this.addCrate(28, 1.2, -3);
    this.addCrate(-5, 4, -21);
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

  /** Lumas repartidos por todos los caminos: guían y recompensan, no mandan. */
  private placeLumas(): void {
    const add = (x: number, y: number, z: number) => this.crystalPositions.push(new THREE.Vector3(x, y, z));
    // Hub: arcos sobre los 3 caminos
    add(0, 2, 5); add(0, 2, 2); add(0, 2, -2); add(0, 2, -6);
    add(-5, 2, -1); add(-9, 2, -1); add(-13, 2, -1.5);
    add(5, 2, -2); add(9, 2, -2); add(13, 2, -2.5);
    // Puentes
    add(-16.5, 2.2, -2); add(16.5, 2.2, -3);
    // Oeste (anillo alrededor de la arena del Caracoral)
    add(-22, 1.8, 1); add(-30, 1.8, 1.5); add(-33, 1.8, -5); add(-27, 1.8, -10); add(-20, 1.8, -7);
    // Este (entre las ruinas)
    add(22, 2.2, -2); add(27, 2.2, -1); add(31, 2.2, -6); add(25, 2.2, -10); add(21, 2.2, -8);
    // Subida al faro y espiral
    add(0, 3, -14.8); add(0, 4.2, -17.5);
    add(0, 6.2, -21.6); add(3.1, 7.5, -23); add(4.3, 8.8, -26); add(3.1, 10.1, -29);
    add(0, 11.4, -30.4); add(-3.1, 12.7, -29); add(-4.3, 14, -26); add(-3.1, 15.2, -23);
    // Cima del faro
    add(1.2, 16.4, -26); add(-1.2, 16.4, -26);
    // Cerca de la cascada (pista de la Cueva Azul)
    add(10.5, 1.8, -19); add(10.5, 1.8, -25);
  }

  private placeEnemies(): void {
    const def = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) =>
      this.enemyDefs.push({ pointA: new THREE.Vector3(ax, ay, az), pointB: new THREE.Vector3(bx, by, bz) });
    def(-4, 1, -10, 4, 1, -10);          // guardia del camino norte
    def(-24, 0.8, -8, -28, 0.8, 0);      // playa oeste 1
    def(-31, 0.8, -2, -23, 0.8, -3);     // playa oeste 2
    def(22, 1.2, -9, 30, 1.2, -7);       // ruinas este
    def(-4.5, 4, -20.5, 4.5, 4, -20.5);  // promontorio del faro 1
    def(4, 4, -27.5, -4, 4, -27.5);      // promontorio del faro 2
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
    // Trampolines: latido sutil para que se lean como interactivos
    for (const pad of this.pads) {
      pad.mesh.position.y = pad.position.y - 0.03 + Math.sin(this.time * 3) * 0.04;
    }
    // Reliquia emergiendo del montículo
    if (this.relicRise >= 0 && this.relicRise < 1) {
      this.relicRise += dt * 1.2;
      const t = Math.min(this.relicRise, 1);
      this.relic.position.y = this.moundPos.y - 0.8 + t * 1.0;
      this.relic.rotation.y += dt * 3;
    }
    // Cristal del faro y haz tras la activación
    if (this.faroActivated) {
      this.faroCrystal.rotation.y += dt * 2;
      const beamMat = this.faroBeam.material as THREE.MeshBasicMaterial;
      beamMat.opacity = Math.min(beamMat.opacity + dt * 0.3, 0.45) + Math.sin(this.time * 3) * 0.05;
    } else {
      this.faroCrystal.rotation.y += dt * 0.3;
    }
  }
}
