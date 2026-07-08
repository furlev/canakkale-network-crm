'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bricolage_Grotesque } from 'next/font/google';
import styles from './InstagramStudio.module.css';

/* Bricolage Grotesque — marka başlık fontu (site ile aynı); latin-ext = Türkçe. */
const displayFont = Bricolage_Grotesque({ subsets: ['latin', 'latin-ext'], display: 'swap' });

/* ── API sözleşmesi: GET /api/ai/drafts/[id]/instagram ── */
type IgColors = { navy: string; red: string; redBright: string; gold: string; paper: string; ink: string };
type IgTemplate = {
  brandName: string;
  handle: string;
  website: string;
  logo: string;
  colors: IgColors;
  slideCharLimit: number;
  hashtags: string[];
};
type IgData = {
  draftId: string;
  cover: {
    title: string;
    category: string | null;
    district: string | null;
    districtName: string | null;
    newsType: string;
    imageUrl: string | null;
    imageIsAi: boolean;
  };
  slides: string[];
  caption: string;
  hashtags: string[];
  template: IgTemplate;
};

type Kind = 'cover' | 'slide' | 'story';
type Card = { id: string; kind: Kind; index: number; w: number; h: number };

/** Başlık uzunluğuna göre font küçültür. */
function fitTitle(len: number, base: number): number {
  if (len <= 34) return base;
  if (len <= 60) return Math.round(base * 0.8);
  if (len <= 95) return Math.round(base * 0.64);
  return Math.round(base * 0.52);
}

/** Bir düğümdeki tüm görseller yüklenene kadar bekler (html2canvas için). */
async function waitForImages(node: HTMLElement): Promise<void> {
  const imgs = Array.from(node.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.addEventListener('load', () => res(), { once: true });
            img.addEventListener('error', () => res(), { once: true });
          }),
    ),
  );
}

