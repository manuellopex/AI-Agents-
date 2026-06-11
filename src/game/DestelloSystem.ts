import * as THREE from 'three';
import { Effects } from './Effects';

/** Identificadores únicos de los 6 Destellos de Costa Brillante. */
export type DestelloId = 'faro' | 'coral' | 'oryn' | 'quiries' | 'cueva' | 'desafio';

export interface DestelloDef {
  id: DestelloId;
  nombre: string;
  tipo: string;
  /** false = bloqueado en esta versión (se muestra como "próximamente"). */
  disponible: boolean;
}

interface DestelloVisual {
  id: DestelloId;
  group: THREE.Group;
  collected: boolean;
  phase: number;
}

/**
 * DestelloSystem
 * ---------------
 * El objetivo principal del juego: los Destellos de Auralis. Cada nivel
 * tiene varios y el jugador elige cuáles completar (3 de 6 abren el Faro).
 * Gestiona definiciones, estado, visual flotante de cada Destello en el
 * mundo y la recogida con efecto + sonido (vía callbacks).
 */
export class DestelloSystem {
  /** Los 6 Destellos de Costa Brillante, cada uno con un reto distinto. */
  readonly defs: DestelloDef[] = [
    { id: 'faro', nombre: 'Destello del Faro', tipo: 'Plataformas verticales', disponible: true },
    { id: 'coral', nombre: 'Destello del Coral Dormido', tipo: 'Combate ambiental', disponible: true },
    { id: 'oryn', nombre: 'Destello de Oryn', tipo: 'Secreto guiado', disponible: true },
    { id: 'quiries', nombre: 'Destello de los Quiríes', tipo: 'Mini-misión', disponible: false },
    { id: 'cueva', nombre: 'Destello de la Cueva Azul', tipo: 'Puzzle secreto', disponible: false },
    { id: 'desafio', nombre: 'Destello del Desafío de Mael', tipo: 'Reto cronometrado', disponible: false },
  ];

  /** Destellos necesarios para activar el Faro del Alba. */
  readonly required = 3;

  private completed = new Set<DestelloId>();
  private visuals: DestelloVisual[] = [];
  private scene: THREE.Scene;
  private effects: Effects;
  private time = 0;

  onCollect: ((def: DestelloDef, count: number) => void) | null = null;

  constructor(scene: THREE.Scene, effects: Effects) {
    this.scene = scene;
    this.effects = effects;
  }

  get count(): number {
    return this.completed.size;
  }

  get total(): number {
    return this.defs.length;
  }

  isComplete(id: DestelloId): boolean {
    return this.completed.has(id);
  }

  getDef(id: DestelloId): DestelloDef {
    return this.defs.find((d) => d.id === id)!;
  }

  /**
   * Hace aparecer el visual de un Destello en el mundo (estrella dorada
   * grande con halo). El jugador lo recoge por proximidad.
   */
  spawnVisual(id: DestelloId, position: THREE.Vector3): void {
    if (this.completed.has(id) || this.visuals.some((v) => v.id === id)) return;

    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55),
      new THREE.MeshStandardMaterial({
        color: 0xffe9a0, emissive: 0xffb820, emissiveIntensity: 1.1,
      }),
    );
    group.add(core);
    // Halo anillado que lo distingue de los Lumas
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.05, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.7 }),
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.16 }),
    );
    group.add(glow);

    group.position.copy(position);
    this.scene.add(group);
    this.visuals.push({ id, group, collected: false, phase: Math.random() * Math.PI * 2 });
    // Estallido de aparición: que se note desde lejos
    this.effects.burst(position.clone(), 0xffd34d, 16, 5);
  }

  /** Anima los Destellos y detecta la recogida. */
  update(dt: number, playerPosition: THREE.Vector3): void {
    this.time += dt;
    for (const v of this.visuals) {
      if (v.collected) continue;
      v.group.rotation.y += dt * 1.8;
      v.group.position.y += Math.sin(this.time * 2 + v.phase) * dt * 0.3;
      const dx = v.group.position.x - playerPosition.x;
      const dy = v.group.position.y - (playerPosition.y + 0.9);
      const dz = v.group.position.z - playerPosition.z;
      if (dx * dx + dy * dy + dz * dz < 1.6 * 1.6) {
        v.collected = true;
        v.group.visible = false;
        this.completed.add(v.id);
        this.effects.burst(v.group.position.clone(), 0xffd34d, 22, 6);
        this.effects.ring(v.group.position.clone(), 0xffd34d, 3);
        this.onCollect?.(this.getDef(v.id), this.count);
      }
    }
  }
}
