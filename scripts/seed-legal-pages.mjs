/**
 * KVKK / yasal uyum + basın künyesi statik sayfalarını seed'ler.
 *
 * Çanakkale Network haber sitesi için zorunlu hukuki sayfaları `SitePage`
 * tablosuna ekler:
 *   - kvkk-aydinlatma      → KVKK Aydınlatma Metni (6698 sayılı Kanun m.10)
 *   - cerez-politikasi     → Çerez Politikası (ePrivacy / açık rıza)
 *   - gizlilik-politikasi  → Gizlilik Politikası
 *   - kunye                → Künye (Basın Kanunu — künye zorunluluğu)
 *   - kullanim-kosullari   → Kullanım Koşulları
 *
 * İDEMPOTENT ve GÜVENLİ: var olan bir sayfayı ASLA EZMEZ. Yalnızca eksik
 * slug'ları oluşturur; editörün CRM > Site Yönetimi'nden yaptığı düzenlemeler
 * korunur. Tekrar tekrar çalıştırılabilir.
 *
 * Kullanım:
 *   node scripts/seed-legal-pages.mjs
 *   node scripts/seed-legal-pages.mjs --dry-run   (DB'ye yazmadan raporlar)
 *
 * NOT: İçerikler HUKUKİ TASLAKTIR; köşeli parantez [ ] içindeki alanlar
 * (unvan, adres, VKN, KEP, sorumlu kişi adları) yayına almadan önce gerçek
 * bilgilerle doldurulmalı ve bir hukukçuya kontrol ettirilmelidir.
 */
import { PrismaClient } from '@prisma/client';

const DRY_RUN = process.argv.includes('--dry-run');
const prisma = new PrismaClient();

const SITE_NAME = 'Çanakkale Network';
const SITE_DOMAIN = 'canakkale.network';
const CONTACT_EMAIL = 'info@canakkale.network';
const KVKK_EMAIL = 'kvkk@canakkale.network';
const CORRECTION_EMAIL = 'tekzip@canakkale.network';

// Ortak uyarı bloğu (her taslağın başına eklenir) — yayına almadan doldur.
const DRAFT_NOTICE =
  '<p><em>Bu metin bir taslaktır. Köşeli parantez içindeki alanları gerçek bilgilerle doldurun ' +
  've yayına almadan önce bir hukuk danışmanına inceletin. Düzenleme: CRM &gt; Site Yönetimi &gt; Sayfalar.</em></p>';

