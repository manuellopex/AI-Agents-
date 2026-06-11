import * as THREE from 'three';

/**
 * Liora — El Primer Destello
 * ---------------------------
 * Pequeña luz dorada que guía a Mael por la isla. No es un personaje
 * jugable: flota sobre el siguiente punto del camino (checkpoints y meta),
 * pulsa suavemente y brilla con más fuerza cuantos más Lumas se recuperan
 * («mientras más Lumas recupera Mael, más fuerte brilla Liora»).
 */
export class Liora {
  readonly group = new THREE.Group();

  private core: THREE.Mesh;
  private halo: THREE.Mesh;
  private light: THREE.PointLight;
  private time = 0;
  /** Puntos del camino que Liora va señalando, en orden. */
  private waypoints: THREE.Vector3[];

  constructor(scene: THREE.Scene, waypoints: THREE.Vector3[], goal: THREE.Vector3) {
    // El recorrido completo: checkpoints y, al final, el tótem de meta
    this.waypoints = [...waypoints.map((w) => w.clone()), goal.clone()];

    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0 }),
    );
    this.group.add(this.core);

    this.halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.3 }),
    );
    this.group.add(this.halo);

    this.light = new THREE.PointLight(0xffd34d, 1.2, 8);
    this.group.add(this.light);

    this.group.position.copy(this.waypoints[0]).add(new THREE.Vector3(0, 3, 0));
    scene.add(this.group);
  }

  /**
   * @param progress fracción de Lumas recuperados (0..1): aumenta su brillo.
   */
  update(dt: number, playerPosition: THREE.Vector3, progress: number): void {
    this.time += dt;

    // Buscar el siguiente waypoint por delante del jugador (el camino avanza
    // hacia -Z); si ya no queda ninguno, Liora espera sobre la meta.
    let target = this.waypoints[this.waypoints.length - 1];
    for (const wp of this.waypoints) {
      if (wp.z < playerPosition.z - 4) {
        target = wp;
        break;
      }
    }
    const desired = target.clone().add(new THREE.Vector3(0, 3 + Math.sin(this.time * 2) * 0.25, 0));
    // Vuelo suave hacia su siguiente posición de guía
    this.group.position.lerp(desired, Math.min(1.5 * dt, 1));

    // Pulso + brillo creciente con el progreso de Lumas
    const pulse = 1 + Math.sin(this.time * 4) * 0.12;
    const power = 0.6 + progress * 1.6;
    this.core.scale.setScalar(pulse * (0.8 + progress * 0.7));
    this.halo.scale.setScalar(pulse * (0.8 + progress * 1.2));
    (this.halo.material as THREE.MeshBasicMaterial).opacity = 0.2 + progress * 0.3;
    this.light.intensity = power;
    this.light.distance = 6 + progress * 8;
  }
}
