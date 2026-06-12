/**
 * AudioManager
 * -------------
 * Efectos sintetizados con WebAudio + dos pistas de música reales
 * (public/audio/): menu.mp3 al 45 % para la pantalla de título y
 * music.mp3 al 35 % durante el juego. Si faltan los archivos, un
 * arpegio sintetizado cubre la música del juego.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  /** Pista del menú (public/audio/menu.mp3) — volumen 45 %. */
  private menuTrack: HTMLAudioElement | null = null;
  private menuTrackReady = false;
  /** Pista del juego (public/audio/music.mp3) — volumen 35 %. */
  private musicTrack: HTMLAudioElement | null = null;
  private musicTrackReady = false;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicStep = 0;
  private muted = false;
  /** Qué pista debería sonar ahora (las cargas terminan en cualquier momento). */
  private desired: 'menu' | 'game' | 'none' = 'none';

  /** Debe llamarse tras un gesto del usuario (requisito de los navegadores). */
  init(): void {
    if (this.ctx) return;
    const path = window.location.pathname;
    const idx = path.indexOf('/game');
    const base = idx > 0 ? path.slice(0, idx) : '';
    const loadTrack = (file: string, volume: number, onReady: () => void): HTMLAudioElement | null => {
      try {
        const track = new Audio(`${base}/audio/${file}`);
        track.loop = true;
        track.volume = volume;
        track.addEventListener('canplaythrough', onReady, { once: true });
        return track;
      } catch { return null; }
    };
    this.menuTrack = loadTrack('menu.mp3', 0.45, () => {
      this.menuTrackReady = true;
      if (this.desired === 'menu' && !this.muted) void this.menuTrack?.play().catch(() => undefined);
    });
    this.musicTrack = loadTrack('music.mp3', 0.35, () => {
      this.musicTrackReady = true;
      if (this.desired === 'game') {
        // El MP3 real releva al arpegio sintetizado en cuanto está listo
        if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
        if (!this.muted) void this.musicTrack?.play().catch(() => undefined);
      }
    });
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.masterGain);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain) this.masterGain.gain.value = muted ? 0 : 0.5;
    if (this.musicTrack) this.musicTrack.muted = muted;
    if (this.menuTrack) this.menuTrack.muted = muted;
  }

  /** Tono simple con envolvente. Base de todos los efectos. */
  private tone(freq: number, duration: number, type: OscillatorType, volume = 0.3, slideTo?: number): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain).connect(this.masterGain);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  playJump(): void { this.tone(320, 0.18, 'square', 0.15, 640); }
  playDoubleJump(): void { this.tone(420, 0.2, 'square', 0.15, 880); }
  playPickup(): void { this.tone(880, 0.12, 'sine', 0.25, 1760); this.tone(1320, 0.18, 'sine', 0.12); }
  playHurt(): void { this.tone(220, 0.3, 'sawtooth', 0.25, 80); }
  playAttack(): void { this.tone(180, 0.22, 'sawtooth', 0.18, 420); }
  playBreak(): void { this.tone(140, 0.25, 'square', 0.2, 60); }
  playEnemyDown(): void { this.tone(500, 0.25, 'triangle', 0.2, 120); }
  playVictory(): void { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, 'triangle', 0.25), i * 140)); }
  /** Canto breve de un Quirí: dos notas dulces y agudas, ambiente isleño. */
  playQuiri(): void { this.tone(1680, 0.14, 'sine', 0.07, 2050); setTimeout(() => this.tone(2050, 0.18, 'sine', 0.06, 1680), 160); }
  /** Ladrido de Oryn: dos yips cortos. */
  playBark(): void { this.tone(740, 0.09, 'square', 0.2, 520); setTimeout(() => this.tone(820, 0.1, 'square', 0.18, 560), 130); }
  /** Fanfarria de Destello conseguido. */
  playDestello(): void { [660, 880, 1100, 1320, 1760].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'triangle', 0.22), i * 110)); }
  playCharge(): void { this.tone(110, 0.5, 'sawtooth', 0.22, 70); }
  playRockBreak(): void { this.tone(90, 0.35, 'square', 0.25, 40); this.tone(160, 0.2, 'sawtooth', 0.15, 60); }
  playPound(): void { this.tone(70, 0.3, 'square', 0.3, 35); }
  playBoing(): void { this.tone(220, 0.3, 'sine', 0.22, 660); }
  playPurify(): void { [880, 1100, 1320].forEach((f, i) => setTimeout(() => this.tone(f, 0.4, 'sine', 0.15), i * 150)); }
  playDig(): void { this.tone(200, 0.15, 'square', 0.18, 120); setTimeout(() => this.tone(160, 0.15, 'square', 0.16, 100), 120); }
  playDefeat(): void { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this.tone(f, 0.4, 'triangle', 0.22), i * 180)); }

  /** Música del menú (45 %): suena en la pantalla de título. */
  startMenuMusic(): void {
    this.desired = 'menu';
    this.musicTrack?.pause();
    if (this.menuTrackReady && !this.muted) void this.menuTrack?.play().catch(() => undefined);
  }

  /** Música del juego (35 %): la pista real si existe; si no, arpegio placeholder. */
  startMusic(): void {
    this.desired = 'game';
    this.menuTrack?.pause();
    if (this.musicTrack && this.musicTrackReady) {
      if (!this.muted) void this.musicTrack.play().catch(() => undefined);
      return;
    }
    if (!this.ctx || this.musicTimer) return;
    // Escala pentatónica mayor de Do — alegre y "de aventura".
    const scale = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3];
    const pattern = [0, 2, 4, 5, 4, 2, 3, 1];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || !this.musicGain || this.muted) return;
      const t = this.ctx.currentTime;
      const note = scale[pattern[this.musicStep % pattern.length]] * (this.musicStep % 16 < 8 ? 1 : 0.5);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = note;
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(gain).connect(this.musicGain);
      osc.start(t);
      osc.stop(t + 0.6);
      this.musicStep++;
    }, 300);
  }

  stopMusic(): void {
    this.desired = 'none';
    this.musicTrack?.pause();
    this.menuTrack?.pause();
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  dispose(): void {
    this.musicTrack?.pause();
    this.musicTrack = null;
    this.menuTrack?.pause();
    this.menuTrack = null;
    this.ctx?.close();
    this.ctx = null;
  }
}
