import * as THREE from 'three';

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

/** Caja rompible que suelta cristales al romperse. */
export interface Crate {
  mesh: THREE.Mesh;
  obstacle: Obstacle;
  broken: boolean;
}

/**
 * LevelManager — "Costa Brillante" (Isla Auria)
 * -----------------------------------------------
 * Construye el primer nivel completo de la isla: zona inicial segura con
 * casitas costeras pastel, camino principal con calzada de piedra antigua,
 * puentes, plataformas flotantes, isla central con zona elevada de
 * recompensa, ruinas antiguas, Quiríes cantores, mar turquesa con destellos
 * bioluminiscentes y la meta (tótem-portal de energía). Todo low-poly
 * estilizado y generado por código: cada pieza es un placeholder
 * reemplazable por arte final (ver ART_DIRECTION.md).
 */
export class LevelManager {
  readonly group = new THREE.Group();
  /** Mallas sobre las que el jugador puede caminar (para el raycast de suelo). */
  readonly groundMeshes: THREE.Mesh[] = [];
  /** Colisiones laterales simples. */
  readonly obstacles: Obstacle[] = [];
  readonly crates: Crate[] = [];
  readonly crystalPositions: THREE.Vector3[] = [];
  readonly enemyDefs: EnemyDef[] = [];
  /** Puntos de respawn; el jugador conserva el último que pisó. */
  readonly checkpoints: THREE.Vector3[] = [];
  /** Donde el GoalPortal coloca el tótem de meta. */
  readonly goalPosition = new THREE.Vector3(0, 1.5, -64);
  /** Altura por debajo de la cual el jugador "cae del mapa". */
  readonly killY = -2;

  private water!: THREE.Mesh;
  private time = 0;
  /** Criaturas cantoras decorativas (pulsan con el ambiente). */
  private quiries: { mesh: THREE.Group; phase: number }[] = [];
  /** Destellos bioluminiscentes en la orilla. */
  private glimmers: { mesh: THREE.Mesh; phase: number }[] = [];

