/** Voces del juego: cada una con su color de burbuja. */
export type Speaker = 'Oryn' | 'Mael' | 'Elaria' | 'Liora' | 'Quirí';

/**
 * Paleta oficial de UI (Guía visual de UI/UX de Mael & Oryn):
 * teal = Auralis/guía · dorado = Destellos/recompensa · coral = daño/acción
 * violeta = Noxia/peligro · crema/arena = paneles narrativos.
 */
const COLOR = {
  deepTeal: '#072B37',
  auralis: '#1ECBCD',
  gold: '#F6C04A',
  sand: '#F6DFB4',
  coral: '#EE7858',
  noxia: '#7B42B4',
  cream: '#FFF8E6',
  purified: '#5BBE7E',
};

/** Panel de "vidrio oscuro pulido" (regla de materiales de la guía). */
const GLASS =
  `background:rgba(7,43,55,.62);border:1px solid rgba(30,203,205,.45);` +
  'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);' +
  'box-shadow:0 4px 14px rgba(0,10,20,.3);';

const SPEAKER_COLORS: Record<Speaker, string> = {
  Oryn: '#7de8c3',
  Mael: '#2aa6a0',
  Elaria: '#b89ae8',
  Liora: COLOR.gold,
  'Quirí': '#ffe28a',
};

export interface DestelloRow {
  nombre: string;
  tipo: string;
  estado: 'completado' | 'pendiente' | 'bloqueado';
  /** Posición en el mundo (para el mini-mapa). */
  x: number;
  z: number;
}

/**
 * UIManager
 * ----------
 * HUD móvil siguiendo la Guía visual de UI/UX: paneles de vidrio teal
 * oscuro, Destellos en dorado como progreso principal, Lumas como moneda
 * secundaria, objetivo "región + verbo", toast contextual de Oryn, flash
 * coral de daño, vignette violeta de Noxia, pausa con misiones + mini-mapa
 * y pantalla de zona completada con porcentaje.
 */
export class UIManager {
  private root: HTMLDivElement;
  private hearts: HTMLSpanElement[] = [];
  private heartsBox!: HTMLDivElement;
  private lumaCounter!: HTMLDivElement;
  private destelloCounter!: HTMLDivElement;
  private questCard!: HTMLDivElement;
  private banner!: HTMLDivElement;
  private bannerTimeout: ReturnType<typeof setTimeout> | null = null;
  private orynToast!: HTMLDivElement;
  private orynToastTimeout: ReturnType<typeof setTimeout> | null = null;
  private dialogue!: HTMLDivElement;
  private dialogueTimeout: ReturnType<typeof setTimeout> | null = null;
  private damageOverlay!: HTMLDivElement;
  private noxiaOverlay!: HTMLDivElement;
  private overlay: HTMLDivElement | null = null;

