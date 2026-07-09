import Link from 'next/link';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';
import styles from './takvim.module.css';

/** DB'den istek anında okur → statik önbelleğe alınmaz. */
export const dynamic = 'force-dynamic';

const TZ = 'Europe/Istanbul';
const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Bir tarihin Europe/Istanbul saatine göre 'YYYY-MM-DD' anahtarı. */
function dayKeyTR(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
/** Europe/Istanbul saatine göre 'HH:MM'. */
function timeTR(d: Date): string {
  return new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(d);
}
/** Bugünün Istanbul-tz gün anahtarı. */
function todayKeyTR(): string {
  return dayKeyTR(new Date());
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TakvimPage(context: Props) {
  const session = await getSession();
  if (!isLeaderOrAdmin(session)) {
    return (
      <div>
        <div className="page-header">
          <div className="page-header-left">
            <h1 className="page-title">🗓️ Yayın Takvimi</h1>
          </div>
        </div>
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
          Bu sayfa için ekip lideri/yönetici yetkisi gerekli.
        </div>
      </div>
    );
  }

  const sp = await context.searchParams;
  const monthParam = typeof sp.month === 'string' ? sp.month : '';

  // Geçerli ay (?month=YYYY-MM), yoksa bu ay (Istanbul).
  const nowKey = todayKeyTR(); // YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})$/.exec(monthParam);
  const year = m ? parseInt(m[1], 10) : parseInt(nowKey.slice(0, 4), 10);
  const month0 = m ? parseInt(m[2], 10) - 1 : parseInt(nowKey.slice(5, 7), 10) - 1; // 0-based

  // Sorgu penceresi: ay başı/sonu ± 12s tampon (TZ kayması emniyeti).
  const rangeFrom = new Date(Date.UTC(year, month0, 1, -12));
  const rangeTo = new Date(Date.UTC(year, month0 + 1, 1, 12));

  const [drafts, articles] = await Promise.all([
    prisma.aiDraft.findMany({
      where: {
        scheduledAt: { gte: rangeFrom, lt: rangeTo },
        articleId: null,
        status: { notIn: ['rejected', 'published'] },
      },
      orderBy: { scheduledAt: 'asc' },
      select: { id: true, title: true, topic: true, scheduledAt: true, newsType: true },
    }),
    prisma.siteArticle.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: { gte: rangeFrom, lt: rangeTo },
        deletedAt: null,
      },
      orderBy: { scheduledAt: 'asc' },
      select: { id: true, title: true, slug: true, scheduledAt: true, newsType: true },
    }),
  ]);

  // Gün anahtarına göre grupla.
  type Entry = { kind: 'draft' | 'article'; id: string; title: string; time: string; href: string };
  const byDay = new Map<string, Entry[]>();
  const push = (key: string, e: Entry) => {
    const arr = byDay.get(key);
    if (arr) arr.push(e); else byDay.set(key, [e]);
  };
  for (const d of drafts) {
    if (!d.scheduledAt) continue;
    push(dayKeyTR(d.scheduledAt), {
      kind: 'draft', id: d.id, title: d.title || d.topic, time: timeTR(d.scheduledAt), href: '/ai-news',
    });
  }
  for (const a of articles) {
    if (!a.scheduledAt) continue;
    push(dayKeyTR(a.scheduledAt), {
      kind: 'article', id: a.id, title: a.title, time: timeTR(a.scheduledAt), href: `/site-yonetimi/haber/${a.id}`,
    });
  }

  // Izgara: ayın gün sayısı + Pazartesi-başlı hafta ofseti.
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const firstWeekday = (new Date(year, month0, 1).getDay() + 6) % 7; // 0=Pzt
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  // Önceki/sonraki ay linkleri.
  const prev = month0 === 0 ? { y: year - 1, m: 11 } : { y: year, m: month0 - 1 };
  const next = month0 === 11 ? { y: year + 1, m: 0 } : { y: year, m: month0 + 1 };
  const monthHref = (y: number, mo: number) => `/site-yonetimi/takvim?month=${y}-${pad2(mo + 1)}`;

  const totalScheduled = drafts.length + articles.length;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">🗓️ Yayın Takvimi</h1>
          <p className="page-subtitle">
            <Link href="/site-yonetimi" style={{ color: 'var(--primary-light)', textDecoration: 'none' }}>← Site Yönetimi</Link>
            {' '}· zamanlanmış taslak ve haberler (salt görünüm)
          </p>
        </div>
      </div>

      <div className="card">
        <div className={styles.bar}>
          <Link href={monthHref(prev.y, prev.m)} className="btn btn-ghost btn-sm">← Önceki</Link>
          <span className={styles.monthLabel}>{MONTHS[month0]} {year}</span>
          <Link href={monthHref(next.y, next.m)} className="btn btn-ghost btn-sm">Sonraki →</Link>
        </div>

        <div className={styles.weekhead}>
          {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
        </div>

        <div className={styles.grid}>
          {cells.map((day, i) => {
            if (day === null) return <div key={i} className={`${styles.cell} ${styles.empty}`} />;
            const key = `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
            const entries = byDay.get(key) || [];
            const isToday = key === nowKey;
            return (
              <div key={i} className={`${styles.cell} ${isToday ? styles.today : ''}`}>
                <span className={styles.daynum}>{day}</span>
                {entries.map((e) => (
                  <Link
                    key={`${e.kind}-${e.id}`}
                    href={e.href}
                    className={`${styles.item} ${e.kind === 'draft' ? styles.draft : styles.article}`}
                    title={`${e.time} · ${e.kind === 'draft' ? 'AI taslağı' : 'Haber'} · ${e.title}`}
                  >
                    <span className={styles.itemTime}>{e.time}</span>{e.title}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>

        <div className={styles.legend}>
          <span><i className={styles.dot} style={{ background: 'var(--accent)' }} /> Zamanlanmış AI taslağı</span>
          <span><i className={styles.dot} style={{ background: 'var(--success)' }} /> Zamanlanmış haber</span>
          <span style={{ marginLeft: 'auto' }}>Bu ay toplam {totalScheduled} zamanlanmış öğe</span>
        </div>
      </div>
    </div>
  );
}
