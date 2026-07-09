import type { Metadata } from 'next';
import '@/app/(public)/pages.css';

export const revalidate = 3600;

const SITE_URL = 'https://canakkale.network';

export const metadata: Metadata = {
  title: 'Görsel Kullanım Politikası',
  description:
    'Çanakkale Network haber görsellerinin kaynağı, telif ve yapay zekâ ile üretilen temsili görseller hakkında bilgilendirme.',
  alternates: { canonical: `${SITE_URL}/gorsel-politikasi` },
  openGraph: {
    title: 'Görsel Kullanım Politikası — Çanakkale Network',
    description:
      'Haber görsellerinin kaynağı, telif atfı ve yapay zekâ ile üretilen temsili görseller hakkında.',
    url: `${SITE_URL}/gorsel-politikasi`,
    siteName: 'Çanakkale Network',
    locale: 'tr_TR',
  },
};

export default function ImagePolicyPage() {
  return (
    <div>
      <header className="p-page-head">
        <div className="s-container">
          <span className="s-kicker">Şeffaflık</span>
          <h1 className="p-page-title">
            Görsel Kullanım Politikası<span className="tint">.</span>
          </h1>
          <p className="p-page-sub">
            Haberlerimizde kullanılan görsellerin kaynağı, telif hakları ve yapay zekâ ile üretilen
            temsili görseller hakkında bilmeniz gerekenler.
          </p>
        </div>
      </header>

      <section className="s-section">
        <div className="s-container">
          <div className="p-static-body">
            <div className="prose">
              <h2>Gerçek fotoğraflar</h2>
              <p>
                Bir haberde gerçek bir olay fotoğrafı kullanıldığında, görselin kaynağı görsel alt
                metninde <strong>“Fotoğraf: [kaynak]”</strong> biçiminde belirtilir. Bu görseller
                yalnızca kendi muhabirlerimizden ya da içeriği paylaşıma açık yerel/resmi
                kaynaklardan alınır; kaynak atfı korunur.
              </p>

              <h2>Temsili (yapay zekâ) görseller</h2>
              <p>
                Uygun bir gerçek fotoğrafın bulunmadığı durumlarda, haberin konusunu görselleştirmek
                için yapay zekâ ile <strong>temsili görsel</strong> üretilebilir. Bu görseller
                gerçek bir anı, kişiyi veya olayı belgelemez; yalnızca konuyu temsil eder ve haberin
                üzerinde <strong>“Temsili görsel — yapay zekâ ile üretilmiştir”</strong> ibaresiyle
                açıkça işaretlenir. Bu görsellere Çanakkale Network logosu filigranı eklenir.
              </p>

              <h2>Telif ve düzeltme talepleri</h2>
              <p>
                Bir görselin telif hakkına ilişkin bir itirazınız veya düzeltme talebiniz varsa,
                bizimle iletişime geçtiğinizde görsel ivedilikle incelenir; gerekli görülürse
                kaldırılır veya kaynağı düzeltilir. Talepleriniz için{' '}
                <a href="/iletisim">iletişim sayfamızı</a> kullanabilirsiniz.
              </p>

              <p className="note">
                Bu politika, editoryal şeffaflık ilkemizin bir parçasıdır ve zaman zaman
                güncellenebilir.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
