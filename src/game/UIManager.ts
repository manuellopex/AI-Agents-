/** Voces del juego: cada una con su color de burbuja. */
export type Speaker = 'Oryn' | 'Mael' | 'Elaria' | 'Liora' | 'Quirí';

const SPEAKER_COLORS: Record<Speaker, string> = {
  Oryn: '#7de8c3',   // menta, la criatura transformada
  Mael: '#2aa6a0',   // teal, el aventurero
  Elaria: '#b89ae8', // violeta, la guardiana espiritual
  Liora: '#ffd34d',  // dorado, el Primer Destello
  'Quirí': '#ffe28a', // ámbar, las criaturas cantoras
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
  private destelloCounter!: HTMLDivElement;
  private questCard!: HTMLDivElement;
  private banner!: HTMLDivElement;
  private bannerTimeout: ReturnType<typeof setTimeout> | null = null;
  private mikoBubble!: HTMLDivElement;
  private mikoTimeout: ReturnType<typeof setTimeout> | null = null;
  private overlay: HTMLDivElement | null = null;

  onPause: (() => void) | null = null;
  onResume: (() => void) | null = null;
  onRestart: (() => void) | null = null;
  onStart: (() => void) | null = null;
  /** Seguir explorando tras activar el Faro (completismo). */
  onContinue: (() => void) | null = null;

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

    // Contador de Destellos (objetivo principal, dorado y prominente)
    this.destelloCounter = document.createElement('div');
    this.destelloCounter.style.cssText =
      'position:absolute;top:52px;left:14px;color:#ffe9b8;font-weight:800;font-size:17px;' +
      'background:rgba(60,40,5,.55);padding:5px 14px;border-radius:18px;border:1px solid rgba(255,211,77,.7);' +
      'backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);';
    this.destelloCounter.textContent = '✦ 0 / 6';
    this.root.appendChild(this.destelloCounter);

    // Contador de Lumas (moneda / coleccionable secundario)
    this.lumaCounter = document.createElement('div');
    this.lumaCounter.style.cssText =
      'position:absolute;top:90px;left:14px;color:#fff;font-weight:700;font-size:14px;' +
      'background:rgba(10,40,60,.5);padding:4px 12px;border-radius:16px;border:1px solid rgba(120,230,255,.55);' +
      'backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);';
    this.lumaCounter.textContent = '🔹 0';
    this.root.appendChild(this.lumaCounter);

    // Tarjeta de objetivo activo (arriba-derecha, bajo la pausa)
    this.questCard = document.createElement('div');
    this.questCard.style.cssText =
      'position:absolute;top:64px;right:14px;max-width:48%;color:#ffe9b8;font-size:12px;line-height:1.45;' +
      'background:rgba(10,40,60,.5);padding:8px 12px;border-radius:12px;border:1px solid rgba(255,211,77,.45);' +
      'backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);text-align:left;';
    this.root.appendChild(this.questCard);
    this.setObjective('Explora los 3 caminos y reúne <b>3 Destellos de Auralis</b>');

    // Banner central para Destellos conseguidos
    this.banner = document.createElement('div');
    this.banner.style.cssText =
      'position:absolute;top:34%;left:50%;transform:translateX(-50%) scale(0.8);max-width:84%;text-align:center;' +
      'color:#ffd34d;font-weight:900;font-size:22px;text-shadow:0 3px 8px rgba(0,0,0,.5);' +
      'opacity:0;transition:opacity .3s, transform .3s;pointer-events:none;';
    this.root.appendChild(this.banner);

    // Botón de pausa (cristal redondeado)
    const pauseBtn = document.createElement('div');
    pauseBtn.textContent = '⏸';
    pauseBtn.style.cssText =
      'position:absolute;top:12px;right:14px;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;' +
      'justify-content:center;font-size:20px;color:#fff;background:rgba(255,255,255,.16);border:1.5px solid rgba(255,255,255,.45);' +
      'backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);pointer-events:auto;';
    pauseBtn.addEventListener('pointerdown', () => this.onPause?.());
    this.root.appendChild(pauseBtn);

    // Burbuja de diálogo compartida (Oryn, Mael, Elaria)
    this.mikoBubble = document.createElement('div');
    this.mikoBubble.style.cssText =
      'position:absolute;top:158px;left:50%;transform:translateX(-50%);max-width:78%;color:#1b3a44;background:#fdf6e0;' +
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

  setLumas(amount: number): void {
    this.lumaCounter.textContent = `🔹 ${amount}`;
  }

  setDestellos(count: number, total: number): void {
    this.destelloCounter.textContent = `✦ ${count} / ${total}`;
  }

  /** Actualiza la tarjeta de objetivo activo (admite HTML simple). */
  setObjective(html: string): void {
    this.questCard.innerHTML =
      `<b style="color:#ffd34d;">✦ Costa Brillante</b><br>${html}`;
  }

  /** Banner central: "¡Destello conseguido!". */
  showBanner(text: string, duration = 2800): void {
    this.banner.textContent = text;
    this.banner.style.opacity = '1';
    this.banner.style.transform = 'translateX(-50%) scale(1)';
    if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
    this.bannerTimeout = setTimeout(() => {
      this.banner.style.opacity = '0';
      this.banner.style.transform = 'translateX(-50%) scale(0.8)';
    }, duration);
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
       <p style="max-width:320px;font-size:14px;line-height:1.55;color:#d8eef5;">
         La Noxia apagó el <b style="color:#ffd34d">Faro del Alba</b>. Explora la costa,
         consigue <b style="color:#ffd34d">3 Destellos de Auralis</b> (de 6 escondidos en
         retos distintos) y vuelve al faro para encenderlo. Los <b style="color:#9fe8ff">Lumas</b>
         son tu moneda: recógelos por el camino.</p>
       <p style="max-width:300px;font-size:12px;font-style:italic;color:#a8c8d8;">
         «La luz no estaba perdida. Solo esperaba que alguien la reuniera.»</p>`,
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

  /** Pantalla de progreso al activar el Faro del Alba. */
  showFaroScreen(rows: { nombre: string; estado: 'completado' | 'pendiente' | 'bloqueado' }[], lumas: number): void {
    const icons = { completado: '✦', pendiente: '◇', bloqueado: '🔒' } as const;
    const colors = { completado: '#ffd34d', pendiente: '#9fd8e8', bloqueado: '#7a8a99' } as const;
    const list = rows.map((r) =>
      `<div style="color:${colors[r.estado]};font-size:14px;line-height:1.7;">${icons[r.estado]} ${r.nombre}</div>`,
    ).join('');
    this.showOverlay(
      `<h1 style="font-size:28px;color:#ffd34d;">¡El Faro del Alba brilla!</h1>
       <p style="font-size:13px;color:#c7b3ea;font-style:italic;">Elaria: «La luz no estaba perdida. Solo esperaba que alguien la reuniera.»</p>
       <div style="background:rgba(255,255,255,.06);border-radius:14px;padding:12px 22px;text-align:left;">${list}</div>
       <p style="font-size:15px;">🔹 Lumas: <b>${lumas}</b></p>
       <p style="font-size:12px;color:#9fd8e8;">El camino a la Selva del Canto se ha desbloqueado (próximo capítulo).</p>`,
      [
        { label: 'Seguir explorando', action: () => this.onContinue?.() },
        { label: 'Jugar de nuevo', action: () => this.onRestart?.() },
      ],
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
