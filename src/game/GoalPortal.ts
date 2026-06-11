import * as THREE from 'three';

/**
 * GoalPortal
 * -----------
 * El tótem-portal de energía antigua que marca la meta del nivel: pedestal
 * de piedra, anillo dorado giratorio con halo de energía y un haz de luz
 * vertical. Cuando el jugador entra en el radio, dispara onReached una vez.
 */
export class GoalPortal {
  readonly position: THREE.Vector3;
  private ring: THREE.Mesh;
  private beam: THREE.Mesh;
  private time = 0;
  private reached = false;

  onReached: (() => void) | null = null;

  constructor(scene: THREE.Scene, position: THREE.Vector3, groundMeshes: THREE.Mesh[]) {
    this.position = position.clone();
    const group = new THREE.Group();

    // Pedestal de piedra (se puede pisar)
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.7, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0xcfc6b0, flatShading: true }),
    );
    pedestal.position.set(position.x, position.y + 0.25, position.z);
    group.add(pedestal);
    groundMeshes.push(pedestal);

    // Anillo dorado giratorio
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.2, 0.16, 10, 28),
      new THREE.MeshStandardMaterial({ color: 0xffd34d, emissive: 0xffaa00, emissiveIntensity: 0.7, flatShading: true }),
    );
    this.ring.position.set(position.x, position.y + 2.1, position.z);
    group.add(this.ring);

    // Halo interior de energía
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(1.0, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    );
    this.ring.add(glow);

    // Haz de luz vertical (energía azul/dorada de Isla Auria)
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.45, 7, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
    );
    this.beam.position.set(position.x, position.y + 3.5, position.z);
    group.add(this.beam);

    scene.add(group);
  }

  update(dt: number, playerPosition: THREE.Vector3): void {
    this.time += dt;
    this.ring.rotation.y += dt * 1.2;
    this.ring.position.y = this.position.y + 2.1 + Math.sin(this.time * 1.5) * 0.15;
    (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.sin(this.time * 2) * 0.08;

    if (!this.reached && playerPosition.distanceTo(this.position) < 1.7) {
      this.reached = true;
      this.onReached?.();
    }
  }
}