  onPause: (() => void) | null = null;
  onResume: (() => void) | null = null;
  onRestart: (() => void) | null = null;
  onStart: (() => void) | null = null;
  onContinue: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:absolute;inset:0;pointer-events:none;z-index:30;font-family:system-ui,sans-serif;user-select:none;-webkit-user-select:none;';
    container.appendChild(this.root);
    this.injectKeyframes();
    this.buildHud();
  }

  private injectKeyframes(): void {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes mo-heart-hit { 0%{transform:scale(1)} 30%{transform:scale(1.35) rotate(-8deg)} 60%{transform:scale(.9) rotate(6deg)} 100%{transform:scale(1)} }
      @keyframes mo-flash { 0%{opacity:.85} 100%{opacity:0} }
      @keyframes mo-toast-in { 0%{transform:translateX(-50%) translateY(12px);opacity:0} 100%{transform:translateX(-50%) translateY(0);opacity:1} }
    `;
    this.root.appendChild(style);
  }

  private buildHud(): void {
    // Vida: corazones grandes arriba-izquierda con animación de golpe
    this.heartsBox = document.createElement('div');
    this.heartsBox.style.cssText =
      'position:absolute;top:14px;left:14px;display:flex;gap:6px;font-size:27px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.4));';
    for (let i = 0; i < 3; i++) {
      const heart = document.createElement('span');
      heart.textContent = '❤️';
      this.heartsBox.appendChild(heart);
      this.hearts.push(heart);
    }
    this.root.appendChild(this.heartsBox);

    // Destellos: progreso principal (dorado, prominente) — "2/3" como la guía
    this.destelloCounter = document.createElement('div');
    this.destelloCounter.style.cssText =
      `position:absolute;top:54px;left:14px;color:${COLOR.gold};font-weight:800;font-size:17px;${GLASS}` +
      `border-color:rgba(246,192,74,.65);padding:5px 14px;border-radius:18px;`;
    this.destelloCounter.textContent = '⭐ 0/3';
    this.root.appendChild(this.destelloCounter);

    // Lumas: moneda secundaria (no compite con los Destellos)
    this.lumaCounter = document.createElement('div');
    this.lumaCounter.style.cssText =
      `position:absolute;top:94px;left:14px;color:${COLOR.cream};font-weight:700;font-size:14px;${GLASS}` +
      'padding:4px 12px;border-radius:16px;';
    this.lumaCounter.textContent = '🔹 0';
    this.root.appendChild(this.lumaCounter);

    // Objetivo activo: región + verbo claro (arriba-derecha)
    this.questCard = document.createElement('div');
    this.questCard.style.cssText =
      `position:absolute;top:64px;right:14px;max-width:48%;color:${COLOR.cream};font-size:12px;line-height:1.5;${GLASS}` +
      'padding:8px 12px;border-radius:12px;text-align:left;';
    this.root.appendChild(this.questCard);
    this.setObjective('Reúne <b>3 Destellos de Auralis</b>');

    // Toast contextual de Oryn (desaparece rápido, no pausa el juego)
    this.orynToast = document.createElement('div');
    this.orynToast.style.cssText =
      `position:absolute;bottom:212px;left:50%;transform:translateX(-50%);color:#06343c;font-weight:700;font-size:13px;` +
      `background:${COLOR.auralis};padding:7px 16px;border-radius:18px;box-shadow:0 4px 12px rgba(0,20,30,.35);` +
      'opacity:0;pointer-events:none;white-space:nowrap;';
    this.root.appendChild(this.orynToast);

    // Banner central (Destellos / zona purificada): 2-3 s, no bloquea input
    this.banner = document.createElement('div');
    this.banner.style.cssText =
      'position:absolute;top:33%;left:50%;transform:translateX(-50%) scale(0.85);max-width:84%;text-align:center;' +
      `color:${COLOR.gold};font-weight:900;font-size:22px;text-shadow:0 3px 8px rgba(0,0,0,.55);` +
      'opacity:0;transition:opacity .3s, transform .3s;pointer-events:none;';
    this.root.appendChild(this.banner);

    // Pausa: pequeña, lejos de los controles táctiles
    const pauseBtn = document.createElement('div');
    pauseBtn.textContent = '⏸';
    pauseBtn.style.cssText =
      `position:absolute;top:12px;right:14px;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;` +
      `justify-content:center;font-size:20px;color:${COLOR.cream};${GLASS}pointer-events:auto;`;
    pauseBtn.addEventListener('pointerdown', () => this.onPause?.());
    this.root.appendChild(pauseBtn);

    // Caja de diálogo: panel crema/pergamino (cálido, narrativo)
    this.dialogue = document.createElement('div');
    this.dialogue.style.cssText =
      `position:absolute;top:150px;left:50%;transform:translateX(-50%);max-width:78%;color:#1b3a44;background:${COLOR.cream};` +
      'padding:10px 16px;border-radius:16px;border:2px solid #7de8c3;font-size:14px;font-weight:600;text-align:center;' +
      'opacity:0;transition:opacity .3s;box-shadow:0 4px 12px rgba(0,0,0,.25);';
    this.root.appendChild(this.dialogue);

    // Flash coral de daño en los bordes de la pantalla
    this.damageOverlay = document.createElement('div');
    this.damageOverlay.style.cssText =
      `position:absolute;inset:0;pointer-events:none;opacity:0;` +
      `box-shadow:inset 0 0 70px 24px ${COLOR.coral};`;
    this.root.appendChild(this.damageOverlay);

    // Vignette violeta sutil: Noxia cerca
    this.noxiaOverlay = document.createElement('div');
    this.noxiaOverlay.style.cssText =
      `position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .8s;` +
      `box-shadow:inset 0 0 90px 30px ${COLOR.noxia}55;`;
    this.root.appendChild(this.noxiaOverlay);
  }

  // ---------- Estado del HUD ----------

  setHealth(health: number, animateHit = false): void {
    this.hearts.forEach((heart, i) => {
      heart.style.opacity = i < health ? '1' : '0.25';
      heart.style.filter = i < health ? 'none' : 'grayscale(1)';
    });
    if (animateHit) {
      this.heartsBox.style.animation = 'none';
      void this.heartsBox.offsetWidth; // reinicia la animación
      this.heartsBox.style.animation = 'mo-heart-hit .4s ease';
      this.damageOverlay.style.animation = 'none';
      void this.damageOverlay.offsetWidth;
      this.damageOverlay.style.animation = 'mo-flash .5s ease-out';
    }
  }

  setLumas(amount: number): void {
    this.lumaCounter.textContent = `🔹 ${amount}`;
  }

  /** Muestra el progreso hacia el requisito (2/3); tras el faro, sobre 6. */
  setDestellos(count: number, required: number, total?: number): void {
    this.destelloCounter.textContent = total
      ? `⭐ ${count}/${total}`
      : `⭐ ${Math.min(count, required)}/${required}`;
  }

  setObjective(html: string): void {
    this.questCard.innerHTML =
      `<b style="color:${COLOR.gold};">✦ Costa Brillante</b><br>${html}`;
  }

  /** Vignette de peligro Noxia (activo cerca de zonas corruptas). */
  setNoxiaNearby(active: boolean): void {
    this.noxiaOverlay.style.opacity = active ? '1' : '0';
  }

  /** Toast contextual: «Oryn detecta un secreto cerca». */
  showOrynToast(text = '🐾 Oryn detecta un secreto cerca'): void {
    this.orynToast.textContent = text;
    this.orynToast.style.animation = 'mo-toast-in .25s ease-out';
    this.orynToast.style.opacity = '1';
    if (this.orynToastTimeout) clearTimeout(this.orynToastTimeout);
    this.orynToastTimeout = setTimeout(() => {
      this.orynToast.style.opacity = '0';
    }, 3000);
  }

  /** Banner central. color: 'gold' (Destello) | 'purified' | 'auralis'. */
  showBanner(text: string, color: 'gold' | 'purified' | 'auralis' = 'gold', duration = 2800): void {
    this.banner.textContent = text;
    this.banner.style.color = color === 'gold' ? COLOR.gold : color === 'purified' ? COLOR.purified : COLOR.auralis;
    this.banner.style.opacity = '1';
    this.banner.style.transform = 'translateX(-50%) scale(1)';
    if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
    this.bannerTimeout = setTimeout(() => {
      this.banner.style.opacity = '0';
      this.banner.style.transform = 'translateX(-50%) scale(0.85)';
    }, duration);
  }

  /** Diálogo corto con nombre del personaje (panel crema narrativo). */
  say(speaker: Speaker, text: string, duration = 3500): void {
    this.dialogue.textContent = `${speaker}: «${text}»`;
    this.dialogue.style.borderColor = SPEAKER_COLORS[speaker];
    this.dialogue.style.opacity = '1';
    if (this.dialogueTimeout) clearTimeout(this.dialogueTimeout);
    this.dialogueTimeout = setTimeout(() => {
      this.dialogue.style.opacity = '0';
    }, duration);
  }

  // ---------- Pantallas completas ----------

  private showOverlay(html: string, buttons: { label: string; action: () => void; secondary?: boolean }[]): void {
    this.hideOverlay();
    this.overlay = document.createElement('div');
    this.overlay.style.cssText =
      'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;' +
      `background:rgba(4,24,32,.88);color:${COLOR.cream};text-align:center;pointer-events:auto;padding:24px;overflow-y:auto;`;
    this.overlay.innerHTML = html;
    for (const btn of buttons) {
      const el = document.createElement('button');
      el.textContent = btn.label;
      // Botón primario dorado / secundario teal (componentes base de la guía)
      el.style.cssText = btn.secondary
        ? `pointer-events:auto;font:700 15px system-ui;color:${COLOR.cream};background:rgba(30,203,205,.18);` +
          `border:1.5px solid ${COLOR.auralis};border-radius:14px;padding:11px 30px;`
        : `pointer-events:auto;font:800 17px system-ui;color:#3a2a00;background:linear-gradient(180deg,#ffd97a,${COLOR.gold});` +
          'border:none;border-radius:14px;padding:13px 36px;box-shadow:0 4px 0 #b8862a;';
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
       <h1 style="margin:4px 0;font-size:30px;color:${COLOR.gold};text-shadow:0 3px 0 rgba(0,0,0,.35);">El Primer Destello</h1>
       <div style="font-size:13px;letter-spacing:2px;color:#9fd8e8;">CAPÍTULO 1 · COSTA BRILLANTE</div>
       <p style="max-width:320px;font-size:14px;line-height:1.55;color:#d8eef5;">
         Consigue <b style="color:${COLOR.gold}">3 Destellos de Auralis</b> para encender el
         <b style="color:${COLOR.gold}">Faro del Alba</b>. Explora los 3 caminos: cada Destello
         es un reto distinto. Los <b style="color:#9fe8ff">Lumas</b> son tu moneda.</p>
       <p style="max-width:300px;font-size:12px;font-style:italic;color:#a8c8d8;">
         «La luz no estaba perdida. Solo esperaba que alguien la reuniera.»</p>`,
      [{ label: '▶ Jugar', action: () => this.onStart?.() }],
    );
  }

  /** Pausa con resumen de progreso, misiones y mini-mapa (guía §10-11). */
  showPauseScreen(rows: DestelloRow[], lumas: number, playerX: number, playerZ: number): void {
    const missions = rows.map((r) => {
      const icon = r.estado === 'completado' ? '⭐' : r.estado === 'pendiente' ? '◇' : '🔒';
      const color = r.estado === 'completado' ? COLOR.gold : r.estado === 'pendiente' ? '#9fd8e8' : '#6a7a88';
      return `<div style="color:${color};font-size:13px;line-height:1.7;text-align:left;">${icon} ${r.nombre}
        <span style="opacity:.65;font-size:11px;"> · ${r.tipo}</span></div>`;
    }).join('');

    this.showOverlay(
      `<h1 style="font-size:26px;color:${COLOR.gold};margin:0;">Pausa</h1>
       <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;justify-content:center;">
         <div style="${GLASS}border-radius:14px;padding:12px 16px;max-width:240px;">
           <div style="font-size:12px;letter-spacing:2px;color:#9fd8e8;margin-bottom:6px;">MISIONES</div>
           ${missions}
           <div style="margin-top:8px;color:${COLOR.cream};font-size:13px;">🔹 Lumas: <b>${lumas}</b></div>
         </div>
         ${this.buildMap(rows, playerX, playerZ)}
       </div>`,
      [
        { label: 'Continuar', action: () => this.onResume?.() },
        { label: 'Reiniciar nivel', action: () => this.onRestart?.(), secondary: true },
      ],
    );
  }

  /** Mini-mapa de Costa Brillante con marcadores de Destellos y jugador. */
  private buildMap(rows: DestelloRow[], playerX: number, playerZ: number): string {
    // Mundo: x ∈ [-55, 55], z ∈ [-58, 30] → mapa 190×150
    const W = 190; const H = 150;
    const mx = (x: number) => ((x + 55) / 110) * W;
    const mz = (z: number) => ((z + 58) / 88) * H;
    const dots = rows.map((r) => {
      const color = r.estado === 'completado' ? COLOR.gold : r.estado === 'pendiente' ? COLOR.auralis : '#5a6a78';
      return `<div style="position:absolute;left:${mx(r.x) - 5}px;top:${mz(r.z) - 5}px;width:10px;height:10px;` +
        `border-radius:50%;background:${color};box-shadow:0 0 6px ${color};"></div>`;
    }).join('');
    const player =
      `<div style="position:absolute;left:${mx(playerX) - 4}px;top:${mz(playerZ) - 4}px;width:8px;height:8px;` +
      `border-radius:50%;background:${COLOR.coral};border:1.5px solid #fff;"></div>`;
    return `<div style="${GLASS}border-radius:14px;padding:10px;">
      <div style="font-size:12px;letter-spacing:2px;color:#9fd8e8;margin-bottom:6px;">MAPA</div>
      <div style="position:relative;width:${W}px;height:${H}px;background:rgba(30,203,205,.08);border-radius:10px;">
        <div style="position:absolute;left:${mx(0) - 14}px;top:${mz(-44) - 10}px;font-size:10px;color:#9fd8e8;">FARO</div>
        ${dots}${player}
      </div>
      <div style="font-size:10px;color:#7a98a8;margin-top:5px;">⭐ logrado · ◉ activo · gris bloqueado · ● tú</div>
    </div>`;
  }

  /** Pantalla de zona completada: Destellos, Lumas, secretos y porcentaje. */
  showFaroScreen(rows: DestelloRow[], lumas: number, secrets: number, percent: number): void {
    const list = rows.map((r) => {
      const icon = r.estado === 'completado' ? '⭐' : r.estado === 'pendiente' ? '◇' : '🔒';
      const color = r.estado === 'completado' ? COLOR.gold : r.estado === 'pendiente' ? '#9fd8e8' : '#6a7a88';
      return `<div style="color:${color};font-size:14px;line-height:1.7;">${icon} ${r.nombre}</div>`;
    }).join('');
    this.showOverlay(
      `<h1 style="font-size:27px;color:${COLOR.gold};margin:0;">¡El Faro del Alba brilla!</h1>
       <p style="font-size:13px;color:#c7b3ea;font-style:italic;margin:2px 0;">Elaria: «La luz no estaba perdida. Solo esperaba que alguien la reuniera.»</p>
       <div style="${GLASS}border-radius:14px;padding:12px 22px;text-align:left;">${list}</div>
       <div style="display:flex;gap:18px;font-size:14px;">
         <span>🔹 <b>${lumas}</b> Lumas</span>
         <span>🗝 <b>${secrets}</b>/3 secretos</span>
         <span style="color:${COLOR.gold};">✔ <b>${percent}%</b></span>
       </div>
       <p style="font-size:12px;color:#9fd8e8;margin:2px 0;">El camino a la Selva del Canto se ha desbloqueado (próximo capítulo).</p>`,
      [
        { label: 'Seguir explorando', action: () => this.onContinue?.() },
        { label: 'Jugar de nuevo', action: () => this.onRestart?.(), secondary: true },
      ],
    );
  }

  showDefeatScreen(): void {
    this.showOverlay(
      `<h1 style="font-size:32px;color:${COLOR.coral};">¡Ay no!</h1>
       <p style="font-size:14px;color:#d8eef5;">Oryn: «Eso tuvo que doler. ¡Otra vez, con más estilo!»</p>`,
      [{ label: 'Reintentar', action: () => this.onRestart?.() }],
    );
  }

  dispose(): void {
    if (this.dialogueTimeout) clearTimeout(this.dialogueTimeout);
    if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
    if (this.orynToastTimeout) clearTimeout(this.orynToastTimeout);
    this.root.remove();
  }
}
