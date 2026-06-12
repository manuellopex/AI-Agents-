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
    // Prefijo correcto en local y en GitHub Pages (sprites del kit UI)
    const path = window.location.pathname;
    const idx = path.indexOf('/game');
    const kit = `${idx > 0 ? path.slice(0, idx) : ''}/ui/kit`;

    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:absolute;inset:0;pointer-events:none;z-index:20;touch-action:none;user-select:none;-webkit-user-select:none;';

    // --- Joystick virtual (sprites del kit oficial) ---
    this.stickBase = document.createElement('div');
    this.stickBase.style.cssText =
      'position:absolute;left:24px;bottom:calc(32px + env(safe-area-inset-bottom, 0px));width:124px;height:124px;border-radius:50%;' +
      `background:url("${kit}/joy-base.png") center/contain no-repeat;` +
      'filter:drop-shadow(0 4px 10px rgba(0,20,40,.35));pointer-events:auto;';
    this.stickKnob = document.createElement('div');
    this.stickKnob.style.cssText =
      'position:absolute;left:50%;top:50%;width:58px;height:58px;' +
      `background:url("${kit}/joy-knob.png") center/contain no-repeat;` +
      'transform:translate(-50%,-50%);transition:transform .05s;';
    this.stickBase.appendChild(this.stickKnob);
    this.root.appendChild(this.stickBase);

    // --- Botones de acción del kit: salto (espiral, grande) y ataque (espada) ---
    const jumpBtn = this.makeButton(`${kit}/btn-jump.png`,
      'right:22px;bottom:calc(112px + env(safe-area-inset-bottom, 0px));width:88px;height:88px;');
    const attackBtn = this.makeButton(`${kit}/btn-attack.png`,
      'right:34px;bottom:calc(32px + env(safe-area-inset-bottom, 0px));width:66px;height:66px;');
    jumpBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.jumpQueued = true; this.pressFx(jumpBtn); });
    attackBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.attackQueued = true; this.pressFx(attackBtn); });
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

  private makeButton(spriteUrl: string, extraCss: string): HTMLDivElement {
    const btn = document.createElement('div');
    btn.style.cssText =
      'position:absolute;' +
      `background:url("${spriteUrl}") center/contain no-repeat;` +
      'filter:drop-shadow(0 4px 10px rgba(0,20,40,.35));transition:transform .08s;' +
      'pointer-events:auto;touch-action:none;' + extraCss;
    return btn;
  }

  /** Pequeño feedback de pulsación en los botones. */
  private pressFx(btn: HTMLDivElement): void {
    btn.style.transform = 'scale(0.88)';
    setTimeout(() => { btn.style.transform = 'scale(1)'; }, 90);
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
