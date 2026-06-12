import * as THREE from 'three';
import { Effects } from './Effects';

/** Roca corrupta de Noxia que solo la embestida del Caracoral puede romper. */
export interface CorruptRock {
  mesh: THREE.Group;
  position: THREE.Vector3;
  broken: boolean;
}

type BruteState = 'idle' | 'telegraph' | 'charge' | 'stunned';

/**
 * CaracoralBrute
 * ---------------
 * Enemigo grande de la playa oeste: un caracol acorazado corrompido por la
 * Noxia. Su caparazón lo hace invulnerable a los ataques de Mael — pero no
 * es un muro, es una herramienta: si el jugador se coloca en línea con una
 * roca corrupta, el Caracoral embiste, falla… y rompe la roca. Al romper
 * las 3 rocas, la zona se purifica y aparece el Destello del Coral Dormido.
 */
export class CaracoralBrute {
  readonly group = new THREE.Group();
  state: BruteState = 'idle';

  /** Radio de contacto que daña al jugador. */
  readonly touchRadius = 2.4;

  onPlayerHit: ((position: THREE.Vector3) => void) | null = null;
  onRockBroken: ((remaining: number) => void) | null = null;
  onChargeStart: (() => void) | null = null;

  private rocks: CorruptRock[];
  private effects: Effects;
  /** Rectángulo de la isla donde vive (no sale de ahí). */
  private bounds: { minX: number; maxX: number; minZ: number; maxZ: number };

  private chargeDir = new THREE.Vector3();
  private stateTimer = 0;
  private cooldown = 0;
  private time = 0;
  private shell!: THREE.Mesh;

  constructor(
    scene: THREE.Scene,
    effects: Effects,
    position: THREE.Vector3,
    rocks: CorruptRock[],
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  ) {
    this.effects = effects;
    this.rocks = rocks;
    this.bounds = bounds;
    this.buildBody();
    this.group.scale.setScalar(1.8); // arena de 85×50: el bruto impone
    this.group.position.copy(position);
    scene.add(this.group);
  }

