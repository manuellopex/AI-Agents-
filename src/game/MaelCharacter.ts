import * as THREE from 'three';

/** Estado de gameplay que el personaje traduce a poses. */
export interface MaelPose {
  speed: number;
  grounded: boolean;
  velocityY: number;
  attacking: boolean;
  attackKind: 'spin' | 'punch' | 'pound';
  pounding: boolean;
}

/**
 * MaelCharacter — modelo fiel a la hoja de personaje (turnaround oficial)
 * ------------------------------------------------------------------------
 * Proporciones del concepto (~5,5 cabezas, no chibi), construido por
 * piezas articuladas:
 *  - Pelo castaño chocolate voluminoso en puntas, flequillo y patillas
 *  - Ojos grandes marrones con cejas gruesas y sonrisa
 *  - Túnica crema sin mangas con cuello en V teal y camiseta interior
 *  - Capucha-capa triangular teal con ribete dorado colgando en la espalda
 *  - Faja teal con panel lateral (triángulos dorados) + cinturón de cuero
 *  - Artefacto circular de Auralis (aro dorado, espiral teal emisiva) en
 *    la cadera izquierda delantera
 *  - Colgante teal, brazaletes con borde dorado, bandas en los bíceps
 *  - Bombachos crema recogidos bajo la rodilla, espinillas vendadas y
 *    sandalias de tiras
 *
 * Articulación real: caderas + rodillas y hombros + codos, animados por
 * estado de juego (carrera con flexión de rodilla, salto, giro, golpe,
 * ground pound, idle con respiración).
 */
export class MaelCharacter {
  readonly root = new THREE.Group();

  // Pivotes articulados
  private thighL!: THREE.Group; private kneeL!: THREE.Group;
  private thighR!: THREE.Group; private kneeR!: THREE.Group;
  private shoulderL!: THREE.Group; private elbowL!: THREE.Group;
  private shoulderR!: THREE.Group; private elbowR!: THREE.Group;
  private head!: THREE.Group;
  private torso!: THREE.Group;
  private hood!: THREE.Group;

  private runPhase = 0;
  private time = 0;

  // Paleta exacta de los swatches de la hoja
  private skin = new THREE.MeshStandardMaterial({ color: 0xdf9c63, roughness: 0.7 });
  private hair = new THREE.MeshStandardMaterial({ color: 0x271811, roughness: 0.85 });
  private cream = new THREE.MeshStandardMaterial({ color: 0xf0e2c4, roughness: 0.8 });
  private creamLight = new THREE.MeshStandardMaterial({ color: 0xfaf2dd, roughness: 0.85 });
  private teal = new THREE.MeshStandardMaterial({ color: 0x1d9b94, roughness: 0.65 });
  private tealDark = new THREE.MeshStandardMaterial({ color: 0x126b66, roughness: 0.7 });
  private gold = new THREE.MeshStandardMaterial({ color: 0xc89638, roughness: 0.35, metalness: 0.6 });
  private leather = new THREE.MeshStandardMaterial({ color: 0x5f4128, roughness: 0.85 });
  private leatherLight = new THREE.MeshStandardMaterial({ color: 0x8a6238, roughness: 0.8 });
  private auralis = new THREE.MeshStandardMaterial({
    color: 0x8df0e4, emissive: 0x1ecbcd, emissiveIntensity: 1.6, roughness: 0.3,
  });

  constructor() {
    this.buildLegs();
    this.buildTorso();
    this.buildArms();
    this.buildHead();
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
  }

  private mesh(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D,
    x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  }

  // ------------------------------------------------------------------
  // Piernas: cadera → bombacho → rodilla → espinilla vendada → sandalia
  // ------------------------------------------------------------------
  private buildLegs(): void {
    for (const side of [-1, 1]) {
      const thigh = new THREE.Group();
      thigh.position.set(0.085 * side, 0.84, 0);
      // Bombacho crema (volumen del muslo, recogido hacia la rodilla)
      const baggy = this.mesh(new THREE.CapsuleGeometry(0.095, 0.22, 6, 14), this.cream, thigh, 0, -0.16, 0);
      baggy.scale.set(1.12, 1, 1.05);
      // Puño del bombacho bajo la rodilla
      this.mesh(new THREE.CylinderGeometry(0.068, 0.075, 0.07, 12), this.cream, thigh, 0, -0.34, 0);

      const knee = new THREE.Group();
      knee.position.set(0, -0.38, 0);
      thigh.add(knee);
      // Espinilla con venda clara (la hoja muestra el tobillo envuelto)
      this.mesh(new THREE.CapsuleGeometry(0.048, 0.2, 6, 12), this.skin, knee, 0, -0.13, 0);
      this.mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.12, 10), this.creamLight, knee, 0, -0.26, 0);
      // Sandalia: suela + tiras de cuero cruzadas
      this.mesh(new THREE.BoxGeometry(0.115, 0.04, 0.24), this.leather, knee, 0, -0.435, 0.045);
      this.mesh(new THREE.BoxGeometry(0.1, 0.028, 0.04), this.leatherLight, knee, 0, -0.4, 0.1, 0.55);
      this.mesh(new THREE.BoxGeometry(0.1, 0.028, 0.035), this.leatherLight, knee, 0, -0.385, 0.02, -0.4);
      // Dedos (punta de piel asomando)
      this.mesh(new THREE.SphereGeometry(0.045, 8, 6), this.skin, knee, 0, -0.43, 0.15);

