import type { Metadata } from 'next';
import { Suspense } from 'react';
import ReaderAuthForm from '@/components/site/ReaderAuthForm';
import '@/app/(public)/pages.css';

export const metadata: Metadata = {
  title: 'Giriş Yap',
  description: 'Çanakkale Network üyeliğinle giriş yap.',
  robots: { index: false, follow: false },
};

export default function ReaderLoginPage() {
  return (
    <div>
      <header className="p-page-head">
        <div className="s-container">
          <span className="s-kicker">Üyelik</span>
          <h1 className="p-page-title">
            Hoş geldin<span className="tint">.</span>
          </h1>
          <p className="p-page-sub">Hesabınla giriş yap; üyelik ve premium ayarların hazır.</p>
        </div>
      </header>
      <section className="s-section">
        <div className="s-container">
          <Suspense fallback={null}>
            <ReaderAuthForm mode="login" />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
