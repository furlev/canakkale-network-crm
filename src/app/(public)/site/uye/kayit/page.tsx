import type { Metadata } from 'next';
import { Suspense } from 'react';
import ReaderAuthForm from '@/components/site/ReaderAuthForm';
import '@/app/(public)/pages.css';

export const metadata: Metadata = {
  title: 'Üye Ol',
  description: 'Çanakkale Network ücretsiz üyeliği ile yorum yap ve premium içeriğe erişimini yükselt.',
  robots: { index: false, follow: false },
};

export default function ReaderRegisterPage() {
  return (
    <div>
      <header className="p-page-head">
        <div className="s-container">
          <span className="s-kicker">Üyelik</span>
          <h1 className="p-page-title">
            Aramıza katıl<span className="tint">.</span>
          </h1>
          <p className="p-page-sub">Ücretsiz üyelikle yorum yap, bülteni yönet, premium içeriğe eriş.</p>
        </div>
      </header>
      <section className="s-section">
        <div className="s-container">
          <Suspense fallback={null}>
            <ReaderAuthForm mode="register" />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
