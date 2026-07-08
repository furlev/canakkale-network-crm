'use client';

import { useEffect, useRef } from 'react';

/**
 * Sinematik parçacık kanvası — Network temasında yukarı süzülen kor parçacıkları,
 * Truva temasında altın toz. Düşük CPU: ~60 parçacık, tek rAF döngüsü.
 * prefers-reduced-motion açıkken hiç çalışmaz; resize'a dayanıklıdır.
 */
export default function ParticleField({ density = 60 }: { density?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    let raf = 0;

    type Particle = {
      x: number; y: number; r: number;
      vx: number; vy: number;
      alpha: number; twinkle: number; phase: number;
    };
    let particles: Particle[] = [];

    const spawn = (randomY: boolean): Particle => ({
      x: Math.random() * W,
      y: randomY ? Math.random() * H : H + 8,
      r: 0.6 + Math.random() * 1.8,
      vx: (Math.random() - 0.5) * 0.18,
      vy: 0.15 + Math.random() * 0.45,
      alpha: 0.22 + Math.random() * 0.5,
      twinkle: 0.5 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
    });

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = Math.max(rect.width, 1);
      H = Math.max(rect.height, 1);
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      particles = Array.from({ length: density }, () => spawn(true));
    };

    const isTruva = () => document.documentElement.getAttribute('data-site-theme') === 'truva';

    let t = 0;
    const frame = () => {
      t += 1 / 60;
      ctx.clearRect(0, 0, W, H);
      const truva = isTruva();
      for (let i = 0; i < particles.length; i++) {
        let p = particles[i];
        p.y -= p.vy;
        p.x += p.vx + Math.sin(t * p.twinkle + p.phase) * 0.12;
        if (p.y < -10 || p.x < -10 || p.x > W + 10) {
          particles[i] = spawn(false);
          p = particles[i];
        }
        const flicker = 0.55 + 0.45 * Math.sin(t * p.twinkle * 2 + p.phase);
        const a = (p.alpha * flicker).toFixed(3);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = truva
          ? `rgba(185, 138, 47, ${a})` // altın toz
          : i % 3 === 0
            ? `rgba(255, 154, 84, ${a})` // turuncu kor
            : `rgba(226, 49, 64, ${a})`; // kızıl kor
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };

    resize();
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [density]);

  return <canvas ref={canvasRef} className="particle-field" aria-hidden="true" />;
}
