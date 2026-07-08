/**
 * Kategori bazlı haber yazım şablonları (P1).
 *
 * Her kategori için AI'a eklenecek {systemInstruction, structure} çifti. `ai.ts`
 * `writeArticleFromTopic` kategoriye göre şablonu seçip sistem yönergesine ve içerik
 * talimatına ekler. Editör `Setting('styleGuide')` ile bunları override edebilir.
 *
 * Saf/deterministik (prisma/ai import etmez) → hem üretim hattı hem test güvenle çağırır.
 */

export type CategoryKey = 'asayis' | 'spor' | 'kultur' | 'ekonomi' | 'resmi' | 'genel';

export type CategoryTemplate = {
  key: CategoryKey;
  label: string;
  /** Sistem yönergesine EKLENECEK kategori-özel kural metni. */
  systemInstruction: string;
  /** İçerik promptuna EKLENECEK yapı/biçim talimatı. */
  structure: string;
};

/**
 * Editör stil rehberi (opsiyonel override). `global` tüm kategorilere, `byCategory`
 * yalnız ilgili kategoriye uygulanır. Setting('styleGuide') JSON'u bu şekle çözülür;
 * düz string verilirse `{ global }` sayılır (ai.ts getStyleGuide bunu yapar).
 */
export type StyleGuide = {
  global?: string;
  byCategory?: Partial<Record<CategoryKey, string>>;
};

/** Serbest kategori metnini (TR) kanonik şablon anahtarına indirger. */
export function categoryKey(category?: string | null): CategoryKey {
  const c = (category || '').toLocaleLowerCase('tr-TR');
  if (/asay[iı]ş|asayis|kaza|olay|adli|adlî|güvenlik|guvenlik|polis|jandarma|yang[iı]n|kavga|cinayet|h[iı]rs[iı]z|uyu[şs]turucu|operasyon|göçük|gocuk|silah|tutukla|gözalt[iı]/.test(c)) return 'asayis';
  if (/spor|futbol|basketbol|voleybol|ma[çc]|lig|[şs]ampiyon|müsabaka|musabaka|tak[iı]m|deplasman|dünya kupas[iı]|turnuva/.test(c)) return 'spor';
  if (/kültür|kultur|sanat|festival|konser|sergi|tiyatro|sinema|etkinlik|müze|muze|kitap|edebiyat|ödül|odul|panel/.test(c)) return 'kultur';
  if (/ekonomi|finans|piyasa|ticaret|i[şs] dünyas[iı]|tar[iı]m|turizm|istihdam|enflasyon|yat[iı]r[iı]m|esnaf|ihracat|üretim|uretim/.test(c)) return 'ekonomi';
  if (/resmi|resmî|duyuru|valilik|belediye|kaymakam|a[çc][iı]klama|genelge|ihale|kamu|tebli[ğg]|karar|yürürlük|yururluk/.test(c)) return 'resmi';
  return 'genel';
}