const PAGES = [
  {
    slug: 'kvkk-aydinlatma',
    title: 'KVKK Aydınlatma Metni',
    content: [
      DRAFT_NOTICE,
      '<h2>Kişisel Verilerin Korunması Aydınlatma Metni</h2>',
      `<p>6698 sayılı Kişisel Verilerin Korunması Kanunu (&ldquo;KVKK&rdquo;) uyarınca, veri sorumlusu sıfatıyla <strong>${SITE_NAME}</strong> (&ldquo;Site&rdquo;) olarak kişisel verilerinizi aşağıda açıklanan kapsamda işlediğimizi bildiririz.</p>`,
      '<h3>1. Veri Sorumlusu</h3>',
      `<p>Veri sorumlusu: <strong>[YAYIN SAHİBİ / TİCARİ UNVAN]</strong><br>Adres: <strong>[AÇIK ADRES]</strong><br>E-posta: <a href="mailto:${KVKK_EMAIL}">${KVKK_EMAIL}</a></p>`,
      '<h3>2. İşlenen Kişisel Veriler</h3>',
      '<ul>',
      '<li><strong>Kimlik ve iletişim verileri:</strong> ad-soyad, e-posta adresi (bülten aboneliği, iletişim formu, ekibe katılım başvurusu kapsamında).</li>',
      '<li><strong>İşlem güvenliği verileri:</strong> IP adresi, tarayıcı bilgisi, ziyaret kayıtları (yalnızca gerekli/güvenlik amaçlı).</li>',
      '<li><strong>Rızaya bağlı veriler:</strong> analitik ve reklam çerezleri yoluyla toplanan davranışsal veriler (yalnızca açık rıza vermeniz hâlinde).</li>',
      '</ul>',
      '<h3>3. Kişisel Verilerin İşlenme Amaçları</h3>',
      '<ul>',
      '<li>Haber ve içerik hizmetlerinin sunulması,</li>',
      '<li>Bülten ve bildirimlerin gönderilmesi (talebiniz üzerine),</li>',
      '<li>İletişim taleplerinizin yanıtlanması ve başvuruların değerlendirilmesi,</li>',
      '<li>Site güvenliğinin ve hukuki yükümlülüklerin sağlanması,</li>',
      '<li>Rıza vermeniz hâlinde ziyaret istatistiklerinin ölçülmesi ve ilgi alanına yönelik içerik/reklam sunulması.</li>',
      '</ul>',
      '<h3>4. İşlemenin Hukuki Sebebi</h3>',
      '<p>Kişisel verileriniz KVKK m.5 kapsamında; bir sözleşmenin kurulması/ifası, hukuki yükümlülüğün yerine getirilmesi, meşru menfaat ve gerekli hâllerde <strong>açık rızanız</strong> hukuki sebeplerine dayanılarak işlenir. Analitik ve reklam çerezleri yalnızca açık rızanıza dayanır.</p>',
      '<h3>5. Kişisel Verilerin Aktarımı</h3>',
      '<p>Verileriniz; barındırma (hosting), e-posta gönderimi ve rıza vermeniz hâlinde analitik/reklam hizmet sağlayıcıları gibi yurt içi ve/veya yurt dışı tedarikçilerle, yalnızca ilgili hizmetin gerektirdiği ölçüde ve KVKK m.8-9 çerçevesinde paylaşılabilir. Aktarım yapılan taraflar: <strong>[HİZMET SAĞLAYICILAR — ör. hosting, e-posta, analitik]</strong>.</p>',
      '<h3>6. Saklama Süresi</h3>',
      '<p>Kişisel verileriniz, işleme amacının gerektirdiği ve ilgili mevzuatta öngörülen süreler boyunca saklanır; sürelerin dolması hâlinde silinir, yok edilir veya anonim hâle getirilir.</p>',
      '<h3>7. İlgili Kişinin Hakları (KVKK m.11)</h3>',
      '<p>Kişisel verilerinize ilişkin olarak; işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltilmesini/silinmesini isteme, işleme itiraz etme ve zararın giderilmesini talep etme haklarına sahipsiniz. Taleplerinizi <a href="mailto:' + KVKK_EMAIL + '">' + KVKK_EMAIL + '</a> adresine iletebilirsiniz.</p>',
      '<p><em>Son güncelleme: [TARİH]</em></p>',
    ].join('\n'),
  },
  {
    slug: 'cerez-politikasi',
    title: 'Çerez Politikası',
    content: [
      DRAFT_NOTICE,
      '<h2>Çerez (Cookie) Politikası</h2>',
      `<p><strong>${SITE_NAME}</strong> olarak ${SITE_DOMAIN} üzerinde deneyiminizi iyileştirmek için çerezler kullanıyoruz. Bu politika hangi çerezleri, hangi amaçla kullandığımızı ve tercihlerinizi nasıl yönetebileceğinizi açıklar.</p>`,
      '<h3>1. Çerez Nedir?</h3>',
      '<p>Çerezler, ziyaret ettiğiniz sitelerin tarayıcınıza kaydettiği küçük metin dosyalarıdır. Sitenin sizi tanımasına ve tercihlerinizi hatırlamasına yardımcı olur.</p>',
      '<h3>2. Kullandığımız Çerez Türleri</h3>',
      '<table>',
      '<thead><tr><th>Tür</th><th>Amaç</th><th>Rıza</th></tr></thead>',
      '<tbody>',
      '<tr><td><strong>Gerekli çerezler</strong></td><td>Oturum, güvenlik ve temel işlevler; sitenin çalışması için zorunludur.</td><td>Gerekmez (zorunlu)</td></tr>',
      '<tr><td><strong>Analitik çerezler</strong></td><td>Hangi içeriklerin okunduğunu anonim olarak ölçer.</td><td><strong>Açık rıza</strong></td></tr>',
      '<tr><td><strong>Reklam çerezleri</strong></td><td>İlgi alanınıza uygun reklamların gösterilmesi.</td><td><strong>Açık rıza</strong></td></tr>',
      '</tbody>',
      '</table>',
      '<h3>3. Rıza ve Tercih Yönetimi</h3>',
      '<p>Analitik ve reklam çerezleri, çerez rıza banner&rsquo;ında <strong>açık rızanızı vermeden</strong> çalıştırılmaz. &ldquo;Yalnızca gerekli&rdquo;, &ldquo;Tümünü kabul&rdquo; veya &ldquo;Ayarlar&rdquo; seçenekleriyle tercihinizi belirleyebilirsiniz. Tercihiniz cihazınızda <strong>1 yıl</strong> saklanır; süre sonunda yeniden sorulur.</p>',
      '<h3>4. Çerezleri Nasıl Silerim?</h3>',
      '<p>Tarayıcınızın ayarlarından çerezleri istediğiniz zaman silebilir veya engelleyebilirsiniz. Gerekli çerezleri engellemeniz sitenin bazı işlevlerini etkileyebilir.</p>',
      '<h3>5. Daha Fazla Bilgi</h3>',
      `<p>Kişisel verilerinizin işlenmesine ilişkin ayrıntılar için <a href="/kvkk-aydinlatma">KVKK Aydınlatma Metni</a> ve <a href="/gizlilik-politikasi">Gizlilik Politikası</a> sayfalarımıza bakabilirsiniz. Sorularınız için: <a href="mailto:${KVKK_EMAIL}">${KVKK_EMAIL}</a>.</p>`,
      '<p><em>Son güncelleme: [TARİH]</em></p>',
    ].join('\n'),
  },
  {
    slug: 'gizlilik-politikasi',
    title: 'Gizlilik Politikası',
    content: [
      DRAFT_NOTICE,
      '<h2>Gizlilik Politikası</h2>',
      `<p><strong>${SITE_NAME}</strong> (&ldquo;Site&rdquo;) olarak gizliliğinize önem veriyoruz. Bu politika, ${SITE_DOMAIN} üzerinden hangi bilgileri topladığımızı ve bunları nasıl koruduğumuzu açıklar. Kişisel verilerin işlenmesine ilişkin ayrıntılı bilgi <a href="/kvkk-aydinlatma">KVKK Aydınlatma Metni</a> içinde yer alır.</p>`,
      '<h3>1. Topladığımız Bilgiler</h3>',
      '<ul>',
      '<li><strong>Sizin verdiğiniz bilgiler:</strong> bülten aboneliği, iletişim formu veya başvuru sırasında paylaştığınız ad ve e-posta.</li>',
      '<li><strong>Otomatik toplanan bilgiler:</strong> IP adresi, tarayıcı/cihaz bilgisi ve ziyaret kayıtları (güvenlik ve temel işlevler için).</li>',
      '<li><strong>Rızaya bağlı bilgiler:</strong> yalnızca onayınızla çalışan analitik ve reklam çerezleri verileri.</li>',
      '</ul>',
      '<h3>2. Bilgileri Kullanma Amaçlarımız</h3>',
      '<p>Bilgileri; hizmetin sunulması, taleplerinizin yanıtlanması, bülten gönderimi, güvenliğin sağlanması ve (rıza hâlinde) istatistik ve içerik/reklam kişiselleştirmesi amacıyla kullanırız. Verilerinizi izniniz olmadan satmayız.</p>',
      '<h3>3. Üçüncü Taraflar</h3>',
      '<p>Barındırma, e-posta ve rıza verilen analitik/reklam hizmetleri için tedarikçilerle çalışabiliriz. Bu taraflar verilerinizi yalnızca bizim adımıza ve tanımlanan amaçlarla işler.</p>',
      '<h3>4. Veri Güvenliği</h3>',
      '<p>Kişisel verilerinizi yetkisiz erişime karşı korumak için makul teknik ve idari tedbirleri uygularız. Ancak internet üzerinden hiçbir aktarımın %100 güvenli olmadığını hatırlatırız.</p>',
      '<h3>5. Çocukların Gizliliği</h3>',
      '<p>Site 18 yaşından küçüklerden bilerek kişisel veri toplamaz.</p>',
      '<h3>6. İletişim</h3>',
      `<p>Gizlilikle ilgili sorularınız için: <a href="mailto:${KVKK_EMAIL}">${KVKK_EMAIL}</a>.</p>`,
      '<p><em>Son güncelleme: [TARİH]</em></p>',
    ].join('\n'),
  },
  {
    slug: 'kunye',
    title: 'Künye',
    content: [
      DRAFT_NOTICE,
      '<h2>Künye</h2>',
      `<p><strong>${SITE_NAME}</strong> — Şehrin Dijital Meydanı</p>`,
      '<p>5187 sayılı Basın Kanunu ve ilgili mevzuat uyarınca yayın künyesi aşağıda yer almaktadır.</p>',
      '<table>',
      '<tbody>',
      '<tr><td><strong>Yayın Sahibi (İmtiyaz Sahibi)</strong></td><td>[YAYIN SAHİBİ / TİCARİ UNVAN]</td></tr>',
      '<tr><td><strong>Sorumlu Yazı İşleri Müdürü</strong></td><td>[AD SOYAD]</td></tr>',
      '<tr><td><strong>Genel Yayın Yönetmeni</strong></td><td>[AD SOYAD]</td></tr>',
      `<tr><td><strong>Yayın Türü</strong></td><td>Süreli internet haber yayını (${SITE_DOMAIN})</td></tr>`,
      '<tr><td><strong>Yönetim Yeri / Adres</strong></td><td>[AÇIK ADRES — Çanakkale]</td></tr>',
      `<tr><td><strong>İletişim</strong></td><td><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></td></tr>`,
      '<tr><td><strong>Telefon</strong></td><td>[TELEFON]</td></tr>',
      '<tr><td><strong>KEP Adresi</strong></td><td>[KEP ADRESİ]</td></tr>',
      `<tr><td><strong>Tekzip / Düzeltme Başvurusu</strong></td><td><a href="mailto:${CORRECTION_EMAIL}">${CORRECTION_EMAIL}</a></td></tr>`,
      '</tbody>',
      '</table>',
      '<h3>Tekzip ve Düzeltme Hakkı</h3>',
      `<p>Yayınlarımızla ilgili düzeltme ve cevap (tekzip) taleplerinizi <a href="mailto:${CORRECTION_EMAIL}">${CORRECTION_EMAIL}</a> adresine iletebilirsiniz. Başvurular Basın Kanunu&rsquo;nda öngörülen usul ve süreler çerçevesinde değerlendirilir.</p>`,
      '<p><em>Son güncelleme: [TARİH]</em></p>',
    ].join('\n'),
  },
  {
    slug: 'kullanim-kosullari',
    title: 'Kullanım Koşulları',
    content: [
      DRAFT_NOTICE,
      '<h2>Kullanım Koşulları</h2>',
      `<p>${SITE_DOMAIN} (&ldquo;Site&rdquo;) sitesini kullanarak aşağıdaki koşulları kabul etmiş sayılırsınız. Koşulları kabul etmiyorsanız lütfen Site&rsquo;yi kullanmayınız.</p>`,
      '<h3>1. İçerik ve Telif Hakları</h3>',
      `<p>Site&rsquo;deki haber, yazı, görsel ve diğer içeriklerin hakları ${SITE_NAME}&rsquo;e veya ilgili hak sahiplerine aittir. İçerikler, kaynak gösterilmeden ve izin alınmadan kopyalanamaz, çoğaltılamaz veya ticari amaçla kullanılamaz.</p>`,
      '<h3>2. Kullanıcı Yükümlülükleri</h3>',
      '<ul>',
      '<li>Site&rsquo;yi hukuka ve genel ahlaka aykırı amaçlarla kullanmamak,</li>',
      '<li>Site&rsquo;nin güvenliğini ve işleyişini tehlikeye atacak eylemlerde bulunmamak,</li>',
      '<li>Yorum ve katkılarda üçüncü kişilerin haklarını ihlal etmemek.</li>',
      '</ul>',
      '<h3>3. Sorumluluğun Sınırlandırılması</h3>',
      '<p>İçerikler bilgilendirme amaçlıdır. Site, içeriklerin güncelliği ve doğruluğu için makul çabayı gösterir; ancak içeriklere dayanılarak alınan kararlardan doğabilecek zararlardan sorumlu tutulamaz. Site&rsquo;de yer alan dış bağlantıların içeriğinden ilgili üçüncü taraflar sorumludur.</p>',
      '<h3>4. Yayın İlkeleri ve Düzeltme</h3>',
      `<p>Haberlerimizi basın etiği çerçevesinde hazırlarız. Bir yayında maddi hata tespit edilmesi hâlinde düzeltme yapılır ve haber üzerinde açıkça belirtilir. Düzeltme/tekzip talepleri için: <a href="mailto:${CORRECTION_EMAIL}">${CORRECTION_EMAIL}</a>.</p>`,
      '<h3>5. Değişiklikler</h3>',
      '<p>Bu koşullar gerektiğinde güncellenebilir. Güncel sürüm bu sayfada yayımlanır.</p>',
      '<h3>6. Uygulanacak Hukuk</h3>',
      '<p>Bu koşullar Türkiye Cumhuriyeti hukukuna tabidir; uyuşmazlıklarda [YETKİLİ MAHKEME/İCRA — ör. Çanakkale] mahkemeleri ve icra daireleri yetkilidir.</p>',
      '<p><em>Son güncelleme: [TARİH]</em></p>',
    ].join('\n'),
  },
];

