import * as THREE from 'three';
import { Effects } from './Effects';

interface Luma {
  mesh: THREE.Mesh;
  baseY: number;
  phase: number;
  collected: boolean;
  /** true cuando el imán del jugador lo está atrayendo. */
  attracted: boolean;
}

/**
 * CollectibleManager
 * -------------------
 * "Lumas": cristales de energía de Isla Auria. Flotan, rotan, brillan y
 * desaparecen al recogerse con un estallido de partículas. Incluye
 * recolección automática: los Lumas cercanos vuelan hacia el jugador.
 */
export class CollectibleManager {
  private crystals: Luma[] = [];
  private scene: THREE.Scene;
  private effects: Effects;
  private geo = new THREE.OctahedronGeometry(0.32);
  private mat = new THREE.MeshStandardMaterial({
    color: 0x4de3ff,
    emissive: 0x18b9e8,
    emissiveIntensity: 0.9,
    flatShading: true,
  });
  private time = 0;

  /** Lumas recogidos en total (estadística). */
  collected = 0;
  /** Lumas disponibles para gastar (moneda: santuarios, cofres…). */
  balance = 0;
  onCollect: ((collected: number, total: number) => void) | null = null;

  /** Gasta Lumas si hay saldo. Devuelve true si se pudo pagar. */
  spend(amount: number): boolean {
    if (this.balance < amount) return false;
    this.balance -= amount;
    return true;
  }

  /** Total fijo del nivel (incluye los Lumas aún escondidos en cajas). */
  private readonly levelTotal: number;

  constructor(scene: THREE.Scene, effects: Effects, positions: THREE.Vector3[], hiddenInCrates = 0) {
    this.scene = scene;
    this.effects = effects;
    this.levelTotal = positions.length + hiddenInCrates;
    for (const pos of positions) this.spawnCrystal(pos);
  }

  get total(): number {
    return this.levelTotal;
  }

  /** Crea un Luma en una posición (también usado por las cajas rotas). */
  spawnCrystal(position: THREE.Vector3): void {
    const mesh = new THREE.Mesh(this.geo, this.mat);
    mesh.position.copy(position);
    this.scene.add(mesh);
    this.crystals.push({
      mesh,
      baseY: position.y,
      phase: Math.random() * Math.PI * 2,
      collected: false,
      attracted: false,
    });
  }

  /** Anima los Lumas, aplica el imán de recogida y detecta la captura. */
  update(dt: number, playerPosition: THREE.Vector3): boolean {
    this.time += dt;
    let pickedUp = false;
    const magnetCenter = playerPosition.clone();
    magnetCenter.y += 0.8;
    for (const c of this.crystals) {
      if (c.collected) continue;
      const dist = c.mesh.position.distanceTo(magnetCenter);

      // Recolección automática: dentro del radio del imán, el Luma vuela
      // hacia el jugador (una vez atraído ya no vuelve a su sitio).
      if (dist < 2.6) c.attracted = true;
      if (c.attracted) {
        const pull = Math.min((12 / Math.max(dist, 0.3)) * dt, 1);
        c.mesh.position.lerp(magnetCenter, pull);
        c.mesh.rotation.y += dt * 8;
      } else {
        // Flotación y rotación lenta en reposo
        c.mesh.position.y = c.baseY + Math.sin(this.time * 2 + c.phase) * 0.15;
        c.mesh.rotation.y += dt * 1.5;
      }

      // Captura
      if (dist < 0.9) {
        c.collected = true;
        c.mesh.visible = false;
        this.collected++;
        this.balance++;
        this.effects.burst(c.mesh.position, 0x4de3ff, 8, 3);
        this.onCollect?.(this.collected, this.total);
        pickedUp = true;
      }
    }
    return pickedUp;
  }
}
