import Link from 'next/link';
import ArticleCard, { type ArticleCardData } from './ArticleCard';
import RailControls from './RailControls';

/**
 * Kategori rayı: yatay scroll-snap şeridi, kenarlarda fade mask,
 * ok butonlarıyla (RailControls) kaydırılır. Sunucu bileşenidir.
 */
export default function CategoryRail({
  slug,
  title,
  color,
  articles,
}: {
  slug: string;
  title: string;
  color?: string | null;
  articles: ArticleCardData[];
}) {
  const railId = `rail-${slug}`;
  return (
    <section className="s-section rail-section">
      <div className="s-container">
        <div className="s-section-head s-reveal">
          <h2 className="s-section-title">
            <span className="tick" style={color ? { color } : undefined} aria-hidden="true">/</span> {title}
          </h2>
          <div className="rail-head-actions">
            <Link href={`/kategori/${slug}`} className="rail-all">
              Tümü <span aria-hidden="true">→</span>
            </Link>
            <RailControls targetId={railId} label={title} />
          </div>
        </div>
      </div>
      <div className="s-container rail-wrap">
        <div className="rail" id={railId} role="list" aria-label={`${title} haberleri`}>
          {articles.map((a, i) => (
            <div className="rail-item" role="listitem" key={a.slug}>
              <ArticleCard article={a} revealDelay={Math.min(i * 70, 420)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
