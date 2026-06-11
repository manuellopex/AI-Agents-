import * as THREE from 'three';

/** Estado de gameplay que el personaje traduce a poses. */
export interface MaelPose {
  /** Velocidad horizontal actual. */
  speed: number;
  grounded: boolean;
  velocityY: number;
  attacking: boolean;
  attackKind: 'spin' | 'punch' | 'pound';
  pounding: boolean;
}

/**
 * MaelCharacter
 * --------------
 * Modelo procedural de Mael Veyra fiel a su hoja de personaje:
 * pelo castaño oscuro despeinado en puntas, ojos grandes expresivos,
 * túnica crema con ribetes teal y capucha, faja teal, cinturón de cuero
 * con el artefacto circular de Auralis (espiral dorada brillante),
 * pantalones bombachos, brazaletes y sandalias.
 *
 * Está construido con pivotes por extremidad (caderas/hombros/cabeza)
 * para animarlo por código: ciclo de carrera, respiración en idle y
 * poses de salto, caída, giro, golpe y ground pound.
 */
export class MaelCharacter {
  /** Raíz del personaje (el PlayerController la rota para mirar/girar). */
  readonly root = new THREE.Group();

  private legL!: THREE.Group;
  private legR!: THREE.Group;
  private armL!: THREE.Group;
  private armR!: THREE.Group;
  private head!: THREE.Group;
  private torso!: THREE.Group;
  private cape!: THREE.Mesh;

  private runPhase = 0;
  private time = 0;

