'use client';

import Link from 'next/link';
import { Fragment, useEffect, useRef, useState } from 'react';
import ParticleField from './ParticleField';
import { useMotionTier } from './motion/MotionProvider';
import { useScrollProgress } from '@/hooks/useScrollProgress';

export type HeroItem = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  imageAlt: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  /** Sunucuda formatDateTr ile hazırlanmış tarih etiketi */
  dateLabel: string;
  /** Son dakika ise manşet tam-kızıl "CANLI" varyantına geçer */
  isBreaking?: boolean;
};

const ROTATE_MS = 6000;

/**
 * Başlığı TR-güvenli HARF harf böler (Intl.Segmenter grapheme; birleşik/aksanlı
 * karakterleri bozmaz). Her kelime bir sarmalayıcı span (kelime bütün olarak
 * satır kaydırılır), her harf ayrı span (clip/transform stagger). Son kelime
 * "vurgulu" işaretlenir (wght animasyonu). Segmenter yoksa Array.from fallback.
 */
function renderKineticTitle(title: string) {
  const words = title.split(/\s+/).filter(Boolean);
  const seg =
    typeof Intl !== 'undefined' && typeof (Intl as { Segmenter?: unknown }).Segmenter === 'function'
      ? new Intl.Segmenter('tr', { granularity: 'grapheme' })
      : null;
  let idx = 0;
  return words.map((word, wi) => {
    const graphemes = seg ? Array.from(seg.segment(word), s => s.segment) : Array.from(word);
    const isAccent = wi === words.length - 1; // son kelime vurgulu
    return (
      <Fragment key={`${wi}-${word}`}>
        <span className={`hero-kw${isAccent ? ' is-accent' : ''}`}>
          {graphemes.map((g, gi) => (
            <span
              key={gi}
              className="hero-kl"
              style={{ animationDelay: `${Math.min(idx++ * 32, 1200)}ms` }}
            >
              {g}
            </span>
          ))}
        </span>{' '}
      </Fragment>
    );
  });
}

/**
 * ~92vh sinematik manşet: Ken Burns arka plan, kor parçacıkları, kelime kelime
 * başlık reveal'ı ve 6 sn'de bir dönen 01–05 mini manşet listesi.
 *
 * kinetic (opt-in): true ise ve motion tier 'full' ise başlık HARF-maskeli kinetik
 * reveal'e geçer. tier 'full' değilse (reduced-motion → MotionProvider 'off'a düşürür,
 * ya da lite/off) klasik kelime reveal'i korunur → mevcut davranış bozulmaz.
 */