      if (side < 0) { this.thighL = thigh; this.kneeL = knee; }
      else { this.thighR = thigh; this.kneeR = knee; }
      this.root.add(thigh);
    }
  }

  // ------------------------------------------------------------------
  // Torso: túnica, faja, cinturón, artefacto, capucha-capa y colgante
  // ------------------------------------------------------------------
  private buildTorso(): void {
    this.torso = new THREE.Group();
    this.torso.position.y = 0.84;
    this.root.add(this.torso);

    // Túnica crema: pecho + falda corta acampanada sobre la cadera
    const chest = this.mesh(new THREE.CapsuleGeometry(0.155, 0.26, 8, 18), this.cream, this.torso, 0, 0.3, 0);
    chest.scale.set(1.15, 1, 0.92);
    this.mesh(new THREE.CylinderGeometry(0.175, 0.205, 0.16, 18), this.cream, this.torso, 0, 0.1, 0);
    // Camiseta interior clara asomando en el pecho
    this.mesh(new THREE.SphereGeometry(0.09, 12, 10), this.creamLight, this.torso, 0, 0.4, 0.1);

    // Cuello en V con ribete teal
    this.mesh(new THREE.BoxGeometry(0.035, 0.17, 0.015), this.teal, this.torso, -0.055, 0.44, 0.145, 0.18, 0, 0.45);
    this.mesh(new THREE.BoxGeometry(0.035, 0.17, 0.015), this.teal, this.torso, 0.055, 0.44, 0.145, 0.18, 0, -0.45);
    // Colgante: cordón + gema teal
    this.mesh(new THREE.SphereGeometry(0.02, 8, 8), this.auralis, this.torso, 0, 0.36, 0.15);

    // Faja teal ancha + cinturón de cuero por encima
    this.mesh(new THREE.CylinderGeometry(0.185, 0.2, 0.11, 18), this.teal, this.torso, 0, 0.04, 0);
    const belt = this.mesh(new THREE.TorusGeometry(0.185, 0.026, 8, 22), this.leather, this.torso, 0, 0.09, 0);
    belt.rotation.x = Math.PI / 2;
    this.mesh(new THREE.BoxGeometry(0.05, 0.045, 0.02), this.gold, this.torso, -0.04, 0.09, 0.185);

    // Panel lateral de la faja (cae sobre la pierna izquierda, con
    // ribete y triángulos dorados como en la hoja)
    const panel = new THREE.Group();
    panel.position.set(-0.12, -0.02, 0.1);
    panel.rotation.set(0.12, 0.45, 0.1);
    this.mesh(new THREE.BoxGeometry(0.15, 0.32, 0.018), this.teal, panel);
    this.mesh(new THREE.BoxGeometry(0.15, 0.035, 0.02), this.gold, panel, 0, -0.15, 0.001);
    for (const px of [-0.04, 0.03]) {
      this.mesh(new THREE.ConeGeometry(0.022, 0.04, 3), this.gold, panel, px, -0.085, 0.012, 0, 0, Math.PI);
    }
    this.torso.add(panel);
    // Segunda caída de tela más oscura detrás
    this.mesh(new THREE.BoxGeometry(0.1, 0.26, 0.015), this.tealDark, this.torso, -0.19, -0.06, -0.02, 0.05, 0.7, 0.15);

    // ARTEFACTO DE AURALIS: cadera delantera izquierda (como el detalle
    // ampliado de la hoja): aro dorado grueso, tachuelas, núcleo en
    // espiral teal brillante y colgantito inferior
    const artifact = new THREE.Group();
    artifact.position.set(-0.115, 0.07, 0.155);
    artifact.rotation.set(0.1, -0.35, 0);
    this.mesh(new THREE.TorusGeometry(0.072, 0.026, 10, 24), this.gold, artifact);
    this.mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.022, 18), this.auralis, artifact, 0, 0, 0, Math.PI / 2);
    // Espiral: cuentas que giran hacia el centro
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7;
      const r = 0.034 - i * 0.007;
      this.mesh(new THREE.SphereGeometry(0.011 - i * 0.0015, 8, 8), this.gold, artifact,
        Math.cos(a) * r, Math.sin(a) * r, 0.014);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.mesh(new THREE.SphereGeometry(0.013, 8, 8), this.gold, artifact,
        Math.cos(a) * 0.072, Math.sin(a) * 0.072, 0.01);
    }
    // Colgante que cuelga del artefacto
    this.mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6), this.gold, artifact, 0, -0.095, 0);
    this.mesh(new THREE.ConeGeometry(0.014, 0.035, 6), this.gold, artifact, 0, -0.13, 0, Math.PI);
    this.torso.add(artifact);

    // CAPUCHA-CAPA triangular en la espalda (vista trasera de la hoja):
    // panel teal en punta con ribete dorado
    this.hood = new THREE.Group();
    this.hood.position.set(0, 0.5, -0.13);
    // Cuello/capucha caída
    this.mesh(new THREE.TorusGeometry(0.105, 0.045, 10, 18), this.teal, this.hood, 0, 0.0, 0.02, 0.5);
    // Panel triangular (cono muy aplastado apuntando hacia abajo)
    const panelBack = this.mesh(new THREE.ConeGeometry(0.17, 0.42, 4), this.teal, this.hood, 0, -0.24, -0.02, Math.PI, Math.PI / 4);
    panelBack.scale.z = 0.16;
    const trim = this.mesh(new THREE.ConeGeometry(0.185, 0.45, 4), this.gold, this.hood, 0, -0.235, -0.028, Math.PI, Math.PI / 4);
    trim.scale.z = 0.1;
    this.torso.add(this.hood);
  }

  // ------------------------------------------------------------------
  // Brazos: hombro → bíceps con banda → codo → brazalete → mano
  // ------------------------------------------------------------------
  private buildArms(): void {
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(0.195 * side, 1.26, 0);
      // Hombro de la túnica (sin manga: la hoja muestra brazos al aire)
      this.mesh(new THREE.SphereGeometry(0.062, 12, 10), this.cream, shoulder, 0.005 * side, 0.01, 0);
      // Bíceps + banda teal
      this.mesh(new THREE.CapsuleGeometry(0.042, 0.14, 6, 12), this.skin, shoulder, 0.01 * side, -0.1, 0);
      this.mesh(new THREE.CylinderGeometry(0.048, 0.05, 0.045, 12), this.teal, shoulder, 0.01 * side, -0.06, 0);

      const elbow = new THREE.Group();
      elbow.position.set(0.012 * side, -0.19, 0);
      shoulder.add(elbow);
      // Antebrazo + brazalete grueso teal con bordes dorados
      this.mesh(new THREE.CapsuleGeometry(0.038, 0.1, 6, 12), this.skin, elbow, 0, -0.07, 0);
      this.mesh(new THREE.CylinderGeometry(0.058, 0.066, 0.115, 14), this.teal, elbow, 0, -0.15, 0);
      this.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.018, 14), this.gold, elbow, 0, -0.095, 0);
      this.mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.018, 14), this.gold, elbow, 0, -0.205, 0);
      // Mano
      this.mesh(new THREE.SphereGeometry(0.052, 12, 10), this.skin, elbow, 0, -0.26, 0);

      if (side < 0) { this.shoulderL = shoulder; this.elbowL = elbow; }
      else { this.shoulderR = shoulder; this.elbowR = elbow; }
      this.root.add(shoulder);
    }
  }

  // ------------------------------------------------------------------
  // Cabeza: proporción del concepto, ojos grandes, pelo voluminoso
  // ------------------------------------------------------------------
  private buildHead(): void {
    this.head = new THREE.Group();
    this.head.position.y = 1.52;
    this.root.add(this.head);

    // Cuello
    this.mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 12), this.skin, this.head, 0, -0.14, 0);
    const skull = this.mesh(new THREE.SphereGeometry(0.165, 24, 18), this.skin, this.head, 0, 0, 0);
    skull.scale.set(0.96, 1.04, 0.94);
    // Mandíbula suave
    this.mesh(new THREE.SphereGeometry(0.12, 16, 12), this.skin, this.head, 0, -0.07, 0.03);

    // Orejas
    for (const side of [-1, 1]) {
      this.mesh(new THREE.SphereGeometry(0.032, 10, 8), this.skin, this.head, 0.155 * side, -0.02, 0.01);
    }

    // Ojos grandes marrones (como el primer plano de la hoja)
    for (const side of [-1, 1]) {
      const white = this.mesh(new THREE.SphereGeometry(0.04, 14, 12),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }), this.head, 0.064 * side, -0.005, 0.135);
      white.scale.set(1, 1.3, 0.5);
      this.mesh(new THREE.SphereGeometry(0.026, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0x5a3217, roughness: 0.25 }), this.head, 0.064 * side, -0.005, 0.155);
      this.mesh(new THREE.SphereGeometry(0.012, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x120904 }), this.head, 0.064 * side, -0.005, 0.168);
      this.mesh(new THREE.SphereGeometry(0.006, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff }), this.head, 0.073 * side, 0.008, 0.171);
      // Cejas gruesas oscuras
      this.mesh(new THREE.BoxGeometry(0.062, 0.016, 0.014), this.hair, this.head,
        0.064 * side, 0.052, 0.15, 0, 0, -0.15 * side);
    }
    // Nariz pequeña y sonrisa amable
    this.mesh(new THREE.SphereGeometry(0.018, 8, 8), this.skin, this.head, 0, -0.045, 0.165);
    this.mesh(new THREE.TorusGeometry(0.022, 0.005, 6, 10, Math.PI * 0.7),
      new THREE.MeshBasicMaterial({ color: 0x7c4526 }), this.head, 0.005, -0.085, 0.152, 0, 0, Math.PI + 0.25);

    // PELO: masa voluminosa castaño chocolate con puntas hacia fuera/arriba
    const base = this.mesh(new THREE.SphereGeometry(0.175, 18, 14), this.hair, this.head, 0, 0.045, -0.02);
    base.scale.set(1.05, 0.98, 1.02);
    const tufts: [number, number, number, number, number, number, number][] = [
      // x, y, z, rotX, rotZ, radio, alto — leídos del turnaround
      [0, 0.19, -0.02, -0.25, 0, 0.075, 0.2],
      [0.085, 0.175, 0.0, -0.15, -0.65, 0.06, 0.17],
      [-0.085, 0.175, 0.0, -0.15, 0.65, 0.06, 0.17],
      [0.13, 0.12, -0.05, -0.45, -1.05, 0.055, 0.16],
      [-0.13, 0.12, -0.05, -0.45, 1.05, 0.055, 0.16],
      [0.05, 0.16, -0.12, -0.85, -0.35, 0.06, 0.18],
      [-0.05, 0.16, -0.12, -0.85, 0.35, 0.06, 0.18],
      [0, 0.1, -0.17, -1.35, 0, 0.055, 0.17],
      [0.1, 0.08, -0.15, -1.1, -0.8, 0.05, 0.15],
      [-0.1, 0.08, -0.15, -1.1, 0.8, 0.05, 0.15],
      // Flequillo desordenado sobre la frente
      [0.06, 0.12, 0.13, 0.75, -0.35, 0.042, 0.12],
      [-0.06, 0.12, 0.13, 0.75, 0.35, 0.042, 0.12],
      [0, 0.13, 0.145, 0.65, 0.05, 0.048, 0.13],
      [0.115, 0.09, 0.1, 0.55, -0.7, 0.038, 0.11],
      [-0.115, 0.09, 0.1, 0.55, 0.7, 0.038, 0.11],
    ];
    for (const [x, y, z, rx, rz, r, h] of tufts) {
      this.mesh(new THREE.ConeGeometry(r, h, 7), this.hair, this.head, x, y, z, rx, 0, rz);
    }
    // Patillas finas
    for (const side of [-1, 1]) {
      this.mesh(new THREE.ConeGeometry(0.026, 0.1, 6), this.hair, this.head,
        0.15 * side, -0.01, 0.05, Math.PI, 0, 0.1 * side);
    }
  }

  // ------------------------------------------------------------------
  // Animación procedural con rodillas y codos
  // ------------------------------------------------------------------
  update(dt: number, pose: MaelPose): void {
    this.time += dt;
    const lerp = (cur: number, target: number, k: number) =>
      cur + (target - cur) * Math.min(k * dt, 1);

    const runFactor = THREE.MathUtils.clamp(pose.speed / 7, 0, 1);
    this.runPhase += dt * (4 + pose.speed * 1.7);

    let thighSwingL = 0, thighSwingR = 0, kneeBendL = 0.05, kneeBendR = 0.05;
    let armSwingL = 0, armSwingR = 0, armLiftL = 0.08, armLiftR = -0.08;
    let elbowBendL = -0.25, elbowBendR = -0.25, headTilt = 0, hoodLift = 0;

    if (pose.attacking && pose.attackKind === 'spin') {
      armLiftL = 1.5; armLiftR = -1.5; elbowBendL = elbowBendR = -0.1;
    } else if (pose.attacking && pose.attackKind === 'punch') {
      armSwingR = -1.55; elbowBendR = -0.05;  // brazo derecho extendido
      armSwingL = 0.6; elbowBendL = -0.9;
      headTilt = 0.12;
    } else if (pose.pounding) {
      thighSwingL = thighSwingR = -1.0; kneeBendL = kneeBendR = 1.4;
      armLiftL = 0.4; armLiftR = -0.4; armSwingL = armSwingR = 0.5;
      headTilt = 0.35;
    } else if (!pose.grounded) {
      if (pose.velocityY > 1) {
        // Salto heroico: pierna delantera flexionada, brazos arriba
        thighSwingL = -1.0; kneeBendL = 1.2;
        thighSwingR = 0.45; kneeBendR = 0.25;
        armSwingL = 0.7; armSwingR = 0.7; armLiftL = 0.5; armLiftR = -0.5;
        elbowBendL = elbowBendR = -0.6;
        hoodLift = 0.5;
      } else {
        // Caída: brazos abiertos equilibrando, piernas semiflexionadas
        thighSwingL = -0.35; kneeBendL = 0.6;
        thighSwingR = 0.25; kneeBendR = 0.4;
        armLiftL = 1.0; armLiftR = -1.0; elbowBendL = elbowBendR = -0.3;
        headTilt = -0.12; hoodLift = 0.75;
      }
    } else if (runFactor > 0.05) {
      // Carrera con flexión natural de rodilla y codos doblados
      const swing = Math.sin(this.runPhase) * (0.5 + runFactor * 0.45);
      thighSwingL = swing; thighSwingR = -swing;
      kneeBendL = Math.max(0.08, -Math.sin(this.runPhase + 0.6)) * (0.5 + runFactor * 0.7);
      kneeBendR = Math.max(0.08, Math.sin(this.runPhase + 0.6)) * (0.5 + runFactor * 0.7);
      armSwingL = -swing * 0.8; armSwingR = swing * 0.8;
      elbowBendL = elbowBendR = -0.7 - runFactor * 0.3;
      headTilt = 0.12 * runFactor;
      hoodLift = 0.2 + runFactor * 0.45;
    } else {
      // Idle: respiración tranquila
      const breathe = Math.sin(this.time * 2.1);
      armSwingL = armSwingR = breathe * 0.04;
      this.torso.scale.y = 1 + breathe * 0.01;
      headTilt = Math.sin(this.time * 1.05) * 0.04;
      kneeBendL = kneeBendR = 0.04;
    }

    this.thighL.rotation.x = lerp(this.thighL.rotation.x, thighSwingL, 14);
    this.thighR.rotation.x = lerp(this.thighR.rotation.x, thighSwingR, 14);
    this.kneeL.rotation.x = lerp(this.kneeL.rotation.x, kneeBendL, 14);
    this.kneeR.rotation.x = lerp(this.kneeR.rotation.x, kneeBendR, 14);
    this.shoulderL.rotation.x = lerp(this.shoulderL.rotation.x, armSwingL, 14);
    this.shoulderR.rotation.x = lerp(this.shoulderR.rotation.x, armSwingR, 14);
    this.shoulderL.rotation.z = lerp(this.shoulderL.rotation.z, armLiftL, 12);
    this.shoulderR.rotation.z = lerp(this.shoulderR.rotation.z, armLiftR, 12);
    this.elbowL.rotation.x = lerp(this.elbowL.rotation.x, elbowBendL, 12);
    this.elbowR.rotation.x = lerp(this.elbowR.rotation.x, elbowBendR, 12);
    this.head.rotation.x = lerp(this.head.rotation.x, headTilt, 10);
    this.hood.rotation.x = lerp(this.hood.rotation.x, hoodLift, 8);

    // Rebote del cuerpo al correr
    if (pose.grounded && runFactor > 0.05) {
      this.root.position.y = Math.abs(Math.sin(this.runPhase)) * 0.045;
    } else {
      this.root.position.y = lerp(this.root.position.y, 0, 10);
    }
  }
}