  // Materiales compartidos (low-poly con flatShading).
  // Paleta caribeña de Isla Auria: verde palmera, arena cálida, piedra
  // crema, terracota y turquesa (ver src/game/ART_DIRECTION.md).
  private matGrass = new THREE.MeshStandardMaterial({ color: 0x58b368, flatShading: true });
  private matSand = new THREE.MeshStandardMaterial({ color: 0xeed3a0, flatShading: true });
  private matWood = new THREE.MeshStandardMaterial({ color: 0xb07a5a, flatShading: true });
  private matRock = new THREE.MeshStandardMaterial({ color: 0xb3ab98, flatShading: true });
  private matTrunk = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, flatShading: true });
  private matLeaf = new THREE.MeshStandardMaterial({ color: 0x2fa05e, flatShading: true });
  private matCrate = new THREE.MeshStandardMaterial({ color: 0xc96f4a, flatShading: true });
  private matStone = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, flatShading: true });

  constructor(scene: THREE.Scene) {
    this.buildIslands();
    this.buildWater();
    this.buildDecorations();
    this.buildVillage();
    this.buildRoads();
    this.buildRuins();
    this.buildCrates();
    this.buildQuiries();
    this.buildGlimmers();
    this.placeCrystals();
    this.placeEnemies();
    scene.add(this.group);
  }

  /** Crea una plataforma tipo caja. yTop = altura de la cara superior. */
  private addPlatform(x: number, yTop: number, z: number, w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, yTop - h / 2, z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this.group.add(mesh);
    this.groundMeshes.push(mesh);
    return mesh;
  }

  private buildIslands(): void {
    // 1. Isla inicial (zona segura)
    this.addPlatform(0, 1, 0, 14, 3, 14, this.matGrass);
    this.addPlatform(0, 0.4, 0, 16, 1.4, 16, this.matSand); // borde de arena
    this.checkpoints.push(new THREE.Vector3(0, 1, 2));

    // 2. Puente de madera hacia la segunda isla
    this.addPlatform(0, 1, -10.5, 3, 0.5, 8, this.matWood);

    // 3. Segunda isla (primer encuentro con enemigos y cajas)
    this.addPlatform(0, 1, -18, 10, 3, 10, this.matGrass);
    this.checkpoints.push(new THREE.Vector3(0, 1, -18));

    // 4. Plataformas flotantes (secuencia de saltos ascendente)
    this.addPlatform(3, 2, -27, 3.2, 0.8, 3.2, this.matRock);
    this.addPlatform(-2, 3, -31.5, 3.2, 0.8, 3.2, this.matRock);
    this.addPlatform(2, 4, -36, 3.2, 0.8, 3.2, this.matRock);

    // 5. Isla central (la más grande)
    this.addPlatform(0, 2, -44, 13, 4, 13, this.matGrass);
    this.addPlatform(0, 1.2, -44, 15, 1.4, 15, this.matSand);
    this.checkpoints.push(new THREE.Vector3(0, 2, -41));

    // 6. Zona elevada con recompensa (escalones al oeste de la isla central)
    this.addPlatform(-5, 3.2, -47, 2.6, 0.7, 2.6, this.matRock);
    this.addPlatform(-5, 4.4, -43.5, 2.6, 0.7, 2.6, this.matRock);
    this.addPlatform(-5, 5.6, -40, 3.6, 0.7, 3.6, this.matRock);

    // 7. Puente final hacia la isla de la meta
    this.addPlatform(0, 2, -53.5, 3, 0.5, 7, this.matWood);

    // 8. Isla de la meta
    this.addPlatform(0, 1.5, -62, 12, 3, 11, this.matGrass);
    this.checkpoints.push(new THREE.Vector3(0, 1.5, -58));
  }

  private buildWater(): void {
    // Mar turquesa caribeño
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2ec4b6,
      transparent: true,
      opacity: 0.82,
      flatShading: true,
    });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(300, 300, 24, 24), mat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 0.1;
    this.group.add(this.water);
  }

  /** Árbol estilizado: tronco + copa de esferas low-poly. */
  private addTree(x: number, yGround: number, z: number, scale = 1): void {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.26 * scale, 1.8 * scale, 6), this.matTrunk);
    trunk.position.y = 0.9 * scale;
    trunk.castShadow = true;
    tree.add(trunk);
    const blobGeo = new THREE.IcosahedronGeometry(0.75 * scale, 0);
    const offsets = [
      [0, 2.1, 0], [0.5, 1.8, 0.3], [-0.5, 1.85, -0.2], [0.1, 1.75, -0.5],
    ];
    for (const [ox, oy, oz] of offsets) {
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
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55 * scale, 0), this.matRock);
    rock.position.set(x, yGround + 0.3 * scale, z);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    rock.castShadow = true;
    this.group.add(rock);
    this.obstacles.push({ position: new THREE.Vector3(x, yGround, z), radius: 0.55 * scale });
  }

  private buildDecorations(): void {
    // Isla inicial
    this.addTree(-5, 1, 4, 1.2);
    this.addTree(5, 1, 3.5);
    this.addTree(-4.5, 1, -3.5, 0.9);
    this.addRock(5.2, 1, -3.8);
    this.addRock(-2.5, 1, 5.2, 0.8);
    // Segunda isla
    this.addTree(-3.6, 1, -15.5, 0.9);
    this.addRock(3.8, 1, -21.2);
    // Isla central
    this.addTree(4.5, 2, -40, 1.3);
    this.addTree(-4, 2, -49.5);
    this.addTree(5, 2, -48.5, 0.85);
    this.addRock(-1.5, 2, -49.8);
    // Isla de la meta
    this.addTree(-4.4, 1.5, -64.5, 1.1);
    this.addTree(4.4, 1.5, -65, 0.9);
    this.addRock(-4.2, 1.5, -59);
  }

  /** Casita costera pastel con techo de terracota (energía de pueblito isleño). */
  private addHouse(x: number, yGround: number, z: number, wallColor: number, rotY = 0): void {
    const house = new THREE.Group();
    const wall = new THREE.MeshStandardMaterial({ color: wallColor, flatShading: true });
    const roof = new THREE.MeshStandardMaterial({ color: 0xc96f4a, flatShading: true });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.5, 1.6), wall);
    body.position.y = 0.75;
    body.castShadow = true;
    house.add(body);

    // Techo a cuatro aguas (cono de 4 lados girado 45°)
    const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.9, 4), roof);
    roofMesh.position.y = 1.95;
    roofMesh.rotation.y = Math.PI / 4;
    roofMesh.castShadow = true;
    house.add(roofMesh);

    // Puerta y ventana (lectura clara a distancia)
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.8, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x7a4a2e, flatShading: true }),
    );
    door.position.set(0, 0.4, 0.83);
    house.add(door);
    const window1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x4090a8, emissiveIntensity: 0.4 }),
    );
    window1.position.set(0.55, 0.85, 0.83);
    house.add(window1);

    house.position.set(x, yGround, z);
    house.rotation.y = rotY;
    this.group.add(house);
    this.obstacles.push({ position: new THREE.Vector3(x, yGround, z), radius: 1.25 });
  }

  /** Mini-aldea en la zona segura: el sabor de pueblo costero de Isla Auria. */
  private buildVillage(): void {
    this.addHouse(-4.6, 1, 0.2, 0xf2917e, 0.5);   // coral
    this.addHouse(4.8, 1, 0.6, 0x8fd6cf, -0.5);   // turquesa pastel
    this.addHouse(2.2, 1, 5.2, 0xf5e6c4, 0.15);   // crema
  }

  /** Calzada de piedra antigua que marca el camino principal. */
  private buildRoads(): void {
    const tileGeo = new THREE.BoxGeometry(1.3, 0.08, 1.0);
    const segments: [number, number, number, number][] = [
      [0, 4.5, 1.05, -6.5],   // isla inicial → puente
      [0, -14.5, 1.05, -22],  // segunda isla
      [0, -38.5, 2.05, -49],  // isla central
      [0, -57.5, 1.55, -61],  // isla de la meta → tótem
    ];
    for (const [x, z0, yTop, z1] of segments) {
      for (let z = z0; z >= z1; z -= 1.25) {
        const tile = new THREE.Mesh(tileGeo, this.matStone);
        // Ligeras variaciones para que parezca empedrado a mano
        tile.position.set(x + (Math.random() - 0.5) * 0.15, yTop + 0.02, z);
        tile.rotation.y = (Math.random() - 0.5) * 0.2;
        tile.receiveShadow = true;
        this.group.add(tile);
      }
    }
  }

  /** Quiríes: pequeñas criaturas cantoras que brillan al anochecer isleño. */
  private buildQuiries(): void {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xffe28a, emissive: 0xc9962a, emissiveIntensity: 0.8, flatShading: true,
    });
    const spots: [number, number, number][] = [
      [-5.6, 2.6, 4.3], [5.4, 2.4, 3.0], [-4.2, 3.6, -49.9], [4.9, 3.8, -40.3], [-4.9, 3.4, -64.9],
    ];
    for (const [x, y, z] of spots) {
      const quiri = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 7), bodyMat);
      quiri.add(body);
      const beak = new THREE.Mesh(
        new THREE.ConeGeometry(0.035, 0.09, 5),
        new THREE.MeshStandardMaterial({ color: 0xc96f4a, flatShading: true }),
      );
      beak.position.set(0, 0, 0.12);
      beak.rotation.x = Math.PI / 2;
      quiri.add(beak);
      quiri.position.set(x, y, z);
      quiri.rotation.y = Math.random() * Math.PI * 2;
      this.group.add(quiri);
      this.quiries.push({ mesh: quiri, phase: Math.random() * Math.PI * 2 });
    }
  }

  /** Destellos bioluminiscentes en la orilla del mar. */
  private buildGlimmers(): void {
    const mat = new THREE.MeshBasicMaterial({ color: 0x6fffe0, transparent: true, opacity: 0.6 });
    const geo = new THREE.SphereGeometry(0.09, 6, 5);
    const spots: [number, number][] = [
      [8.4, 1.5], [-8.6, -2], [6, -21.5], [-6.2, -16], [8, -45], [-8.2, -42.5], [6.6, -63.5], [-6.4, -60],
    ];
    for (const [x, z] of spots) {
      const glimmer = new THREE.Mesh(geo, mat.clone());
      glimmer.position.set(x, 0.25, z);
      this.group.add(glimmer);
      this.glimmers.push({ mesh: glimmer, phase: Math.random() * Math.PI * 2 });
    }
  }

  /** Columna antigua (entera o rota) de las ruinas de Isla Auria. */
  private addColumn(x: number, yGround: number, z: number, height: number, broken: boolean): void {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, height, 7), this.matStone);
    col.position.set(x, yGround + height / 2, z);
    if (broken) col.rotation.z = 0.12; // ligeramente inclinada, abandono ancestral
    col.castShadow = true;
    this.group.add(col);
    if (!broken) {
      // Capitel con una gema de energía azul: la "magia antigua" de la isla
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 0.8), this.matStone);
      cap.position.set(x, yGround + height + 0.12, z);
      this.group.add(cap);
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.16),
        new THREE.MeshStandardMaterial({ color: 0x6fd8ff, emissive: 0x2090c0, emissiveIntensity: 1 }),
      );
      gem.position.set(x, yGround + height + 0.42, z);
      this.group.add(gem);
    }
    this.obstacles.push({ position: new THREE.Vector3(x, yGround, z), radius: 0.5 });
  }

  /** Pequeña ruina antigua: círculo de columnas alrededor de la meta + arco caído en la isla central. */
  private buildRuins(): void {
    // Anillo ceremonial alrededor del tótem de meta
    this.addColumn(-2.6, 1.5, -62.5, 2.6, false);
    this.addColumn(2.6, 1.5, -62.5, 2.6, false);
    this.addColumn(-2.2, 1.5, -65.5, 1.4, true);
    this.addColumn(2.2, 1.5, -65.5, 2.0, true);
    // Resto de arco caído en la isla central (invita a explorar)
    this.addColumn(-2.5, 2, -47.5, 1.2, true);
    this.addColumn(2, 2, -48.5, 1.8, true);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 0.6), this.matStone);
    lintel.position.set(0.2, 2.4, -48.2);
    lintel.rotation.z = 0.3; // dintel derrumbado a medias
    this.group.add(lintel);
  }

  private addCrate(x: number, yGround: number, z: number): void {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.matCrate);
    mesh.position.set(x, yGround + 0.5, z);
    mesh.castShadow = true;
    this.group.add(mesh);
    const obstacle: Obstacle = { position: new THREE.Vector3(x, yGround, z), radius: 0.7 };
    this.obstacles.push(obstacle);
    this.crates.push({ mesh, obstacle, broken: false });
  }

  private buildCrates(): void {
    this.addCrate(3, 1, -15);
    this.addCrate(-3, 1, -20.8);
    this.addCrate(4.2, 2, -46.5);
  }

  private placeCrystals(): void {
    const add = (x: number, y: number, z: number) => this.crystalPositions.push(new THREE.Vector3(x, y, z));
    // Isla inicial: arco de bienvenida
    add(2, 2, 3); add(0, 2.2, 4.2); add(-2, 2, 3);
    // Puente 1
    add(0, 2, -8); add(0, 2, -10.5); add(0, 2, -13);
    // Segunda isla
    add(3.5, 2, -17); add(-3.5, 2, -17); add(2.5, 2, -21.5); add(-2.5, 2, -21.5);
    // Plataformas flotantes (una encima de cada una + dos en el aire)
    add(3, 3.4, -27); add(-2, 4.4, -31.5); add(2, 5.4, -36);
    add(0.5, 3.6, -29.2); add(0, 4.6, -33.8);
    // Isla central
    add(3, 3, -42); add(-3, 3, -42); add(0, 3, -46); add(5, 3, -45); add(-2, 3, -39);
    // Zona elevada con recompensa: círculo de cristales en la cima
    add(-5, 4.4, -47); add(-5, 5.6, -43.5);
    add(-5.9, 6.9, -40); add(-4.1, 6.9, -40); add(-5, 6.9, -40.9); add(-5, 6.9, -39.1); add(-5, 7.4, -40);
    // Puente final
    add(0, 3, -52); add(0, 3, -55);
    // Isla de la meta y su ruina ceremonial
    add(3, 2.6, -60); add(-3, 2.6, -60);
    add(-2.6, 5.0, -62.5); add(2.6, 5.0, -62.5); // sobre las columnas intactas
    add(0.2, 3.6, -48.2); // sobre el arco caído de la isla central
  }

  /** Zonas de patrulla de los "Grubs" (las criaturas enemigas). */
  private placeEnemies(): void {
    const def = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) =>
      this.enemyDefs.push({ pointA: new THREE.Vector3(ax, ay, az), pointB: new THREE.Vector3(bx, by, bz) });
    def(-3, 1, -18, 3, 1, -18);          // segunda isla
    def(2, 2, -41, 2, 2, -47);           // isla central, patrulla norte-sur
    def(-3, 2, -45, 3, 2, -45);          // isla central, patrulla este-oeste
    def(-3, 1.5, -60.5, 3, 1.5, -60.5);  // isla de la meta
  }

  /**
   * Rompe las cajas dentro del radio de ataque.
   * Devuelve las posiciones de las cajas rotas (para soltar cristales).
   */
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

  /** Animaciones ambientales: vaivén del agua, Quiríes y bioluminiscencia. */
  update(dt: number): void {
    this.time += dt;
    this.water.position.y = 0.1 + Math.sin(this.time * 0.8) * 0.05;
    // Los Quiríes "cantan": pequeño pulso de escala con su propia fase
    for (const q of this.quiries) {
      const s = 1 + Math.sin(this.time * 5 + q.phase) * 0.12;
      q.mesh.scale.setScalar(s);
    }
    // Las luces de la orilla respiran lentamente
    for (const g of this.glimmers) {
      (g.mesh.material as THREE.MeshBasicMaterial).opacity = 0.35 + (Math.sin(this.time * 1.6 + g.phase) + 1) * 0.2;
      g.mesh.position.y = 0.25 + Math.sin(this.time * 1.2 + g.phase) * 0.08;
    }
  }
}
