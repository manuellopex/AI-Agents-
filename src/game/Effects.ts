import * as THREE from 'three';

/**
 * Effects
 * --------
 * Pequeño sistema de partículas para feedback visual: recogida de cristal,
 * enemigo derrotado, caja rota, ataque de giro, etc.
 */
interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class Effects {
  private particles: Particle[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Explosión de fragmentos pequeños en una posición. */
  burst(position: THREE.Vector3, color: number, count = 10, speed = 4): void {
    const geo = new THREE.TetrahedronGeometry(0.12);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(position);
      const dir = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() * 0.8 + 0.2,
        Math.random() - 0.5,
      ).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.5));
      this.scene.add(mesh);
      this.particles.push({ mesh, velocity: dir, life: 0.6, maxLife: 0.6 });
    }
  }

  /** Anillo expansivo (usado por el ataque de giro). */
  ring(position: THREE.Vector3, color: number, radius = 2.2): void {
    const geo = new THREE.RingGeometry(0.3, 0.5, 24);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(position);
    mesh.position.y += 0.15;
    mesh.userData.targetScale = radius / 0.4;
    this.scene.add(mesh);
    this.particles.push({ mesh, velocity: new THREE.Vector3(), life: 0.35, maxLife: 0.35 });
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      const t = 1 - p.life / p.maxLife;
      // Los anillos crecen; los fragmentos vuelan con gravedad ligera.
      const target = p.mesh.userData.targetScale as number | undefined;
      if (target !== undefined) {
        const s = 1 + (target - 1) * t;
        p.mesh.scale.setScalar(s);
      } else {
        p.velocity.y -= 9 * dt;
        p.mesh.position.addScaledVector(p.velocity, dt);
        p.mesh.rotation.x += dt * 6;
        p.mesh.rotation.z += dt * 5;
      }
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(p.life / p.maxLife, 0);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
  }
}