async function main() {
  console.log(
    `Yasal sayfa seed'i başlıyor${DRY_RUN ? '  [DRY-RUN: DB\'ye yazılmayacak]' : ''}\n`
  );

  let created = 0;
  const skipped = [];

  for (const page of PAGES) {
    const existing = await prisma.sitePage.findUnique({
      where: { slug: page.slug },
      select: { slug: true },
    });

    if (existing) {
      skipped.push(page.slug);
      console.log(`  ⏭  "${page.slug}" zaten var — dokunulmadı (düzenlemeler korundu).`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [dry-run] "${page.slug}" (${page.title}) oluşturulacak.`);
      created++;
      continue;
    }

    await prisma.sitePage.create({
      data: {
        slug: page.slug,
        title: page.title,
        content: page.content,
        status: 'published',
        updatedBy: 'seed-legal-pages',
      },
    });
    created++;
    console.log(`  ✅ "${page.slug}" (${page.title}) oluşturuldu.`);
  }

  console.log('\n══════════ ÖZET ══════════');
  console.log(`  Oluşturulan : ${created}`);
  console.log(`  Atlanan     : ${skipped.length}${skipped.length ? ` (${skipped.join(', ')})` : ''}`);
  console.log(
    '\n  ⚠  İçerikler TASLAKTIR: köşeli parantez [ ] alanlarını (unvan, adres, VKN/KEP,\n' +
      '     sorumlu kişi adları, tarih) gerçek bilgilerle doldurup hukukçuya inceletin.\n' +
      '     Düzenleme: CRM > Site Yönetimi > Sayfalar.'
  );
  if (DRY_RUN) console.log('\n[DRY-RUN] Hiçbir veri yazılmadı.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async e => {
    console.error('\nSEED BAŞARISIZ:', e.message || e);
    await prisma.$disconnect();
    process.exit(1);
  });