  /** Caracol grande: cuerpo arenoso, caparazón en espiral corrupto, ojos en tallos. */
  private buildBody(): void {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd8b878 });
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0x5a3a78, emissive: 0x2a1048, emissiveIntensity: 0.5,
    });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.0, 8, 18), bodyMat);
    body.rotation.x = Math.PI / 2;
    body.position.set(0, 0.55, 0.2);
    body.castShadow = true;
    this.group.add(body);

    // Caparazón en espiral: esferas decrecientes
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(0.85, 20, 16), shellMat);
    this.shell.position.set(0, 1.15, -0.35);
    this.shell.castShadow = true;
    this.group.add(this.shell);
    const swirl1 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 7), shellMat);
    swirl1.position.set(0, 1.55, -0.7);
    this.group.add(swirl1);
    const swirl2 = new THREE.Mesh(new THREE.SphereGeometry(0.26, 7, 6), shellMat);
    swirl2.position.set(0, 1.85, -0.95);
    this.group.add(swirl2);

    // Cristales de Noxia incrustados en el caparazón
    const noxiaMat = new THREE.MeshStandardMaterial({
      color: 0xb25bd6, emissive: 0x7a2fd0, emissiveIntensity: 0.9,
    });
    for (const [x, y, z] of [[0.5, 1.4, -0.3], [-0.5, 1.3, -0.45], [0.15, 1.9, -0.6]] as const) {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), noxiaMat);
      crystal.position.set(x, y, z);
      crystal.rotation.set(Math.random(), Math.random(), 0);
      this.group.add(crystal);
    }

    // Ojos en tallos (lectura cómica pese a ser amenazante)
    for (const side of [-1, 1]) {
      const stalk = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.4, 3, 5), bodyMat);
      stalk.position.set(0.22 * side, 1.15, 0.85);
      stalk.rotation.x = -0.3;
      this.group.add(stalk);
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 8, 7),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      eye.position.set(0.22 * side, 1.42, 0.95);
      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0x551a8a }),
      );
      pupil.position.z = 0.09;
      eye.add(pupil);
      this.group.add(eye);
    }
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  update(dt: number, playerPosition: THREE.Vector3): void {
    this.time += dt;
    this.cooldown = Math.max(this.cooldown - dt, 0);

    const toPlayer = playerPosition.clone().sub(this.group.position).setY(0);
    const playerDist = toPlayer.length();

    // Daño por contacto (salvo aturdido)
    if (this.state !== 'stunned' && playerDist < this.touchRadius &&
        Math.abs(playerPosition.y - this.group.position.y) < 1.6) {
      this.onPlayerHit?.(this.group.position.clone());
    }

    switch (this.state) {
      case 'idle': {
        // Mira lentamente hacia el jugador; embiste si lo tiene cerca y a tiro
        if (playerDist > 0.1) {
          const angle = Math.atan2(toPlayer.x, toPlayer.z);
          this.group.rotation.y += this.shortestDelta(angle) * Math.min(2 * dt, 1);
        }
        const inBounds = this.contains(playerPosition);
        if (inBounds && playerDist < 16 && this.cooldown <= 0) {
          this.state = 'telegraph';
          this.stateTimer = 0.8;
          this.chargeDir.copy(toPlayer).normalize();
        }
        break;
      }
      case 'telegraph': {
        // Temblor: aviso claro de que va a embestir
        this.group.position.x += (Math.random() - 0.5) * 0.04;
        this.group.position.z += (Math.random() - 0.5) * 0.04;
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = 'charge';
          this.stateTimer = 2.4;
          this.onChargeStart?.();
        }
        break;
      }
      case 'charge': {
        this.group.position.addScaledVector(this.chargeDir, 15 * dt);
        this.stateTimer -= dt;

        // ¿Golpeó una roca corrupta? → la rompe (¡así se purifica la zona!)
        for (const rock of this.rocks) {
          if (rock.broken) continue;
          if (this.group.position.distanceTo(rock.position) < 3.6) {
            this.breakRock(rock);
            this.stun();
            return;
          }
        }
        // Borde de la isla o fin de carrera → aturdido
        if (!this.contains(this.group.position) || this.stateTimer <= 0) {
          this.clampToBounds();
          this.stun();
        }
        break;
      }
      case 'stunned': {
        // Tambaleo mareado
        this.group.rotation.z = Math.sin(this.time * 10) * 0.08;
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.group.rotation.z = 0;
          this.state = 'idle';
        }
        break;
      }
    }
  }

  /** El ataque de Mael no lo daña, pero lo provoca: embiste de inmediato. */
  provoke(fromPosition: THREE.Vector3): void {
    if (this.state !== 'idle' || this.cooldown > 0) return;
    const dir = fromPosition.clone().sub(this.group.position).setY(0);
    if (dir.lengthSq() < 0.01) return;
    this.chargeDir.copy(dir.normalize());
    this.state = 'telegraph';
    this.stateTimer = 0.5;
  }

  private breakRock(rock: CorruptRock): void {
    rock.broken = true;
    rock.mesh.visible = false;
    this.effects.burst(rock.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 0xb25bd6, 18, 6);
    const remaining = this.rocks.filter((r) => !r.broken).length;
    this.onRockBroken?.(remaining);
  }

  private stun(): void {
    this.state = 'stunned';
    this.stateTimer = 1.4;
    this.cooldown = 2.2;
  }

  private contains(p: THREE.Vector3): boolean {
    return p.x > this.bounds.minX && p.x < this.bounds.maxX &&
           p.z > this.bounds.minZ && p.z < this.bounds.maxZ;
  }

  private clampToBounds(): void {
    this.group.position.x = THREE.MathUtils.clamp(this.group.position.x, this.bounds.minX, this.bounds.maxX);
    this.group.position.z = THREE.MathUtils.clamp(this.group.position.z, this.bounds.minZ, this.bounds.maxZ);
  }

  private shortestDelta(targetAngle: number): number {
    const delta = targetAngle - this.group.rotation.y;
    return Math.atan2(Math.sin(delta), Math.cos(delta));
  }
}
