import * as THREE from 'three';

/**
 * Atmosphere
 * -----------
 * Capas de profundidad para el cielo: nubes volumétricas a la deriva y
 * aves Quirí trazando círculos a distintas alturas. El movimiento a varias
 * distancias crea paralaje: el mundo deja de sentirse como un decorado.
 */
export class Atmosphere {
  private clouds: { group: THREE.Group; speed: number }[] = [];
  private birds: { group: THREE.Group; wingL: THREE.Mesh; wingR: THREE.Mesh; center: THREE.Vector3; radius: number; speed: number; phase: number }[] = [];
  private time = 0;

  constructor(scene: THREE.Scene) {
    this.buildClouds(scene);
    this.buildBirds(scene);
  }

  /** Nubes: racimos de esferas estiradas, semitransparentes, sin niebla. */
  private buildClouds(scene: THREE.Scene): void {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, transparent: true, opacity: 0.85, roughness: 1, fog: false,
    });
    const spots: [number, number, number, number][] = [
      // x, y, z, escala
      [-50, 34, -50, 1.4], [30, 40, -70, 1.8], [60, 36, -10, 1.2],
      [-65, 42, 10, 1.6], [10, 38, 40, 1.3], [-20, 44, -85, 2.0],
    ];
    for (const [x, y, z, s] of spots) {
      const cloud = new THREE.Group();
      const puffs = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < puffs; i++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(2.2 + Math.random() * 1.6, 10, 8), mat);
        puff.position.set((i - puffs / 2) * 2.6 + Math.random(), (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 2);
        puff.scale.set(1.6, 0.55, 1);
        cloud.add(puff);
      }
      cloud.position.set(x, y, z);
      cloud.scale.setScalar(s);
      scene.add(cloud);
      this.clouds.push({ group: cloud, speed: 0.5 + Math.random() * 0.7 });
    }
  }

  /** Aves Quirí: cuerpos dorados con alas batiendo, en órbitas circulares. */
  private buildBirds(scene: THREE.Scene): void {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xffe28a, emissive: 0x8a6420, emissiveIntensity: 0.4, roughness: 0.7,
    });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xf6dfb4, side: THREE.DoubleSide, roughness: 0.8 });
    const orbits: [number, number, number, number, number][] = [
      // cx, cy, cz, radio, velocidad
      [0, 16, -20, 22, 0.25], [10, 26, -44, 12, 0.35], [-20, 10, 10, 16, 0.3], [25, 13, -5, 14, -0.28],
    ];
    for (const [cx, cy, cz, radius, speed] of orbits) {
      const bird = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 7), bodyMat);
      body.scale.set(1, 0.8, 1.5);
      bird.add(body);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 5),
        new THREE.MeshStandardMaterial({ color: 0xc96f4a }));
      beak.position.set(0, 0, 0.36);
      beak.rotation.x = Math.PI / 2;
      bird.add(beak);
      const wingGeo = new THREE.PlaneGeometry(0.7, 0.3);
      const wingL = new THREE.Mesh(wingGeo, wingMat);
      wingL.position.set(-0.38, 0.05, 0);
      const wingR = new THREE.Mesh(wingGeo, wingMat);
      wingR.position.set(0.38, 0.05, 0);
      bird.add(wingL, wingR);
      scene.add(bird);
      this.birds.push({
        group: bird, wingL, wingR,
        center: new THREE.Vector3(cx, cy, cz),
        radius, speed, phase: Math.random() * Math.PI * 2,
      });
    }
  }

  update(dt: number): void {
    this.time += dt;
    // Nubes a la deriva con viento del oeste; reaparecen por el otro lado
    for (const cloud of this.clouds) {
      cloud.group.position.x += cloud.speed * dt;
      if (cloud.group.position.x > 95) cloud.group.position.x = -95;
    }
    // Aves: órbita circular orientada a la tangente + aleteo
    for (const bird of this.birds) {
      const a = this.time * bird.speed + bird.phase;
      const x = bird.center.x + Math.cos(a) * bird.radius;
      const z = bird.center.z + Math.sin(a) * bird.radius;
      const y = bird.center.y + Math.sin(this.time * 0.8 + bird.phase) * 1.2;
      bird.group.position.set(x, y, z);
      // Mirar hacia la tangente del círculo
      const dir = Math.sign(bird.speed);
      bird.group.rotation.y = -a - Math.PI / 2 * dir;
      const flap = Math.sin(this.time * 9 + bird.phase) * 0.7;
      bird.wingL.rotation.z = 0.3 + flap;
      bird.wingR.rotation.z = -0.3 - flap;
    }
  }
}
