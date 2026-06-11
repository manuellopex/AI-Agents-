/** Voces del juego: cada una con su color de burbuja. */
export type Speaker = 'Oryn' | 'Mael' | 'Elaria' | 'Liora';

const SPEAKER_COLORS: Record<Speaker, string> = {
  Oryn: '#7de8c3',   // menta, la criatura transformada
  Mael: '#2aa6a0',   // teal, el aventurero
  Elaria: '#b89ae8', // violeta, la guardiana espiritual
  Liora: '#ffd34d',  // dorado, el Primer Destello
};

/**
 * UIManager
 * ----------
 * Toda la interfaz móvil en DOM superpuesto al canvas:
 *  - Corazones de vida (arriba-izquierda)
 *  - Contador de Lumas (arriba-centro)
 *  - Botón de pausa (arriba-derecha)
 *  - Burbujas de diálogo (Oryn, Mael, Elaria) para humor y guía
 *  - Pantallas: inicio, pausa, victoria y derrota
 */
export class UIManager {
  private root: HTMLDivElement;
  private hearts: HTMLSpanElement[] = [];
  private lumaCounter!: HTMLDivElement;
  private mikoBubble!: HTMLDivElement;
  private mikoTimeout: ReturnType<typeof setTimeout> | null = null;
  private overlay: HTMLDivElement | null = null;

  onPause: (() => void) | null = null;
  onResume: (() => void) | null = null;
  onRestart: (() => void) | null = null;
  onStart: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:absolute;inset:0;pointer-events:none;z-index:30;font-family:system-ui,sans-serif;user-select:none;-webkit-user-select:none;';
    container.appendChild(this.root);

