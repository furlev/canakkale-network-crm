/**
 * Haber kartı iskeleti — ArticleCard ile aynı ölçüler (CLS=0). Marka kızılı shimmer
 * .s-skel utility'sinden gelir (site.css). Etkileşimsiz, aria-hidden.
 * variant='row' yatay (yan sütun) kart iskeleti.
 */
export default function SkeletonCard({ variant = 'default' }: { variant?: 'default' | 'row' }) {
  return (
    <div className={`s-card s-skel-card ${variant === 'row' ? 's-card-row' : ''}`} aria-hidden="true">
      <div className="s-card-media s-skel" />
      <div className="s-card-body">
        <span className="s-skel s-skel-line" style={{ width: '92%' }} />
        <span className="s-skel s-skel-line" style={{ width: '68%' }} />
        {variant === 'default' && <span className="s-skel s-skel-line s-skel-sm" style={{ width: '84%' }} />}
        <span className="s-skel s-skel-line s-skel-meta" style={{ width: '46%' }} />
      </div>
    </div>
  );
}
