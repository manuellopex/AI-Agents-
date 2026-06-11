import * as THREE from 'three';

/**
 * ElariaApparition
 * -----------------
 * Elaria del Alba como aparición luminosa (LDD §6, paso 3: "Elaria emerge
 * como guía y protectora"). No es un personaje físico: es una figura de
 * luz perlada con halo dorado y velos translúcidos que emerge en las
 * cinemáticas, flota con calma y se desvanece al terminar.
 */
export class ElariaApparition {
  readonly group = new THREE.Group();

  private materials: THREE.Material[] = [];
  private light: THREE.PointLight;
  private time = 0;
  /** -1 oculta · 0..1 apareciendo · 1 visible · hacia 0 desvaneciéndose. */
  private fade = -1;
  private fadingOut = false;

  constructor(scene: THREE.Scene) {
    const pearl = this.mat(0xfdf6e0, 0xc9b070, 0.5);
    const gold = this.mat(0xffd34d, 0xb8861a, 0.8);
    const veil = this.mat(0xf2c4d8, 0xa07088, 0.35, 0.35);

    // Túnica larga (silueta elegante)
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.52, 1.7, 14), pearl);
    robe.position.y = 0.85;
    this.group.add(robe);
    // Torso y cabeza serena
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.3, 6, 12), pearl);
    torso.position.y = 1.85;
    this.group.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), pearl);
    head.position.y = 2.25;
    this.group.add(head);
    // Halo solar dorado
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.025, 8, 24), gold);
    halo.position.set(0, 2.42, -0.06);
    halo.rotation.x = 0.4;
    this.group.add(halo);
    // Brazos en gesto de bendición
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.45, 5, 10), pearl);
      arm.position.set(0.28 * side, 1.75, 0.1);
      arm.rotation.z = 0.9 * side;
      arm.rotation.x = -0.35;
      this.group.add(arm);
    }
    // Velos flotantes translúcidos
    for (const side of [-1, 1]) {
      const v = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.3), veil);
      v.position.set(0.42 * side, 1.3, -0.12);
      v.rotation.y = 0.5 * side;
      this.group.add(v);
    }
    // Luz cálida propia
    this.light = new THREE.PointLight(0xffe9c0, 0, 10);
    this.light.position.y = 1.8;
    this.group.add(this.light);

    this.group.visible = false;
    scene.add(this.group);
  }

  private mat(color: number, emissive: number, intensity: number, opacity = 0.85): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({
      color, emissive, emissiveIntensity: intensity,
      transparent: true, opacity, roughness: 0.4,
    });
    m.userData.baseOpacity = opacity;
    this.materials.push(m);
    return m;
  }

  /** Emerge en una posición mirando hacia un punto. */
  appearAt(position: THREE.Vector3, lookAt: THREE.Vector3): void {
    this.group.position.copy(position);
    this.group.lookAt(lookAt.x, position.y, lookAt.z);
    this.group.visible = true;
    this.fade = 0;
    this.fadingOut = false;
  }

  /** Se desvanece suavemente. */
  fadeOut(): void {
    this.fadingOut = true;
  }

  update(dt: number): void {
    if (!this.group.visible) return;
    this.time += dt;
    // Fundido de entrada/salida
    if (this.fadingOut) {
      this.fade = Math.max(this.fade - dt * 0.8, 0);
      if (this.fade <= 0) this.group.visible = false;
    } else if (this.fade < 1) {
      this.fade = Math.min(this.fade + dt * 1.2, 1);
    }
    for (const m of this.materials) {
      const mat = m as THREE.MeshStandardMaterial;
      mat.opacity = (mat.userData.baseOpacity as number) * this.fade;
    }
    this.light.intensity = 2.2 * this.fade;
    // Flotación serena
    this.group.position.y += Math.sin(this.time * 1.6) * dt * 0.12;
    this.group.rotation.y += Math.sin(this.time * 0.7) * dt * 0.04;
  }
}
