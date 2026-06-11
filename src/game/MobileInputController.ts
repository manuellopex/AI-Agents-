/**
 * MobileInputController
 * ----------------------
 * Joystick virtual (abajo-izquierda) + botones de salto y ataque
 * (abajo-derecha). Incluye fallback de teclado (WASD/flechas, Espacio = salto,
 * J/K = ataque) para probar en escritorio.
 *
 * Expone:
 *  - moveX / moveZ: dirección de movimiento en rango [-1, 1]
 *  - consumeJump() / consumeAttack(): eventos de pulsación (edge-triggered)
 */
export class MobileInputController {
  /** Eje horizontal del joystick: -1 izquierda, +1 derecha. */
  moveX = 0;
  /** Eje vertical del joystick: -1 adelante (hacia -Z), +1 atrás. */
  moveZ = 0;

  private jumpQueued = false;
  private attackQueued = false;

  private root: HTMLDivElement;
  private stickBase: HTMLDivElement;
  private stickKnob: HTMLDivElement;
  private joyTouchId: number | null = null;
  private joyCenter = { x: 0, y: 0 };
  private readonly joyRadius = 55;

  private keys = new Set<string>();
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    this.keys.add(e.code);
    if (e.code === 'Space') this.jumpQueued = true;
    if (e.code === 'KeyJ' || e.code === 'KeyK') this.attackQueued = true;
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:absolute;inset:0;pointer-events:none;z-index:20;touch-action:none;user-select:none;-webkit-user-select:none;';

    // --- Joystick virtual ---
    this.stickBase = document.createElement('div');
    this.stickBase.style.cssText =
      'position:absolute;left:24px;bottom:36px;width:130px;height:130px;border-radius:50%;' +
      'background:rgba(255,255,255,.10);border:2px solid rgba(255,255,255,.25);pointer-events:auto;';
    this.stickKnob = document.createElement('div');
    this.stickKnob.style.cssText =
      'position:absolute;left:50%;top:50%;width:56px;height:56px;border-radius:50%;' +
      'background:rgba(255,255,255,.45);transform:translate(-50%,-50%);transition:transform .05s;';
    this.stickBase.appendChild(this.stickKnob);
    this.root.appendChild(this.stickBase);

    // --- Botones de acción ---
    const jumpBtn = this.makeButton('SALTO', 'right:24px;bottom:48px;width:84px;height:84px;background:rgba(80,200,120,.55);');
    const attackBtn = this.makeButton('GIRO', 'right:118px;bottom:120px;width:68px;height:68px;background:rgba(240,110,90,.55);');
    jumpBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.jumpQueued = true; });
    attackBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.attackQueued = true; });
    this.root.appendChild(jumpBtn);
    this.root.appendChild(attackBtn);

    // Eventos táctiles del joystick
    this.stickBase.addEventListener('touchstart', this.onJoyStart, { passive: false });
    window.addEventListener('touchmove', this.onJoyMove, { passive: false });
    window.addEventListener('touchend', this.onJoyEnd);
    window.addEventListener('touchcancel', this.onJoyEnd);
    // Soporte con ratón para pruebas en escritorio
    this.stickBase.addEventListener('mousedown', this.onMouseDown);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    container.appendChild(this.root);
  }

  private makeButton(label: string, extraCss: string): HTMLDivElement {
    const btn = document.createElement('div');
    btn.textContent = label;
    btn.style.cssText =
      'position:absolute;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
      'color:#fff;font:700 13px system-ui;letter-spacing:1px;border:2px solid rgba(255,255,255,.4);' +
      'pointer-events:auto;touch-action:none;' + extraCss;
    return btn;
  }

  // --- Manejo del joystick táctil ---
  private onJoyStart = (e: TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    this.joyTouchId = touch.identifier;
    const rect = this.stickBase.getBoundingClientRect();
    this.joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    this.updateJoy(touch.clientX, touch.clientY);
  };

  private onJoyMove = (e: TouchEvent) => {
    if (this.joyTouchId === null) return;
    for (const touch of Array.from(e.changedTouches)) {
      if (touch.identifier === this.joyTouchId) {
        e.preventDefault();
        this.updateJoy(touch.clientX, touch.clientY);
      }
    }
  };

  private onJoyEnd = (e: TouchEvent) => {
    for (const touch of Array.from(e.changedTouches)) {
      if (touch.identifier === this.joyTouchId) this.resetJoy();
    }
  };

  // --- Joystick con ratón (escritorio) ---
  private onMouseDown = (e: MouseEvent) => {
    const rect = this.stickBase.getBoundingClientRect();
    this.joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    this.updateJoy(e.clientX, e.clientY);
    const move = (ev: MouseEvent) => this.updateJoy(ev.clientX, ev.clientY);
    const up = () => {
      this.resetJoy();
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  private updateJoy(x: number, y: number): void {
    let dx = x - this.joyCenter.x;
    let dy = y - this.joyCenter.y;
    const len = Math.hypot(dx, dy);
    if (len > this.joyRadius) {
      dx = (dx / len) * this.joyRadius;
      dy = (dy / len) * this.joyRadius;
    }
    this.moveX = dx / this.joyRadius;
    this.moveZ = dy / this.joyRadius; // arriba en pantalla = -Z (adelante)
    this.stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  private resetJoy(): void {
    this.joyTouchId = null;
    this.moveX = 0;
    this.moveZ = 0;
    this.stickKnob.style.transform = 'translate(-50%,-50%)';
  }

  /** Mezcla joystick + teclado. Llamar una vez por frame antes de leer ejes. */
  update(): void {
    if (this.joyTouchId === null && (this.keys.size > 0)) {
      let kx = 0, kz = 0;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) kz -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) kz += 1;
      if (kx !== 0 || kz !== 0) {
        const len = Math.hypot(kx, kz);
        this.moveX = kx / len;
        this.moveZ = kz / len;
      } else if (this.joyTouchId === null) {
        this.moveX = 0;
        this.moveZ = 0;
      }
    }
  }

  /** Devuelve true una sola vez por pulsación de salto. */
  consumeJump(): boolean {
    const v = this.jumpQueued;
    this.jumpQueued = false;
    return v;
  }

  /** Devuelve true una sola vez por pulsación de ataque. */
  consumeAttack(): boolean {
    const v = this.attackQueued;
    this.attackQueued = false;
    return v;
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? 'block' : 'none';
  }

  dispose(): void {
    window.removeEventListener('touchmove', this.onJoyMove);
    window.removeEventListener('touchend', this.onJoyEnd);
    window.removeEventListener('touchcancel', this.onJoyEnd);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.root.remove();
  }
}