export default function HeroCinematic({ items, kinetic = false }: { items: HeroItem[]; kinetic?: boolean }) {
  const [active, setActive] = useState(0);
  const [cycle, setCycle] = useState(0); // manuel seçimde sayaç sıfırlansın diye
  const [mounted, setMounted] = useState(false); // kinetik yalnız istemcide (Segmenter) devreye girer
  const reducedRef = useRef(false);
  const heroRef = useRef<HTMLElement>(null);
  const tier = useMotionTier();
  const [jsScrub, setJsScrub] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // ── Scroll-scrub kurulumu ──
  // Native CSS scroll-timeline destekleniyorsa CSS-only (data-scrub="css"),
  // yoksa rAF fallback (data-scrub="js" → useScrollProgress --hero-p yazar).
  // off tier / reduced-motion → hiç scrub yok, hero statik.
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    if (tier === 'off') {
      el.removeAttribute('data-scrub');
      setJsScrub(false);
      return;
    }
    const supportsTimeline =
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('animation-timeline', 'scroll()');
    if (supportsTimeline) {
      el.setAttribute('data-scrub', 'css');
      setJsScrub(false);
    } else {
      el.setAttribute('data-scrub', 'js');
      setJsScrub(true);
    }
  }, [tier, items.length]);

  useScrollProgress(
    heroRef,
    p => {
      heroRef.current?.style.setProperty('--hero-p', p.toFixed(4));
    },
    { disabled: !jsScrub }
  );

  // ── 3B tilt + işaretçi paralaksı (madde 3) ──
  // YALNIZ pointer:fine + tier 'full' + reduced-motion kapalıyken devreye girer;
  // mobil/dokunmatik ve düşük tier'da attribute hiç eklenmez → sıfır maliyet.
  // Tek rAF döngüsü (yalnız hareket varken çalışır, hedefe oturunca durur) ve
  // layout okuması yok: normalize konum viewport ölçüsünden hesaplanır.
  useEffect(() => {
    const el = heroRef.current;
    if (!el || tier !== 'full') return;
    if (typeof window.matchMedia !== 'function') return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    el.setAttribute('data-tilt', 'on');

    let vw = window.innerWidth || 1;
    let vh = window.innerHeight || 1;
    const onResize = () => {
      vw = window.innerWidth || 1;
      vh = window.innerHeight || 1;
    };

    let raf = 0;
    let tx = 0; // hedef (-1..1)
    let ty = 0;
    let cx = 0; // lerp'li güncel değer
    let cy = 0;

    const frame = () => {
      cx += (tx - cx) * 0.1;
      cy += (ty - cy) * 0.1;
      // rotateY yatayı, rotateX dikeyi izler (maks ~4°); --tilt-x/y liste paralaksı için birimsiz
      el.style.setProperty('--tilt-ry', `${(cx * 4).toFixed(3)}deg`);
      el.style.setProperty('--tilt-rx', `${(cy * -3).toFixed(3)}deg`);
      el.style.setProperty('--tilt-x', cx.toFixed(3));
      el.style.setProperty('--tilt-y', cy.toFixed(3));
      if (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) {
        raf = requestAnimationFrame(frame);
      } else {
        raf = 0;
      }
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      tx = Math.max(-1, Math.min(1, (e.clientX / vw) * 2 - 1));
      ty = Math.max(-1, Math.min(1, (e.clientY / vh) * 2 - 1));
      kick();
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
      kick();
    };

    el.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerleave', onLeave, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('resize', onResize);
      if (raf) cancelAnimationFrame(raf);
      el.removeAttribute('data-tilt');
      el.style.removeProperty('--tilt-rx');
      el.style.removeProperty('--tilt-ry');
      el.style.removeProperty('--tilt-x');
      el.style.removeProperty('--tilt-y');
    };
  }, [tier, items.length]);

  useEffect(() => {
    if (items.length < 2 || reducedRef.current) return;
    const id = setInterval(() => setActive(a => (a + 1) % items.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [items.length, cycle]);

  const select = (i: number) => {
    setActive(i);
    setCycle(c => c + 1);
  };

  // ── DB boşken zarif fallback: marka videosu + slogan ──
  if (items.length === 0) {
    return (
      <section ref={heroRef} className="hero hero-fallback" aria-label="Çanakkale Network">
        <video
          className="hero-brand-video"
          src="/site/brand.mp4"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
        <div className="hero-veil" aria-hidden="true" />
        <ParticleField />
        <div className="s-container hero-fallback-inner">
          <img src="/site/logo-dark.png" alt="Çanakkale Network" className="hero-fallback-logo" />
          <h1 className="hero-fallback-title">Şehrin Dijital Meydanı</h1>
          <p className="hero-spot">İlk haberler yolda — Çanakkale&apos;nin nabzı çok yakında burada atacak.</p>
        </div>
      </section>
    );
  }

  const current = items[active];
  // Aktif manşet son dakika ise tam-kızıl "CANLI" varyant. off tier / reduced-motion'da
  // nabız statik kalır (CANLI rozeti görünür ama titremez).
  const isLive = current.isBreaking === true;
  const liveStatic = tier === 'off';
  // Kinetik başlık yalnız opt-in + istemcide + tier 'full' (reduced-motion → tier 'off')
  const kineticActive = kinetic && mounted && tier === 'full';

  return (
    <section
      ref={heroRef}
      className="hero"
      aria-label="Manşet haberler"
      data-variant={isLive ? 'breaking' : undefined}
    >
      <div className="hero-bg-stack" aria-hidden="true">
        {items.map((item, i) => {
          const isActive = i === active;
          // PERF: yalnızca aktif ve bir sonraki manşetin görselini DOM'a bas;
          // diğerleri <img> olarak durmasın (5 base64/uzak görsel yerine en fazla 2).
          const isNext = items.length > 1 && i === (active + 1) % items.length;
          return (
            <div key={item.slug} className={`hero-bg${isActive ? ' is-active' : ''}`}>
              {isActive || isNext ? (
                // Görsel /img/[id] endpoint'inden gelir (data-URI HTML'e gömülmez)
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/img/${item.id}`}
                  alt=""
                  decoding="async"
                  fetchPriority={isActive ? 'high' : 'auto'}
                  loading={isActive ? 'eager' : 'lazy'}
                />
              ) : (
                <div className="hero-bg-brand" />
              )}
            </div>
          );
        })}
      </div>
      <div className="hero-veil" aria-hidden="true" />
      {/* sparks: işaretçiyi izleyen kıvılcımlar (ParticleField içinde pointer:fine + full tier'a kilitli) */}
      <ParticleField sparks />

      <div className="s-container hero-layout">
        {/* key=slug → her manşet değişiminde içerik animasyonları yeniden oynar */}
        <div className="hero-content" key={current.slug}>
          <div className="hero-meta">
            {isLive && (
              <span className={`hero-live${liveStatic ? ' is-static' : ''}`}>
                <span className="hero-live-dot" aria-hidden="true" />
                CANLI
              </span>
            )}
            {current.categoryName && current.categorySlug && (
              <Link href={`/kategori/${current.categorySlug}`} className="s-badge s-badge-cat hero-badge">
                {current.categoryName}
              </Link>
            )}
            <span className="hero-date">{current.dateLabel}</span>
          </div>
          <h1 className={`hero-title${kineticActive ? ' hero-title-kinetic' : ''}`}>
            {kineticActive
              ? renderKineticTitle(current.title)
              : current.title.split(/\s+/).map((word, i) => (
                  <Fragment key={`${i}-${word}`}>
                    <span
                      className="hero-word"
                      style={{ animationDelay: `${Math.min(i * 70, 900)}ms` }}
                    >
                      {word}
                    </span>{' '}
                  </Fragment>
                ))}
          </h1>
          {current.summary && <p className="hero-spot">{current.summary}</p>}
          <Link href={`/haber/${current.slug}`} className="s-btn s-btn-primary hero-cta">
            Haberi Oku
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          </Link>
        </div>

        <ol className="hero-list" aria-label="Öne çıkan haberler">
          {items.map((item, i) => (
            <li key={item.slug}>
              <button
                type="button"
                className={`hero-list-item${i === active ? ' is-active' : ''}`}
                onClick={() => select(i)}
                aria-current={i === active ? 'true' : undefined}
                aria-label={`Manşet ${i + 1}: ${item.title}`}
              >
                <span className="hero-list-no" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="hero-list-title">{item.title}</span>
                {i === active && (
                  <span key={`p-${cycle}-${active}`} className="hero-progress" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="hero-scroll" aria-hidden="true">
        <span className="hero-mouse">
          <span className="hero-wheel" />
        </span>
        <span className="hero-scroll-text">Kaydır</span>
      </div>
    </section>
  );
}
