import * as THREE from 'three';
import type { Speaker } from './UIManager';

/** Un plano de cutscene: movimiento de cámara + diálogo + acciones. */
export interface Shot {
  /** Duración del plano en segundos. */
  duration: number;
  /** Posición de cámara inicial/final (si falta from, continúa desde donde esté). */
  camFrom?: THREE.Vector3;
  camTo: THREE.Vector3;
  /** Punto de mira inicial/final. */
  lookFrom?: THREE.Vector3;
  lookTo: THREE.Vector3;
  /** Línea de diálogo mostrada al empezar el plano. */
  dialogue?: { speaker: Speaker; text: string };
  /** Acción ejecutada al empezar el plano (VFX, sonidos, estado del mundo). */
  onStart?: () => void;
}

/**
 * CutsceneSystem
 * ---------------
 * Secuenciador de cinemáticas: toma el control de la cámara y reproduce una
 * lista de planos con easing suave, diálogos sincronizados y acciones de
 * mundo. Saltable: al saltar se ejecutan las acciones pendientes (para no
 * dejar el estado a medias) y se llama a onComplete.
 *
 * Sigue las reglas del LDD §6: ritmo épico y claro, sin interrumpir de más
 * y sin alargar la cinemática.
 */
export class CutsceneSystem {
  /** true mientras hay una cutscene reproduciéndose. */
  active = false;

  private camera: THREE.PerspectiveCamera;
  private say: (speaker: Speaker, text: string, duration?: number) => void;

  private shots: Shot[] = [];
  private shotIndex = 0;
  private shotTime = 0;
  private onComplete: (() => void) | null = null;

  private fromPos = new THREE.Vector3();
  private toPos = new THREE.Vector3();
  private fromLook = new THREE.Vector3();
  private toLook = new THREE.Vector3();
  private currentLook = new THREE.Vector3();

  constructor(
    camera: THREE.PerspectiveCamera,
    say: (speaker: Speaker, text: string, duration?: number) => void,
  ) {
    this.camera = camera;
    this.say = say;
  }

  /** Reproduce una secuencia de planos. */
  play(shots: Shot[], onComplete: () => void): void {
    if (shots.length === 0) {
      onComplete();
      return;
    }
    this.shots = shots;
    this.shotIndex = -1;
    this.onComplete = onComplete;
    this.active = true;
    this.advance();
  }

  /** Salta la cutscene: ejecuta las acciones restantes y termina. */
  skip(): void {
    if (!this.active) return;
    for (let i = this.shotIndex + 1; i < this.shots.length; i++) {
      this.shots[i].onStart?.();
    }
    this.finish();
  }

  private advance(): void {
    this.shotIndex++;
    if (this.shotIndex >= this.shots.length) {
      this.finish();
      return;
    }
    const shot = this.shots[this.shotIndex];
    this.shotTime = 0;
    // La cámara continúa desde donde está si el plano no define origen
    this.fromPos.copy(shot.camFrom ?? this.camera.position);
    this.toPos.copy(shot.camTo);
    this.fromLook.copy(shot.lookFrom ?? (this.shotIndex === 0 ? shot.lookTo : this.currentLook));
    this.toLook.copy(shot.lookTo);
    if (shot.dialogue) {
      this.say(shot.dialogue.speaker, shot.dialogue.text, shot.duration * 1000 + 600);
    }
    shot.onStart?.();
  }

  private finish(): void {
    this.active = false;
    this.shots = [];
    const done = this.onComplete;
    this.onComplete = null;
    done?.();
  }

  update(dt: number): void {
    if (!this.active) return;
    const shot = this.shots[this.shotIndex];
    this.shotTime += dt;
    const t = Math.min(this.shotTime / shot.duration, 1);
    // Easing suave (smoothstep): sin arrancones ni frenazos
    const e = t * t * (3 - 2 * t);
    this.camera.position.lerpVectors(this.fromPos, this.toPos, e);
    this.currentLook.lerpVectors(this.fromLook, this.toLook, e);
    this.camera.lookAt(this.currentLook);
    if (t >= 1) this.advance();
  }
}
