'use client';

import { useEffect, useRef } from 'react';
import { useMotionTier } from './motion/MotionProvider';

/**
 * Sinematik "kor & toz" alanı.
 *   • Network teması → yukarı süzülen kızıl/turuncu kor.
 *   • Truva teması   → altın toz.
 * Fare itmesi (imleç yakınındaki parçacıklar kaçar) + scroll hızına tepki
 * (hızlı kaydırınca alan canlanır). Tema `data-site-theme` üzerinden CANLI okunur.
 *
 * Motion tier:
 *   off  → hiç çalışmaz (boş, şeffaf canvas kalır).
 *   lite → seyrek parçacık, fare/scroll etkileşimi kapalı, düşük maliyet.
 *   full → tüm yoğunluk + etkileşim.
 *
 * Öncelik WebGL2 gl.POINTS + tek shader (bağımlılık yok, additive glow). WebGL2 yoksa
 * aynı prop API'siyle 2D canvas'a düşer. Resize'a dayanıklı; unmount'ta temizlenir.
 */
export default function ParticleField({ density = 60 }: { density?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tier = useMotionTier();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || tier === 'off') return;

    const lite = tier === 'lite';
    const count = Math.max(6, Math.round(density * (lite ? 0.4 : 1)));
    const interactive = !lite; // fare/scroll etkileşimi yalnız full'da
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    let W = 1;
    let H = 1;
    let raf = 0;

    // ── Ortak parçacık modeli (CPU simülasyonu; hem GL hem 2D kullanır) ──
    type P = {
      x: number; y: number; r: number;
      vx: number; vy: number;
      alpha: number; twinkle: number; phase: number;
      hue: number; // 0..1 renk seçimi
    };
    let ps: P[] = [];

    const spawn = (randomY: boolean): P => ({
      x: Math.random() * W,
      y: randomY ? Math.random() * H : H + 8,
      r: 0.6 + Math.random() * 1.9,
      vx: (Math.random() - 0.5) * 0.18,
      vy: 0.15 + Math.random() * 0.45,
      alpha: 0.22 + Math.random() * 0.5,
      twinkle: 0.5 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
      hue: Math.random(),
    });

    // ── Etkileşim durumu ──
    const mouse = { x: -9999, y: -9999, active: false };
    let scrollBoost = 0;
    let lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0;

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active =
        mouse.x >= -60 && mouse.x <= W + 60 && mouse.y >= -60 && mouse.y <= H + 60;
    };
    const onPointerLeaveWin = () => {
      mouse.active = false;
    };
    const onScroll = () => {
      const y = window.scrollY;
      const d = Math.abs(y - lastScrollY);
      lastScrollY = y;
      scrollBoost = Math.min(scrollBoost + d * 0.02, 6); // birikir, karede söner
    };

    if (interactive) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerleave', onPointerLeaveWin, { passive: true });
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    const isTruva = () =>
      document.documentElement.getAttribute('data-site-theme') === 'truva';

    // Tema + hue → [r,g,b] (0..1)
    const colorFor = (hue: number, truva: boolean): [number, number, number] => {
      if (truva) {
        // altın toz: 185,138,47 ↔ 214,176,92
        return hue < 0.5 ? [0.725, 0.541, 0.184] : [0.839, 0.69, 0.361];
      }
      // kor: kızıl 226,49,64 · turuncu 255,154,84
      return hue < 0.34 ? [1.0, 0.604, 0.329] : [0.886, 0.192, 0.251];
    };

    // ── Simülasyon adımı (ortak) ──
    let t = 0;
    const step = () => {
      t += 1 / 60;
      const boost = 1 + scrollBoost;
      scrollBoost *= 0.9; // her karede sönümlen
      for (let i = 0; i < ps.length; i++) {
        let p = ps[i];
        p.y -= p.vy * boost;
        p.x += p.vx + Math.sin(t * p.twinkle + p.phase) * 0.12;

        // Fare itmesi: imleç yakınındaki parçacıklar radyal olarak kaçar.
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          const R = 120;
          if (d2 < R * R && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const f = (1 - d / R) * 2.4;
            p.x += (dx / d) * f;
            p.y += (dy / d) * f;
          }
        }

        if (p.y < -12 || p.x < -12 || p.x > W + 12) {
          ps[i] = spawn(false);
          p = ps[i];
        }
      }
    };

    // ─────────────────────────────────────────────────────────────
    // WebGL2 yolu
    // ─────────────────────────────────────────────────────────────
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
    }) as WebGL2RenderingContext | null;

    let cleanupGL: (() => void) | null = null;
    let runGL = false;

    if (gl) {
      const vsSrc = `#version 300 es
      layout(location=0) in vec2 a_pos;   // NDC
      layout(location=1) in float a_size; // px
      layout(location=2) in float a_alpha;
      layout(location=3) in vec3 a_color;
      out float v_alpha;
      out vec3 v_color;
      void main() {
        gl_Position = vec4(a_pos, 0.0, 1.0);
        gl_PointSize = a_size;
        v_alpha = a_alpha;
        v_color = a_color;
      }`;
      const fsSrc = `#version 300 es
      precision mediump float;
      in float v_alpha;
      in vec3 v_color;
      out vec4 fragColor;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        // yumuşak dairesel düşüş → glow çekirdeği
        float a = smoothstep(0.5, 0.0, d);
        a = a * a;
        fragColor = vec4(v_color * a * v_alpha, a * v_alpha);
      }`;

      const compile = (type: number, src: string): WebGLShader | null => {
        const sh = gl.createShader(type);
        if (!sh) return null;
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
          gl.deleteShader(sh);
          return null;
        }
        return sh;
      };

      const vs = compile(gl.VERTEX_SHADER, vsSrc);
      const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
      const prog = vs && fs ? gl.createProgram() : null;
      if (vs && fs && prog) {
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
          runGL = true;
          const STRIDE = 7; // pos(2) size(1) alpha(1) color(3)
          let data = new Float32Array(count * STRIDE);
          const vao = gl.createVertexArray();
          const vbo = gl.createBuffer();
          gl.bindVertexArray(vao);
          gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
          gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
          const FB = Float32Array.BYTES_PER_ELEMENT;
          gl.enableVertexAttribArray(0);
          gl.vertexAttribPointer(0, 2, gl.FLOAT, false, STRIDE * FB, 0);
          gl.enableVertexAttribArray(1);
          gl.vertexAttribPointer(1, 1, gl.FLOAT, false, STRIDE * FB, 2 * FB);
          gl.enableVertexAttribArray(2);
          gl.vertexAttribPointer(2, 1, gl.FLOAT, false, STRIDE * FB, 3 * FB);
          gl.enableVertexAttribArray(3);
          gl.vertexAttribPointer(3, 3, gl.FLOAT, false, STRIDE * FB, 4 * FB);

          gl.useProgram(prog);
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive glow

          const resizeGL = () => {
            const rect = canvas.getBoundingClientRect();
            W = Math.max(rect.width, 1);
            H = Math.max(rect.height, 1);
            canvas.width = Math.round(W * DPR);
            canvas.height = Math.round(H * DPR);
            gl.viewport(0, 0, canvas.width, canvas.height);
            ps = Array.from({ length: count }, () => spawn(true));
          };

          const frameGL = () => {
            step();
            const truva = isTruva();
            for (let i = 0; i < ps.length; i++) {
              const p = ps[i];
              const o = i * STRIDE;
              // px → NDC
              data[o] = (p.x / W) * 2 - 1;
              data[o + 1] = 1 - (p.y / H) * 2;
              const flicker = 0.55 + 0.45 * Math.sin(t * p.twinkle * 2 + p.phase);
              data[o + 2] = p.r * 2 * DPR; // point size (px)
              data[o + 3] = p.alpha * flicker;
              const [r, g, b] = colorFor(p.hue, truva);
              data[o + 4] = r;
              data[o + 5] = g;
              data[o + 6] = b;
            }
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
            gl.drawArrays(gl.POINTS, 0, ps.length);
            raf = requestAnimationFrame(frameGL);
          };

          resizeGL();
          raf = requestAnimationFrame(frameGL);
          window.addEventListener('resize', resizeGL);

          cleanupGL = () => {
            window.removeEventListener('resize', resizeGL);
            gl.deleteBuffer(vbo);
            gl.deleteVertexArray(vao);
            gl.deleteProgram(prog);
            gl.getExtension('WEBGL_lose_context')?.loseContext();
            data = new Float32Array(0);
          };
        }
      }
      if (!runGL) {
        if (vs) gl.deleteShader(vs);
        if (fs) gl.deleteShader(fs);
        if (prog) gl.deleteProgram(prog);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2D canvas fallback (WebGL2 yoksa / derleme başarısızsa)
    // ─────────────────────────────────────────────────────────────
    let cleanup2D: (() => void) | null = null;
    if (!runGL) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const resize2D = () => {
          const rect = canvas.getBoundingClientRect();
          W = Math.max(rect.width, 1);
          H = Math.max(rect.height, 1);
          canvas.width = Math.round(W * DPR);
          canvas.height = Math.round(H * DPR);
          ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
          ps = Array.from({ length: count }, () => spawn(true));
        };

        const frame2D = () => {
          step();
          ctx.clearRect(0, 0, W, H);
          const truva = isTruva();
          for (let i = 0; i < ps.length; i++) {
            const p = ps[i];
            const flicker = 0.55 + 0.45 * Math.sin(t * p.twinkle * 2 + p.phase);
            const [r, g, b] = colorFor(p.hue, truva);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${(p.alpha * flicker).toFixed(3)})`;
            ctx.fill();
          }
          raf = requestAnimationFrame(frame2D);
        };

        resize2D();
        raf = requestAnimationFrame(frame2D);
        window.addEventListener('resize', resize2D);
        cleanup2D = () => window.removeEventListener('resize', resize2D);
      }
    }

    return () => {
      cancelAnimationFrame(raf);
      if (interactive) {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerleave', onPointerLeaveWin);
        window.removeEventListener('scroll', onScroll);
      }
      cleanupGL?.();
      cleanup2D?.();
    };
  }, [density, tier]);

  return <canvas ref={canvasRef} className="particle-field" aria-hidden="true" />;
}