    this.buildHud();
  }

  private buildHud(): void {
    // Corazones (vida)
    const heartsBox = document.createElement('div');
    heartsBox.style.cssText = 'position:absolute;top:14px;left:14px;display:flex;gap:6px;font-size:26px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.4));';
    for (let i = 0; i < 3; i++) {
      const heart = document.createElement('span');
      heart.textContent = '❤️';
      heartsBox.appendChild(heart);
      this.hearts.push(heart);
    }
    this.root.appendChild(heartsBox);

    // Contador de Lumas
    this.lumaCounter = document.createElement('div');
    this.lumaCounter.style.cssText =
      'position:absolute;top:16px;left:50%;transform:translateX(-50%);color:#fff;font-weight:800;font-size:20px;' +
      'background:rgba(10,40,60,.55);padding:6px 16px;border-radius:20px;border:1px solid rgba(120,230,255,.5);';
    this.lumaCounter.textContent = '🔹 0 / 0';
    this.root.appendChild(this.lumaCounter);

    // Botón de pausa
    const pauseBtn = document.createElement('div');
    pauseBtn.textContent = '⏸';
    pauseBtn.style.cssText =
      'position:absolute;top:12px;right:14px;width:44px;height:44px;border-radius:12px;display:flex;align-items:center;' +
      'justify-content:center;font-size:22px;color:#fff;background:rgba(10,40,60,.55);border:1px solid rgba(255,255,255,.35);pointer-events:auto;';
    pauseBtn.addEventListener('pointerdown', () => this.onPause?.());
    this.root.appendChild(pauseBtn);

    // Burbuja de diálogo compartida (Oryn, Mael, Elaria)
    this.mikoBubble = document.createElement('div');
    this.mikoBubble.style.cssText =
      'position:absolute;top:72px;left:50%;transform:translateX(-50%);max-width:78%;color:#1b3a44;background:#fdf6e0;' +
      'padding:10px 16px;border-radius:16px;border:2px solid #7de8c3;font-size:14px;font-weight:600;text-align:center;' +
      'opacity:0;transition:opacity .3s;box-shadow:0 4px 12px rgba(0,0,0,.25);';
    this.root.appendChild(this.mikoBubble);
  }

  setHealth(health: number): void {
    this.hearts.forEach((heart, i) => {
      heart.style.opacity = i < health ? '1' : '0.25';
      heart.style.filter = i < health ? 'none' : 'grayscale(1)';
    });
  }

  setLumas(collected: number, total: number): void {
    this.lumaCounter.textContent = `🔹 ${collected} / ${total}`;
  }

  /** Muestra una frase de un personaje durante unos segundos. */
  say(speaker: Speaker, text: string, duration = 3500): void {
    this.mikoBubble.textContent = `${speaker}: «${text}»`;
    this.mikoBubble.style.borderColor = SPEAKER_COLORS[speaker];
    this.mikoBubble.style.opacity = '1';
    if (this.mikoTimeout) clearTimeout(this.mikoTimeout);
    this.mikoTimeout = setTimeout(() => {
      this.mikoBubble.style.opacity = '0';
    }, duration);
  }

  // ---------- Pantallas completas ----------

  private showOverlay(html: string, buttons: { label: string; action: () => void }[]): void {
    this.hideOverlay();
    this.overlay = document.createElement('div');
    this.overlay.style.cssText =
      'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;' +
      'background:rgba(8,25,40,.82);color:#fff;text-align:center;pointer-events:auto;padding:24px;';
    this.overlay.innerHTML = html;
    for (const btn of buttons) {
      const el = document.createElement('button');
      el.textContent = btn.label;
      el.style.cssText =
        'pointer-events:auto;font:700 18px system-ui;color:#10303d;background:linear-gradient(180deg,#8ff0d0,#4ec9a0);' +
        'border:none;border-radius:14px;padding:14px 38px;box-shadow:0 4px 0 #2e8f70;';
      el.addEventListener('pointerdown', () => btn.action());
      this.overlay.appendChild(el);
    }
    this.root.appendChild(this.overlay);
  }

  hideOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  showStartScreen(): void {
    this.showOverlay(
      `<div style="font-size:14px;letter-spacing:4px;color:#7de8c3;">MAEL &amp; ORYN</div>
       <h1 style="margin:4px 0;font-size:30px;color:#ffd34d;text-shadow:0 3px 0 rgba(0,0,0,.35);">El Primer Destello</h1>
       <div style="font-size:13px;letter-spacing:2px;color:#9fd8e8;">CAPÍTULO 1 · COSTA BRILLANTE</div>
       <p style="max-width:310px;font-size:14px;line-height:1.55;color:#d8eef5;">
         La explosión de <b style="color:#c79ae8">Noxia</b> dispersó los Lumas por Isla Auria
         y transformó a <b>Oryn</b>. Acompaña a <b>Mael</b>: recupera los Lumas,
         esquiva a los Grubs corrompidos y sigue la luz de <b style="color:#ffd34d">Liora</b>
         hasta el tótem antiguo.</p>
       <p style="max-width:300px;font-size:12px;font-style:italic;color:#a8c8d8;">
         «La luz más pequeña puede convertirse en la razón más grande para salvar un mundo.»</p>`,
      [{ label: '▶ Jugar', action: () => this.onStart?.() }],
    );
  }

  showPauseScreen(): void {
    this.showOverlay(
      '<h1 style="font-size:30px;color:#ffd34d;">Pausa</h1>',
      [
        { label: 'Continuar', action: () => this.onResume?.() },
        { label: 'Reiniciar nivel', action: () => this.onRestart?.() },
      ],
    );
  }

  showVictoryScreen(lumas: number, total: number): void {
    this.showOverlay(
      `<h1 style="font-size:32px;color:#ffd34d;">¡Capítulo completado!</h1>
       <p style="font-size:20px;">🔹 Lumas: <b>${lumas} / ${total}</b></p>
       <p style="font-size:14px;color:#a8dcc8;">Oryn: «¡Lo logramos! Bueno… lo logré yo. Tú ayudaste.»</p>
       <p style="font-size:13px;color:#c7b3ea;">Elaria: «La luz vuelve a la costa. La Selva del Canto os espera…»</p>`,
      [{ label: 'Jugar de nuevo', action: () => this.onRestart?.() }],
    );
  }

  showDefeatScreen(): void {
    this.showOverlay(
      `<h1 style="font-size:32px;color:#ff7d6b;">¡Ay no!</h1>
       <p style="font-size:14px;color:#d8eef5;">Oryn: «Eso tuvo que doler. ¡Otra vez, con más estilo!»</p>`,
      [{ label: 'Reintentar', action: () => this.onRestart?.() }],
    );
  }

  dispose(): void {
    if (this.mikoTimeout) clearTimeout(this.mikoTimeout);
    this.root.remove();
  }
}
