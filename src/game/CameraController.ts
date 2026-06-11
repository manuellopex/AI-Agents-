import * as THREE from 'three';

/**
 * CameraController
 * -----------------
 * Cámara en tercera persona pensada para pantalla vertical 9:16:
 *  - Sigue al jugador con suavizado (sin movimientos bruscos)
 *  - Elevada y detrás del personaje
 *  - El punto de mira está adelantado, de modo que el personaje queda en el
 *    tercio inferior de la pantalla y se ve mucho espacio por delante.
 */
export class CameraController {
  readonly camera: THREE.PerspectiveCamera;

  /** Offset de la cámara respecto al jugador (elevada y detrás). */
  private readonly offset = new THREE.Vector3(0, 7.5, 8.5);
  /** El lookAt apunta por delante y por encima del jugador. */
  private readonly lookAhead = new THREE.Vector3(0, 2.2, -5.5);
  private readonly followLerp = 4; // velocidad de suavizado

  private currentPos = new THREE.Vector3();
  private currentLook = new THREE.Vector3();
  private initialized = false;

  constructor(aspect: number) {
    // FOV alto para formato vertical: compensa el encuadre estrecho
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 200);
  }

  /** Coloca la cámara instantáneamente (al iniciar o tras un respawn). */
  snapTo(target: THREE.Vector3): void {
    this.currentPos.copy(target).add(this.offset);
    this.currentLook.copy(target).add(this.lookAhead);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLook);
    this.initialized = true;
  }

  update(dt: number, target: THREE.Vector3): void {
    if (!this.initialized) {
      this.snapTo(target);
      return;
    }
    const desiredPos = target.clone().add(this.offset);
    const desiredLook = target.clone().add(this.lookAhead);
    // Lerp exponencial independiente del framerate
    const t = 1 - Math.exp(-this.followLerp * dt);
    this.currentPos.lerp(desiredPos, t);
    this.currentLook.lerp(desiredLook, t);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLook);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
