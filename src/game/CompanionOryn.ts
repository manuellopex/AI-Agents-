import * as THREE from 'three';

/**
 * CompanionOryn
 * --------------
 * Oryn: antes una criatura parecida a un perro costero; al tocar un
 * fragmento de Noxia quedó transformado en un ser pequeño, brillante y
 * extraño, con orejas largas y cola de agua luminosa. Es el alivio cómico
 * y el corazón emocional del viaje. Flota cerca del hombro de Mael con un
 * movimiento elástico (con retardo) y se inclina hacia donde se mueve.
 * Sus frases las muestra el UIManager en una burbuja.
 */
export class CompanionOryn {
  readonly group = new THREE.Group();

  private velocity = new THREE.Vector3();
  private time = Math.random() * 10;
  private wings: THREE.Mesh[] = [];
  /** Posición objetivo relativa al jugador: sobre el hombro izquierdo. */
  private readonly shoulderOffset = new THREE.Vector3(-0.9, 2.2, 0.4);

  constructor(scene: THREE.Scene) {
    // Cuerpo: gota redondeada blanco-hielo con barriga crema (perrito marino)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, flatShading: true });
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), bodyMat);
    body.scale.set(1, 1.15, 1);
    this.group.add(body);

    const bellyMat = new THREE.MeshStandardMaterial({ color: 0xfdf3d8, flatShading: true });
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), bellyMat);
    belly.position.set(0, -0.05, 0.16);
    this.group.add(belly);

    // Orejas largas (el rasgo que conservó de su forma original)
    const earMat = new THREE.MeshStandardMaterial({ color: 0x4ea8d8, flatShading: true });
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.5, 5), earMat);
      ear.position.set(0.12 * side, 0.42, -0.05);
      ear.rotation.z = -0.35 * side;
      this.group.add(ear);
    }

    // Ojos enormes (expresividad cómica)
    const eyeGeo = new THREE.SphereGeometry(0.085, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilGeo = new THREE.SphereGeometry(0.045, 6, 6);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x232323 });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(0.11 * side, 0.1, 0.22);
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.z = 0.06;
      eye.add(pupil);
      this.group.add(eye);
    }

    // Alas pequeñas de libélula
    const wingMat = new THREE.MeshBasicMaterial({
      color: 0xcdf6ff, transparent: true, opacity: 0.65, side: THREE.DoubleSide,
    });
    const wingGeo = new THREE.CircleGeometry(0.22, 6);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.position.set(0.22 * side, 0.15, -0.15);
      wing.scale.set(1.6, 0.7, 1);
      this.group.add(wing);
      this.wings.push(wing);
    }

    // Cola de agua luminosa (la marca que le dejó la Noxia)
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0x6fd8ff, emissive: 0x2090c0, emissiveIntensity: 1.2, transparent: true, opacity: 0.85,
    });
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.38, 5), tailMat);
    tail.position.set(0, -0.15, -0.3);
    tail.rotation.x = 1.2;
    this.group.add(tail);

    scene.add(this.group);
  }

  update(dt: number, playerPosition: THREE.Vector3, playerRotationY: number): void {
    this.time += dt;
    // Punto objetivo: hombro del jugador, rotado según hacia dónde mira Mael
    const offset = this.shoulderOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), playerRotationY);
    const target = playerPosition.clone().add(offset);
    target.y += Math.sin(this.time * 3) * 0.12; // flotación propia

    // Movimiento elástico tipo muelle: Oryn "persigue" su sitio con retardo
    const toTarget = target.sub(this.group.position);
    this.velocity.addScaledVector(toTarget, 10 * dt);
    this.velocity.multiplyScalar(Math.max(1 - 6 * dt, 0));
    this.group.position.addScaledVector(this.velocity, dt * 6);

    // Mira hacia donde se mueve; aleteo constante
    if (this.velocity.lengthSq() > 0.01) {
      this.group.rotation.y += (Math.atan2(this.velocity.x, this.velocity.z) - this.group.rotation.y) * Math.min(8 * dt, 1);
    }
    const flap = Math.sin(this.time * 25) * 0.7;
    this.wings[0].rotation.y = 0.4 + flap;
    this.wings[1].rotation.y = -0.4 - flap;
    // Inclinación cómica al moverse rápido
    this.group.rotation.z = THREE.MathUtils.clamp(-this.velocity.x * 0.06, -0.4, 0.4);
  }
}