  // Paleta tomada de los swatches de la hoja de personaje
  private skin = new THREE.MeshStandardMaterial({ color: 0xe8a56c, roughness: 0.75 });
  private hair = new THREE.MeshStandardMaterial({ color: 0x2e1f14, roughness: 0.9 });
  private cream = new THREE.MeshStandardMaterial({ color: 0xf2e3c2, roughness: 0.85 });
  private teal = new THREE.MeshStandardMaterial({ color: 0x1f9e96, roughness: 0.7 });
  private tealDark = new THREE.MeshStandardMaterial({ color: 0x14706b, roughness: 0.7 });
  private gold = new THREE.MeshStandardMaterial({ color: 0xd9a23b, roughness: 0.4, metalness: 0.5 });
  private leather = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.85 });
  private auralis = new THREE.MeshStandardMaterial({
    color: 0x7fe8dc, emissive: 0x1ecbcd, emissiveIntensity: 1.5, roughness: 0.3,
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

  // ------------------------------------------------------------------
  // Construcción
  // ------------------------------------------------------------------

  private mesh(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D,
    x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  }

  /** Piernas con pivote en la cadera: pantalón bombacho + sandalia. */
  private buildLegs(): void {
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(0.12 * side, 0.62, 0); // cadera
      // Bombacho crema (ancho arriba, recogido al tobillo)
      this.mesh(new THREE.CapsuleGeometry(0.115, 0.26, 6, 14), this.cream, leg, 0, -0.18, 0);
      this.mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.1, 12), this.teal, leg, 0, -0.4, 0);
      // Tobillo y sandalia con tiras
      this.mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.1, 10), this.skin, leg, 0, -0.49, 0);
      this.mesh(new THREE.BoxGeometry(0.15, 0.05, 0.27), this.leather, leg, 0, -0.585, 0.05);
      this.mesh(new THREE.BoxGeometry(0.13, 0.035, 0.05), this.leather, leg, 0, -0.55, 0.12, 0.5);
      if (side < 0) this.legL = leg; else this.legR = leg;
      this.root.add(leg);
    }
  }

  /** Túnica crema con ribete teal, faja, cinturón y el artefacto de Auralis. */
  private buildTorso(): void {
    this.torso = new THREE.Group();
    this.torso.position.y = 0.62;
    this.root.add(this.torso);

    // Túnica (algo acampanada hacia la cadera)
    this.mesh(new THREE.CapsuleGeometry(0.235, 0.34, 8, 18), this.cream, this.torso, 0, 0.28, 0);
    this.mesh(new THREE.CylinderGeometry(0.27, 0.305, 0.18, 18), this.cream, this.torso, 0, 0.06, 0);
    // Cuello en V teal (dos tiras cruzadas)
    this.mesh(new THREE.BoxGeometry(0.05, 0.2, 0.02), this.teal, this.torso, -0.075, 0.5, 0.225, 0.12, 0, 0.5);
    this.mesh(new THREE.BoxGeometry(0.05, 0.2, 0.02), this.teal, this.torso, 0.075, 0.5, 0.225, 0.12, 0, -0.5);

    // Faja teal con caída lateral + cinturón de cuero
    this.mesh(new THREE.CylinderGeometry(0.285, 0.295, 0.085, 18), this.teal, this.torso, 0, 0.1, 0);
    this.mesh(new THREE.BoxGeometry(0.16, 0.3, 0.02), this.teal, this.torso, -0.2, -0.08, 0.12, 0.1, 0.5, 0.12);
    this.mesh(new THREE.BoxGeometry(0.02, 0.3, 0.16), this.tealDark, this.torso, -0.24, -0.1, 0.04, 0.08, 0, 0.18);
    const belt = this.mesh(new THREE.TorusGeometry(0.275, 0.035, 8, 22), this.leather, this.torso, 0, 0.17, 0);
    belt.rotation.x = Math.PI / 2;

    // Artefacto circular de Auralis (la pieza icónica del cinturón)
    const artifact = new THREE.Group();
    artifact.position.set(0.1, 0.16, 0.27);
    artifact.rotation.x = 0.15;
    const ring = this.mesh(new THREE.TorusGeometry(0.085, 0.028, 10, 22), this.gold, artifact);
    ring.rotation.x = 0; // de frente
    this.mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.025, 18), this.auralis, artifact, 0, 0, 0, Math.PI / 2);
    // Espiral sugerida: tres cuentas doradas sobre el núcleo
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1;
      this.mesh(new THREE.SphereGeometry(0.014, 8, 8), this.gold, artifact,
        Math.cos(a) * 0.032, Math.sin(a) * 0.032, 0.018);
    }
    // Tachuelas del aro
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      this.mesh(new THREE.SphereGeometry(0.016, 8, 8), this.gold, artifact,
        Math.cos(a) * 0.085, Math.sin(a) * 0.085, 0.012);
    }
    this.torso.add(artifact);

    // Capucha caída y capa corta teal en la espalda
    this.mesh(new THREE.SphereGeometry(0.13, 14, 10), this.teal, this.torso, 0, 0.52, -0.17);
    this.cape = this.mesh(new THREE.BoxGeometry(0.34, 0.4, 0.03), this.teal, this.torso, 0, 0.3, -0.25, 0.25);
  }

  /** Brazos con pivote en el hombro: piel + brazalete teal/bronce + mano. */
  private buildArms(): void {
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(0.27 * side, 1.12, 0); // hombro
      // Manga corta crema
      this.mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.14, 12), this.cream, arm, 0, -0.05, 0, 0, 0, 0.15 * side);
      // Brazo
      this.mesh(new THREE.CapsuleGeometry(0.06, 0.22, 6, 12), this.skin, arm, 0.02 * side, -0.2, 0);
      // Brazalete teal con borde dorado
      this.mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.11, 12), this.teal, arm, 0.025 * side, -0.31, 0);
      this.mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.02, 12), this.gold, arm, 0.025 * side, -0.365, 0);
      // Mano (un poco grande: lectura platformer)
      this.mesh(new THREE.SphereGeometry(0.075, 12, 10), this.skin, arm, 0.03 * side, -0.43, 0);
      if (side < 0) this.armL = arm; else this.armR = arm;
      this.root.add(arm);
    }
  }

  /** Cabeza grande y expresiva con el pelo en puntas de la hoja de modelo. */
  private buildHead(): void {
    this.head = new THREE.Group();
    this.head.position.y = 1.46;
    this.root.add(this.head);

    const skull = this.mesh(new THREE.SphereGeometry(0.3, 24, 18), this.skin, this.head, 0, 0, 0);
    skull.scale.set(1, 0.98, 0.95);

    // Orejas
    for (const side of [-1, 1]) {
      this.mesh(new THREE.SphereGeometry(0.05, 10, 8), this.skin, this.head, 0.29 * side, -0.02, 0);
    }

    // Ojos grandes: esclerótica + iris marrón + pupila + brillo
    for (const side of [-1, 1]) {
      const eye = this.mesh(new THREE.SphereGeometry(0.068, 14, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 }), this.head, 0.115 * side, 0.0, 0.245);
      eye.scale.set(1, 1.25, 0.55);
      this.mesh(new THREE.SphereGeometry(0.042, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0x6b3f1f, roughness: 0.3 }), this.head, 0.115 * side, 0.0, 0.282);
      this.mesh(new THREE.SphereGeometry(0.02, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x140b06 }), this.head, 0.115 * side, 0.0, 0.305);
      this.mesh(new THREE.SphereGeometry(0.011, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff }), this.head, 0.13 * side, 0.025, 0.31);
      // Ceja
      this.mesh(new THREE.BoxGeometry(0.1, 0.022, 0.02), this.hair, this.head,
        0.115 * side, 0.095, 0.27, 0, 0, -0.18 * side);
    }
    // Nariz y sonrisa pequeña
    this.mesh(new THREE.SphereGeometry(0.028, 8, 8), this.skin, this.head, 0, -0.06, 0.295);
    this.mesh(new THREE.BoxGeometry(0.07, 0.014, 0.012),
      new THREE.MeshBasicMaterial({ color: 0x8a5436 }), this.head, 0.012, -0.135, 0.275, 0, 0, -0.12);

    // Pelo en puntas: casquete + mechones cónicos hacia fuera
    const cap = this.mesh(new THREE.SphereGeometry(0.305, 18, 14), this.hair, this.head, 0, 0.07, -0.03);
    cap.scale.set(1.04, 0.92, 1.0);
    const tufts: [number, number, number, number, number, number, number][] = [
      // x, y, z, rotX, rotZ, radio, alto
      [0, 0.3, 0.0, -0.3, 0, 0.13, 0.34],
      [0.14, 0.28, 0.05, -0.2, -0.7, 0.1, 0.28],
      [-0.14, 0.28, 0.05, -0.2, 0.7, 0.1, 0.28],
      [0.2, 0.2, -0.12, -0.6, -1.0, 0.09, 0.26],
      [-0.2, 0.2, -0.12, -0.6, 1.0, 0.09, 0.26],
      [0.07, 0.26, -0.2, -1.0, -0.3, 0.1, 0.3],
      [-0.07, 0.26, -0.2, -1.0, 0.3, 0.1, 0.3],
      [0, 0.18, -0.27, -1.4, 0, 0.09, 0.26],
      // Flequillo sobre la frente
      [0.1, 0.18, 0.24, 0.9, -0.3, 0.07, 0.2],
      [-0.1, 0.18, 0.24, 0.9, 0.3, 0.07, 0.2],
      [0, 0.2, 0.26, 0.8, 0, 0.08, 0.22],
    ];
    for (const [x, y, z, rx, rz, r, h] of tufts) {
      this.mesh(new THREE.ConeGeometry(r, h, 7), this.hair, this.head, x, y, z, rx, 0, rz);
    }
    // Patillas
    for (const side of [-1, 1]) {
      this.mesh(new THREE.ConeGeometry(0.05, 0.16, 6), this.hair, this.head,
        0.27 * side, 0.02, 0.08, Math.PI, 0, 0.12 * side);
    }
  }

  // ------------------------------------------------------------------
  // Animación procedural
  // ------------------------------------------------------------------

  update(dt: number, pose: MaelPose): void {
    this.time += dt;
    const lerp = (cur: number, target: number, k: number) =>
      cur + (target - cur) * Math.min(k * dt, 1);

    const runFactor = THREE.MathUtils.clamp(pose.speed / 7, 0, 1);
    this.runPhase += dt * (4 + pose.speed * 1.6);

    let legSwingL = 0, legSwingR = 0, armSwingL = 0, armSwingR = 0;
    let armLiftL = 0, armLiftR = 0, headTilt = 0, capeLift = 0.25;

    if (pose.attacking && pose.attackKind === 'spin') {
      // Brazos en cruz durante el giro
      armLiftL = 1.45; armLiftR = -1.45;
    } else if (pose.attacking && pose.attackKind === 'punch') {
      // Puñetazo: brazo derecho al frente, izquierdo atrás
      armSwingR = -1.5; armSwingL = 0.7;
    } else if (pose.pounding) {
      // Ground pound: puños abajo, piernas recogidas
      legSwingL = legSwingR = -1.1;
      armLiftL = 0.5; armLiftR = -0.5;
      headTilt = 0.35;
    } else if (!pose.grounded) {
      if (pose.velocityY > 1) {
        // Subiendo: pierna delante, brazos arriba (salto heroico)
        legSwingL = -0.9; legSwingR = 0.5;
        armSwingL = 0.8; armSwingR = 0.8;
        armLiftL = 0.45; armLiftR = -0.45;
        capeLift = 0.7;
      } else {
        // Cayendo: brazos abiertos equilibrando
        legSwingL = -0.3; legSwingR = 0.3;
        armLiftL = 0.9; armLiftR = -0.9;
        headTilt = -0.15;
        capeLift = 0.9;
      }
    } else if (runFactor > 0.05) {
      // Ciclo de carrera: piernas y brazos en oposición
      const swing = Math.sin(this.runPhase) * (0.55 + runFactor * 0.45);
      legSwingL = swing; legSwingR = -swing;
      armSwingL = -swing * 0.7; armSwingR = swing * 0.7;
      headTilt = 0.12 * runFactor;
      capeLift = 0.25 + runFactor * 0.5;
    } else {
      // Idle: respiración y balanceo sutil
      const breathe = Math.sin(this.time * 2.2);
      armSwingL = armSwingR = breathe * 0.05;
      this.torso.scale.y = 1 + breathe * 0.012;
      headTilt = Math.sin(this.time * 1.1) * 0.04;
    }

    this.legL.rotation.x = lerp(this.legL.rotation.x, legSwingL, 14);
    this.legR.rotation.x = lerp(this.legR.rotation.x, legSwingR, 14);
    this.armL.rotation.x = lerp(this.armL.rotation.x, armSwingL, 14);
    this.armR.rotation.x = lerp(this.armR.rotation.x, armSwingR, 14);
    this.armL.rotation.z = lerp(this.armL.rotation.z, armLiftL, 12);
    this.armR.rotation.z = lerp(this.armR.rotation.z, armLiftR, 12);
    this.head.rotation.x = lerp(this.head.rotation.x, headTilt, 10);
    this.cape.rotation.x = lerp(this.cape.rotation.x, capeLift, 8);

    // Rebote vertical del cuerpo al correr (los pies "empujan")
    if (pose.grounded && runFactor > 0.05) {
      this.root.position.y = Math.abs(Math.sin(this.runPhase)) * 0.05;
    } else {
      this.root.position.y = lerp(this.root.position.y, 0, 10);
    }
  }
}
