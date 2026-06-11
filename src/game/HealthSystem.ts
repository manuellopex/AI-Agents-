/**
 * HealthSystem
 * -------------
 * Vida del jugador: 3 corazones, invulnerabilidad temporal tras recibir
 * daño y callbacks para la UI y el GameManager.
 */
export class HealthSystem {
  readonly maxHealth = 3;
  health = this.maxHealth;

  /** Segundos restantes de invulnerabilidad tras un golpe. */
  private invulnTimer = 0;
  private readonly invulnDuration = 1.5;

  onChange: ((health: number) => void) | null = null;
  onDeath: (() => void) | null = null;

  get isInvulnerable(): boolean {
    return this.invulnTimer > 0;
  }

  update(dt: number): void {
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
  }

  /**
   * Aplica 1 punto de daño si el jugador no es invulnerable.
   * Devuelve true si el daño se aplicó.
   */
  takeDamage(): boolean {
    if (this.isInvulnerable || this.health <= 0) return false;
    this.health -= 1;
    this.invulnTimer = this.invulnDuration;
    this.onChange?.(this.health);
    if (this.health <= 0) this.onDeath?.();
    return true;
  }

  reset(): void {
    this.health = this.maxHealth;
    this.invulnTimer = 0;
    this.onChange?.(this.health);
  }
}
