'use client';

import { useEffect, useRef } from 'react';

/**
 * Página /game — "Isla Auria: Costa Brillante"
 * Monta el GameManager (Three.js) en un contenedor a pantalla completa.
 * En escritorio, el contenedor se limita a una franja vertical 9:16 centrada
 * para simular un teléfono; en móvil ocupa toda la pantalla.
 */
export default function GamePage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let game: { dispose: () => void } | null = null;

    // Import dinámico: Three.js solo se carga en el cliente
    import('@/game/GameManager').then(({ GameManager }) => {
      if (disposed || !containerRef.current) return;
      game = new GameManager(containerRef.current);
    });

    return () => {
      disposed = true;
      game?.dispose();
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#06141f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Marco vertical 9:16: ancho máximo derivado de la altura disponible */}
      <div
        ref={containerRef}
        style={{
          width: 'min(100vw, calc(100dvh * 9 / 16))',
          height: '100dvh',
          maxHeight: '100dvh',
        }}
      />
    </div>
  );
}