export default function InstagramStudio({ draftId, onClose }: { draftId: string; onClose: () => void }) {
  const [data, setData] = useState<IgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [caption, setCaption] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const setRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) nodeRefs.current.set(id, el);
    else nodeRefs.current.delete(id);
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/ai/drafts/${draftId}/instagram`)
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error((json && json.error) || 'İçerik hazırlanamadı');
        return json as IgData;
      })
      .then((json) => {
        if (!alive) return;
        setData(json);
        setCaption(json.caption || '');
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'İçerik hazırlanamadı'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [draftId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving && !busyId) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving, busyId]);

  const cards: Card[] = data
    ? [
        { id: 'cover', kind: 'cover', index: 0, w: 1080, h: 1080 },
        ...data.slides.map((_, i) => ({ id: `slide-${i}`, kind: 'slide' as const, index: i, w: 1080, h: 1080 })),
        { id: 'story', kind: 'story', index: 0, w: 1080, h: 1920 },
      ]
    : [];

  const capture = useCallback(async (card: Card): Promise<string | null> => {
    const node = nodeRefs.current.get(card.id);
    if (!node) return null;
    // Dinamik import: html2canvas yalnız istemcide yüklenir (SSR modül-değerlendirmesini atlar).
    const html2canvas = (await import('html2canvas')).default;
    try { await document.fonts.ready; } catch { /* yoksay */ }
    await waitForImages(node);
    const canvas = await html2canvas(node, {
      scale: 1,
      backgroundColor: null,
      useCORS: true,
      logging: false,
      width: card.w,
      height: card.h,
    });
    return canvas.toDataURL('image/png');
  }, []);

  const triggerDownload = (dataUri: string, name: string) => {
    const a = document.createElement('a');
    a.href = dataUri;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const fileName = (card: Card) =>
    `cn-ig-${draftId.slice(0, 8)}-${card.kind}${card.kind === 'slide' ? `-${card.index + 1}` : ''}.png`;

  const downloadOne = async (card: Card) => {
    setMsg(null);
    setBusyId(card.id);
    try {
      const uri = await capture(card);
      if (uri) triggerDownload(uri, fileName(card));
    } catch {
      setMsg({ ok: false, text: 'Görsel üretilemedi (görsel kaynağı engellenmiş olabilir).' });
    } finally {
      setBusyId(null);
    }
  };

  const downloadAll = async () => {
    setMsg(null);
    setSaving(true);
    try {
      for (const card of cards) {
        const uri = await capture(card);
        if (uri) triggerDownload(uri, fileName(card));
      }
    } catch {
      setMsg({ ok: false, text: 'Bazı görseller üretilemedi.' });
    } finally {
      setSaving(false);
    }
  };

  const saveAll = async () => {
    setMsg(null);
    setSaving(true);
    try {
      const assets: { kind: Kind; index: number; dataUri: string }[] = [];
      for (const card of cards) {
        const uri = await capture(card);
        if (uri) assets.push({ kind: card.kind, index: card.index, dataUri: uri });
      }
      if (assets.length === 0) throw new Error('Üretilecek görsel yok');
      const res = await fetch(`/api/ai/drafts/${draftId}/instagram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error((json && json.error) || 'Kaydetme başarısız');
      setMsg({ ok: true, text: `${json.items?.length ?? assets.length} görsel taslağa kaydedildi ✓` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Kaydetme başarısız' });
    } finally {
      setSaving(false);
    }
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setMsg({ ok: true, text: 'Açıklama panoya kopyalandı ✓' });
    } catch {
      setMsg({ ok: false, text: 'Panoya kopyalanamadı.' });
    }
  };

  /* ── 1080px CAPTURE düğümleri ── */
  const T = data?.template;
  const C = T?.colors;
  const fontFamily = displayFont.style.fontFamily;

  const chip = (text: string, bg: string, key: string) => (
    <span
      key={key}
      style={{
        display: 'inline-flex', alignItems: 'center', background: bg, color: '#fff',
        fontSize: 30, fontWeight: 700, letterSpacing: '0.02em', padding: '10px 22px',
        borderRadius: 999, textTransform: 'uppercase',
      }}
    >
      {text}
    </span>
  );

  const renderCover = (ref?: (el: HTMLDivElement | null) => void) => {
    if (!data || !C) return null;
    const { title, category, districtName, newsType, imageUrl, imageIsAi } = data.cover;
    const size = fitTitle(title.length, 84);
    return (
      <div ref={ref} style={{ position: 'relative', width: 1080, height: 1080, overflow: 'hidden', background: C.navy, color: '#fff', fontFamily }}>
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" crossOrigin="anonymous" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: imageUrl
          ? 'linear-gradient(180deg, rgba(11,20,38,0.35) 0%, rgba(11,20,38,0.05) 34%, rgba(7,13,24,0.82) 74%, rgba(7,13,24,0.97) 100%)'
          : `radial-gradient(130% 90% at 15% 0%, ${C.redBright}33, transparent 58%), ${C.navy}` }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 12, background: C.red }} />
        <div style={{ position: 'absolute', top: 56, left: 64, right: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={T!.logo} alt="" style={{ height: 68, width: 'auto' }} />
          <span style={{ fontSize: 30, fontWeight: 600, opacity: 0.92 }}>{T!.handle}</span>
        </div>
        <div style={{ position: 'absolute', left: 64, right: 64, bottom: 64, display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {newsType === 'breaking' && chip('Son Dakika', C.redBright, 'sd')}
            {category && chip(category, C.red, 'cat')}
            {districtName && chip(districtName, 'rgba(255,255,255,0.18)', 'dist')}
          </div>
          <div style={{ fontWeight: 800, fontSize: size, lineHeight: 1.05, letterSpacing: '-0.02em', textShadow: '0 2px 24px rgba(0,0,0,0.45)' }}>
            {title}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 30, fontWeight: 600, opacity: 0.9 }}>
            <span>{T!.website}</span>
            {imageIsAi && <span style={{ opacity: 0.72, fontSize: 24, fontWeight: 500 }}>Temsili görsel</span>}
          </div>
        </div>
      </div>
    );
  };

  const renderSlide = (i: number, ref?: (el: HTMLDivElement | null) => void) => {
    if (!data || !C) return null;
    const text = data.slides[i] || '';
    const total = data.slides.length;
    const size = text.length > 420 ? 40 : text.length > 260 ? 46 : 52;
    return (
      <div ref={ref} style={{ position: 'relative', width: 1080, height: 1080, overflow: 'hidden', background: C.navy, color: '#fff', fontFamily }}>
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 14, background: C.red }} />
        <div style={{ position: 'absolute', top: 56, left: 80, right: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={T!.logo} alt="" style={{ height: 52, width: 'auto' }} />
          <span style={{ fontSize: 30, fontWeight: 700, color: C.gold }}>{i + 1} / {total}</span>
        </div>
        <div style={{ position: 'absolute', top: 200, left: 80, right: 80, bottom: 180, display: 'flex', alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: size, lineHeight: 1.42, fontWeight: 500 }}>{text}</p>
        </div>
        <div style={{ position: 'absolute', left: 80, right: 64, bottom: 64, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 28, fontWeight: 600, opacity: 0.82 }}>
          <span>{T!.handle}</span>
          <span>{T!.website}</span>
        </div>
      </div>
    );
  };

  const renderStory = (ref?: (el: HTMLDivElement | null) => void) => {
    if (!data || !C) return null;
    const { title, category, districtName, newsType, imageUrl, imageIsAi } = data.cover;
    const size = fitTitle(title.length, 100);
    return (
      <div ref={ref} style={{ position: 'relative', width: 1080, height: 1920, overflow: 'hidden', background: C.navy, color: '#fff', fontFamily }}>
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" crossOrigin="anonymous" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 1180, objectFit: 'cover' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: imageUrl
          ? 'linear-gradient(180deg, rgba(11,20,38,0.30) 0%, rgba(11,20,38,0) 28%, rgba(7,13,24,0.75) 58%, rgba(7,13,24,0.98) 82%)'
          : `radial-gradient(120% 55% at 50% 0%, ${C.redBright}33, transparent 60%), ${C.navy}` }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 14, background: C.red }} />
        <div style={{ position: 'absolute', top: 96, left: 72, right: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={T!.logo} alt="" style={{ height: 76, width: 'auto' }} />
          <span style={{ fontSize: 34, fontWeight: 600, opacity: 0.92 }}>{T!.handle}</span>
        </div>
        <div style={{ position: 'absolute', left: 72, right: 72, bottom: 180, display: 'flex', flexDirection: 'column', gap: 34 }}>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {newsType === 'breaking' && chip('Son Dakika', C.redBright, 'sd')}
            {category && chip(category, C.red, 'cat')}
            {districtName && chip(districtName, 'rgba(255,255,255,0.18)', 'dist')}
          </div>
          <div style={{ fontWeight: 800, fontSize: size, lineHeight: 1.06, letterSpacing: '-0.02em', textShadow: '0 2px 28px rgba(0,0,0,0.5)' }}>
            {title}
          </div>
        </div>
        <div style={{ position: 'absolute', left: 72, right: 72, bottom: 90, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 34, fontWeight: 600, opacity: 0.9 }}>
          <span>{T!.website}</span>
          {imageIsAi && <span style={{ opacity: 0.72, fontSize: 26, fontWeight: 500 }}>Temsili görsel</span>}
        </div>
      </div>
    );
  };

  const renderCard = (card: Card, ref?: (el: HTMLDivElement | null) => void) => {
    if (card.kind === 'cover') return renderCover(ref);
    if (card.kind === 'story') return renderStory(ref);
    return renderSlide(card.index, ref);
  };

  const thumbScale = (card: Card) => (card.kind === 'story' ? 176 / 1080 : 248 / 1080);

  const Thumb = ({ card, label }: { card: Card; label: string }) => {
    const s = thumbScale(card);
    return (
      <div className={styles.thumbCard}>
        <div className={styles.thumb} style={{ width: Math.round(card.w * s), height: Math.round(card.h * s) }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: card.w, height: card.h, transform: `scale(${s})`, transformOrigin: 'top left' }}>
            {renderCard(card)}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" disabled={busyId === card.id || saving} onClick={() => downloadOne(card)}>
          {busyId === card.id ? '...' : `⬇ ${label}`}
        </button>
      </div>
    );
  };

  const coverCard = cards.find((c) => c.kind === 'cover');
  const slideCards = cards.filter((c) => c.kind === 'slide');
  const storyCard = cards.find((c) => c.kind === 'story');

  return (
    <div className={styles.overlay} onClick={() => { if (!saving && !busyId) onClose(); }}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>📸 Instagram Post Stüdyosu</h2>
          <button className={styles.close} onClick={onClose} aria-label="Kapat">✕</button>
        </div>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.loading}>İçerik hazırlanıyor…</div>
          ) : error ? (
            <div className={`${styles.msg} ${styles.msgErr}`}>{error}</div>
          ) : data && C ? (
            <>
              {/* Kapak */}
              <div className={styles.section}>
                <div className={styles.sectionHead}>
                  <span className={styles.sectionTitle}>Kapak</span>
                  <span className={styles.sectionHint}>1080×1080 — gönderinin ilk karesi</span>
                </div>
                <div className={styles.thumbRow}>{coverCard && <Thumb card={coverCard} label="Kapak" />}</div>
              </div>

              {/* Carousel */}
              <div className={styles.section}>
                <div className={styles.sectionHead}>
                  <span className={styles.sectionTitle}>Carousel Kartları</span>
                  <span className={styles.sectionHint}>1080×1080 — kapakla birlikte paylaşın</span>
                </div>
                {slideCards.length > 0 ? (
                  <div className={styles.thumbRow}>
                    {slideCards.map((card) => <Thumb key={card.id} card={card} label={`Kart ${card.index + 1}`} />)}
                  </div>
                ) : (
                  <div className={styles.sectionHint}>Gövde kısa olduğundan carousel kartı üretilmedi.</div>
                )}
              </div>

              {/* Story */}
              <div className={styles.section}>
                <div className={styles.sectionHead}>
                  <span className={styles.sectionTitle}>Story</span>
                  <span className={styles.sectionHint}>1080×1920 — dikey hikâye</span>
                </div>
                <div className={styles.thumbRow}>{storyCard && <Thumb card={storyCard} label="Story" />}</div>
              </div>

              {/* Caption */}
              <div className={styles.section}>
                <div className={styles.sectionHead}>
                  <span className={styles.sectionTitle}>Açıklama (caption)</span>
                  <button className="btn btn-ghost btn-sm" onClick={copyCaption}>📋 Kopyala</button>
                </div>
                <textarea className={styles.caption} value={caption} onChange={(e) => setCaption(e.target.value)} />
              </div>

              {/* Off-screen 1080px capture sahnesi (html2canvas ölçer). */}
              <div className={`${styles.stage} ${displayFont.className}`} aria-hidden="true">
                {cards.map((card) => (
                  <div key={card.id}>{renderCard(card, setRef(card.id))}</div>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div className={styles.footer}>
          {msg && <span className={`${styles.msg} ${msg.ok ? styles.msgOk : styles.msgErr}`}>{msg.text}</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Kapat</button>
            <button className="btn btn-ghost" onClick={downloadAll} disabled={saving || loading || !data}>⬇ Tümünü İndir</button>
            <button className="btn btn-primary" onClick={saveAll} disabled={saving || loading || !data}>
              {saving ? 'İşleniyor…' : '💾 Taslağa Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