const TEMPLATES: Record<CategoryKey, CategoryTemplate> = {
  asayis: {
    key: 'asayis',
    label: 'Asayiş / Adli',
    systemInstruction:
      'Bu bir ASAYİŞ/adli haber. Masumiyet karinesine kesinlikle uy: hüküm kesinleşmeden kimseyi suçlu ilan etme; "iddia edildi", "öne sürüldü", "gözaltına alındı", "şüpheli" gibi ifadeler kullan. Şüpheli, mağdur ve tanıkların AÇIK KİMLİĞİNİ (tam ad soyad) VERME — yalnızca baş harflerini kullan (ör. "A.Y."). Çocuk mağdurların ve cinsel suç mağdurlarının kimliğini ASLA ifşa etme. Sansasyondan ve gereksiz kan/şiddet detayından kaçın.',
    structure:
      'Spot cümlesinin ardından olayı 5N1K çerçevesinde ver: Ne oldu, Nerede, Ne zaman, Nasıl, Neden ve Kim(ler). Bilgiyi hangi resmi kaynağa (emniyet/jandarma/valilik/sağlık) dayandırdığını açıkça belirt. Adli süreç sürüyorsa bunu son paragrafta not düş.',
  },
  spor: {
    key: 'spor',
    label: 'Spor',
    systemInstruction:
      'Bu bir SPOR haberi. Taraf tutmayan, nesnel bir dille yaz; sonucu, skoru ve karşılaşmanın dönüm noktalarını net aktar. Abartılı taraftar dilinden kaçın.',
    structure:
      'Karşılaşmanın taraflarını, KESİN SKORU, lig/grup adını ve tarih/saat/stat bilgisini ver. Öne çıkan oyuncuları, gol/sayı dakikalarını ve varsa teknik direktör/oyuncu açıklamalarını ekle. İlgiliyse kadro, sakatlık ve kart durumunu aktar; bir sonraki maçı belirt.',
  },
  kultur: {
    key: 'kultur',
    label: 'Kültür-Sanat',
    systemInstruction:
      'Bu bir KÜLTÜR-SANAT haberi. Etkinliği, okuyucunun katılmasını sağlayacak pratik bilgilerle; sıcak ama abartısız bir dille anlat.',
    structure:
      'Etkinliğin adını, TARİHİNİ ve SAATİNİ, YERİNİ (mekan/ilçe), varsa bilet/ücret bilgisini ve nasıl katılınacağını net ver. Sanatçı/eser/organizatör hakkında kısa bir bağlam ekle; program akışını özetle.',
  },
  ekonomi: {
    key: 'ekonomi',
    label: 'Ekonomi',
    systemInstruction:
      'Bu bir EKONOMİ haberi. Rakamları bağlamıyla ver, panik/abartı dilinden kaçın; her veriyi kaynağına ve dönemine bağla.',
    structure:
      'İlgili rakam/oranı, bunu açıklayan KURUMU/kaynağı ve karşılaştırma dönemini (önceki yıl/ay) belirt. Gelişmenin Çanakkale özelindeki yerel etkisini (esnaf, tarım, turizm, istihdam) somut biçimde açıkla.',
  },
  resmi: {
    key: 'resmi',
    label: 'Resmi Duyuru',
    systemInstruction:
      'Bu bir RESMİ DUYURU/kamu haberi. Resmi açıklamayı sadeleştirerek aktar; kendi yorumunu KATMA, resmi kaynağa sadık kal.',
    structure:
      'Duyuruyu yapan KURUMU, kararın/uygulamanın ne olduğunu, YÜRÜRLÜK/geçerlilik tarihini ve KİMLERİ etkilediğini net ver. Varsa başvuru yöntemini, son tarihi ve iletişim/adres bilgisini ekle.',
  },
  genel: {
    key: 'genel',
    label: 'Genel',
    systemInstruction: '',
    structure:
      'Haberi ters piramit yapısıyla yaz: en önemli bilgi başta, ayrıntılar sonra. 5N1K sorularını (Ne, Nerede, Ne zaman, Nasıl, Neden, Kim) yanıtla ve bilgiyi bir kaynağa dayandır.',
  },
};

/** Kategoriye uygun şablonu döndürür (eşleşme yoksa 'genel'). */
export function getCategoryTemplate(category?: string | null): CategoryTemplate {
  return TEMPLATES[categoryKey(category)];
}

/**
 * Editör stil rehberinden (varsa) ilgili kategoriye uygulanacak override metnini
 * birleştirir (global + kategoriye özel). Token şişmesine karşı sınırlanır.
 */
export function resolveStyleOverride(sg: StyleGuide | null | undefined, category?: string | null): string {
  if (!sg) return '';
  const key = categoryKey(category);
  const parts: string[] = [];
  if (typeof sg.global === 'string' && sg.global.trim()) parts.push(sg.global.trim());
  const byCat = sg.byCategory?.[key];
  if (typeof byCat === 'string' && byCat.trim()) parts.push(byCat.trim());
  return parts.join(' ').slice(0, 1200);
}
