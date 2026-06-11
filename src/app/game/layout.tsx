import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Mael & Oryn: El Primer Destello',
  description: 'Prototipo de platformer 3D móvil vertical: Mael & Oryn: El Primer Destello — Capítulo 1, Costa Brillante.',
};

// Viewport móvil: sin zoom ni rebotes, pantalla completa
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return children;
}
