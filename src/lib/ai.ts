import { GoogleGenAI, Type } from '@google/genai';
import prisma from '@/lib/prisma';
import { decryptSecret } from '@/lib/secure';

/**
 * Google Gemini (2.5 Flash) entegrasyonu. Anahtar önce GEMINI_API_KEY ortam
 * değişkeninden, yoksa Ayarlar'daki 'ai' bölümünden okunur. Anahtar yoksa
 * yardımcılar AiNotConfiguredError fırlatır — çağıran kibarca 400 döndürür.
 */

export const AI_MODEL = 'gemini-3.5-flash';

/** Metin gömme (embedding) modeli — çoklu-kaynak teyidi için kümeleme. Vertex + AI Studio ortak. */
export const EMBED_MODEL = process.env.AI_EMBED_MODEL || 'text-embedding-004';

/** Vertex AI modu: GCP projesi + bölge env'de tanımlıysa, ADC (servis hesabı)
 *  ile Cloud faturalı (kredi geçerli) Vertex kullanılır. Aksi halde GEMINI_API_KEY
 *  ya da Ayarlar'daki anahtarla AI Studio (Developer API) kullanılır. */
const VERTEX_PROJECT = process.env.GOOGLE_VERTEX_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '';
const VERTEX_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'global';

export class AiNotConfiguredError extends Error {
  constructor() {
    super('AI yapılandırılmamış. Vertex için GOOGLE_VERTEX_PROJECT, ya da Ayarlar/GEMINI_API_KEY ile bir Gemini API anahtarı tanımlayın.');
    this.name = 'AiNotConfiguredError';
  }
}

let cachedKey: string | null | undefined;

async function resolveKey(): Promise<string | null> {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (cachedKey !== undefined) return cachedKey;
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'ai' } });
    const parsed = row ? JSON.parse(row.value) : null;
    // apiKey DB'de şifreli (enc:v1:) olabilir — düz metinse decryptSecret olduğu gibi döndürür
    cachedKey = (parsed && typeof parsed.apiKey === 'string' && parsed.apiKey) ? decryptSecret(parsed.apiKey) : null;
  } catch {
    cachedKey = null;
  }
  return cachedKey ?? null;
}

/** Ayarlar değişince anahtar önbelleğini boşalt (settings PUT'tan çağrılır). */
export function clearAiKeyCache() {
  cachedKey = undefined;
}

async function getClient(): Promise<GoogleGenAI> {
  if (VERTEX_PROJECT) {
    const opts: ConstructorParameters<typeof GoogleGenAI>[0] = {
      vertexai: true,
      project: VERTEX_PROJECT,
      location: VERTEX_LOCATION,
    };
    // App Platform / dosyasız ortam: servis hesabı JSON'u env'den (GOOGLE_VERTEX_CREDENTIALS_JSON).
    // Tanımlı değilse google-auth-library varsayılan ADC'yi (GOOGLE_APPLICATION_CREDENTIALS dosyası) kullanır.
    const credJson = process.env.GOOGLE_VERTEX_CREDENTIALS_JSON;
    if (credJson) {
      try {
        opts.googleAuthOptions = { credentials: JSON.parse(credJson) };
      } catch {
        // Fail-fast: bozuk credential sessizce ADC'ye düşüp prod'da runtime hatasına yol açmasın
        throw new Error('[ai] GOOGLE_VERTEX_CREDENTIALS_JSON geçersiz JSON — Vertex kimliği yüklenemedi');
      }
    }
    return new GoogleGenAI(opts);
  }
  const key = await resolveKey();
  if (!key) throw new AiNotConfiguredError();
  return new GoogleGenAI({ apiKey: key });
}

/** Model JSON çıktısını güvenle ayrıştırır: boş/SAFETY-bloklu/MAX_TOKENS-kesik yanıtta
 *  ham JSON.parse yerine anlamlı hata fırlatır (çağıran kibarca yakalar). */
type AiTextResult = { text?: string; candidates?: Array<{ finishReason?: string }> };
function parseAiJson<T>(res: AiTextResult, kind: 'object' | 'array' = 'object'): T {
  const text = (res.text ?? '').trim();
  const fr = res.candidates?.[0]?.finishReason;
  if (!text) throw new Error(`AI boş yanıt döndürdü${fr ? ` (finishReason: ${fr})` : ''}`);
  try {
    return JSON.parse(text) as T;
  } catch {
    // Bazı yanıtlar ```json ... ``` sarabilir veya baş/son metin ekleyebilir → gövdeyi çıkar
    const m = text.match(kind === 'array' ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]) as T; } catch { /* aşağıda hata fırlatılır */ }
    }
    throw new Error(`AI geçersiz JSON döndürdü${fr === 'MAX_TOKENS' ? ' (yanıt token limitinde kesildi)' : fr ? ` (finishReason: ${fr})` : ''}`);
  }
}

export async function aiEnabled(): Promise<boolean> {
  if (VERTEX_PROJECT) return true;
  return (await resolveKey()) !== null;
}

/* ── Dayanıklılık & giriş/çıkış hijyeni yardımcıları ── */

/** Geçici (transient) hata mı? Yapılandırma ve güvenlik-bloğu hatalarında tekrar denemek anlamsız. */
function isTransientAiError(e: unknown): boolean {
  if (e instanceof AiNotConfiguredError) return false;
  const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  if (/SAFETY|PROHIBITED_CONTENT|BLOCKLIST|blocked/i.test(msg)) return false; // güvenlik bloğu
  return /(\b5\d{2}\b|\b429\b|timeout|timed?\s?out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|EPIPE|fetch failed|network|socket|UNAVAILABLE|DEADLINE_EXCEEDED|RESOURCE_EXHAUSTED|INTERNAL|overloaded|aborted)/i.test(msg);
}

/** Üstel backoff + jitter ile tekrar dener. Yalnızca geçici (ağ/5xx/timeout) hatalarda. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseMs = 1500): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i === attempts - 1 || !isTransientAiError(e)) throw e;
      const delay = baseMs * 2 ** i + Math.floor(Math.random() * 500); // üstel backoff + jitter
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr; // (buraya normalde düşülmez)
}

/** Kullanıcı/dış kaynak metnini prompt'a gömmeden önce temizler:
 *  kontrol karakterlerini siler, tekrarlı boşlukları sıkıştırır, uzunluğu sınırlar
 *  (prompt-injection ve token şişmesine karşı temel önlem). */
function sanitizeForPrompt(s: string | null | undefined, max: number): string {
  return (s ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // kontrol karakterleri (\n korunur, \t boşluğa iner)
    .replace(/[^\S\n]+/g, ' ')   // satır içi tekrarlı boşluklar → tek boşluk
    .replace(/\n{3,}/g, '\n\n')  // 3+ boş satır → paragraf arası
    .trim()
    .slice(0, max);
}

/** Metni kelime sınırında keser (limitin içindeyse dokunmaz, üç nokta EKLEMEZ). */
function truncateAtWord(s: string, max: number): string {
  const t = (s || '').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

/** Etiket dizisini temizler: yalnızca boş olmayan stringler, en fazla 8 adet. */
function clampTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    .map((t) => t.trim())
    .slice(0, 8);
}

/* ── İhbar analizi: özet + öncelik + kategori + haber değeri ── */
export type TipAnalysis = {
  summary: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: string;
  newsworthy: boolean;
  reasoning: string;
};

export async function analyzeTip(subject: string, content: string): Promise<TipAnalysis> {
  const ai = await getClient();
  // Kullanıcı girdisi (e-posta ihbarı) → prompt'a gömmeden önce temizle
  const safeSubject = sanitizeForPrompt(subject, 300);
  const safeContent = sanitizeForPrompt(content, 8000);
  const res = await ai.models.generateContent({
    model: AI_MODEL,
    contents: `Aşağıdaki ihbarı gazetecilik açısından değerlendir.\n\nKonu: ${safeSubject}\n\nİçerik:\n${safeContent}`,
    config: {
      systemInstruction: 'Sen Çanakkale Network haber ajansının editör asistanısın. Gelen ihbarları gazetecilik açısından değerlendirip önceliklendirirsin. Çıktıların Türkçe olmalı.',
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING, description: 'İhbarın 1-2 cümlelik Türkçe özeti' },
          priority: { type: Type.STRING, enum: ['low', 'normal', 'high', 'urgent'] },
          category: { type: Type.STRING, description: 'Önerilen haber kategorisi (Gündem, Asayiş, Spor, Sağlık vb.)' },
          newsworthy: { type: Type.BOOLEAN },
          reasoning: { type: Type.STRING, description: 'Öncelik ve haber değeri için kısa gerekçe' },
        },
        required: ['summary', 'priority', 'category', 'newsworthy', 'reasoning'],
      },
    },
  });
  return parseAiJson<TipAnalysis>(res);
}

/* ── İhbardan haber taslağı üret ── */
export type ArticleDraft = { title: string; body: string };

export async function draftArticleFromTip(subject: string, content: string, source: string): Promise<ArticleDraft> {
  const ai = await getClient();
  // Kullanıcı girdisi (e-posta ihbarı) → prompt'a gömmeden önce temizle
  const safeSubject = sanitizeForPrompt(subject, 300);
  const safeContent = sanitizeForPrompt(content, 8000);
  const safeSource = sanitizeForPrompt(source, 300);
  const res = await ai.models.generateContent({
    model: AI_MODEL,
    contents: `Aşağıdaki ihbardan yayına hazır bir haber taslağı yaz.\n\nKonu: ${safeSubject}\nKaynak: ${safeSource}\n\nİçerik:\n${safeContent}`,
    config: {
      systemInstruction: 'Sen Çanakkale Network haber sitesinin muhabirisin. İhbarlardan nesnel, doğrulanabilir dille haber taslağı yazarsın. Asılsız iddiaları kesin bilgi gibi sunmaz, "iddia edildi/öne sürüldü" gibi ifadeler kullanırsın. Çıktı Türkçe.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'Dikkat çekici, abartısız haber başlığı' },
          body: { type: Type.STRING, description: '2-4 paragraflık, nesnel, gazetecilik diliyle haber metni' },
        },
        required: ['title', 'body'],
      },
    },
  });
  return parseAiJson<ArticleDraft>(res);
}

/* ── Haber/makale analizi: SEO + özet + etiket + sosyal medya ── */
export type ArticleAnalysis = {
  summary: string;
  metaDescription: string;
  seoTitle: string;
  category: string;
  tags: string[];
  socialPost: string;
  /** Haberin geçtiği Çanakkale ilçesi (ad ya da boş) — taslağa taşınır */
  district?: string;
};

export async function analyzeArticle(title: string, content: string): Promise<ArticleAnalysis> {
  const ai = await getClient();
  // Başlık/içerik WP editöründen (kullanıcı) gelebilir → temizle + sınırla
  const safeTitle = sanitizeForPrompt(title, 300);
  const safeContent = sanitizeForPrompt(content, 8000);
  const res = await withRetry(() => ai.models.generateContent({
    model: AI_MODEL,
    contents: `Aşağıdaki haberi analiz et.\n\nBaşlık: ${safeTitle}\n\nİçerik:\n${safeContent}`,
    config: {
      systemInstruction: 'Sen Çanakkale Network haber sitesinin SEO ve içerik editörüsün. Haberleri analiz edip yayın ve arama motoru için meta verileri üretirsin. Tüm çıktılar Türkçe, nesnel ve abartısız olmalı.',
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING, description: '2-3 cümlelik haber özeti' },
          metaDescription: { type: Type.STRING, description: 'Arama motoru için ~155 karakter meta açıklama' },
          seoTitle: { type: Type.STRING, description: 'SEO uyumlu, ~60 karakter başlık' },
          category: { type: Type.STRING, description: 'Önerilen kategori (Gündem, Asayiş, Spor, Sağlık, Ekonomi, Eğitim, Kültür-Sanat vb.)' },
          tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: '5-8 anahtar etiket' },
          socialPost: { type: Type.STRING, description: 'Sosyal medya için kısa, dikkat çekici paylaşım metni (1-2 emoji ile)' },
          district: { type: Type.STRING, description: 'Haberin geçtiği Çanakkale ilçesi (Merkez, Ayvacık, Bayramiç, Biga, Çan, Eceabat, Ezine, Gelibolu, Gökçeada, Lapseki, Yenice) — belirsizse boş bırak' },
        },
        required: ['summary', 'metaDescription', 'seoTitle', 'category', 'tags', 'socialPost', 'district'],
      },
    },
  }));
  const parsed = parseAiJson<ArticleAnalysis>(res);
  // Çıktı doğrulama: SEO alanlarını karakter limitine, etiketleri 8 adede sabitle
  return {
    ...parsed,
    seoTitle: truncateAtWord(parsed.seoTitle || '', 70),
    metaDescription: truncateAtWord(parsed.metaDescription || '', 160),
    tags: clampTags(parsed.tags),
  };
}

/* ── Serbest metin özeti (bülten, rapor yorumu vb.) ── */
export async function summarizeText(prompt: string, system?: string): Promise<string> {
  const ai = await getClient();
  const res = await ai.models.generateContent({
    model: AI_MODEL,
    contents: prompt,
    config: {
      systemInstruction: system || 'Sen yardımcı bir Türkçe editör asistanısın.',
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  return (res.text ?? '').trim();
}

/* ══════════ WORDPRESS AI HABER MOTORU ══════════ */

export const IMAGE_MODEL = process.env.GOOGLE_IMAGE_MODEL || 'imagen-3.0-generate-002';

export type DiscoveredTopic = {
  topic: string;
  headline: string;
  newsworthiness: number;
  category: string;
  sourceLinks: string[];
  /** AI'ın çıkardığı Çanakkale ilçesi (ad ya da boş) — güven katmanı v1 */
  district?: string;
  /** Konu Çanakkale ile ilgili mi? false ise gürültü → fact-check'e girmeden atlanır */
  isLocal?: boolean;
};

/** Kaynak türünü prompt etiketine çevirir (güven bağlamı). */
function sourceTypeLabel(t?: string): string {
  switch (t) {
    case 'official': return 'resmi';
    case 'aggregator': return 'agregatör';
    case 'social': return 'sosyal';
    case 'local': return 'yerel';
    default: return '';
  }
}

/** Ham haber öğelerinden aday konular çıkar + haber değeri puanla (grounding gerekmez).
 *  Öğe başına opsiyonel güven bağlamı (kaynak güven skoru / türü / çoklu-kaynak teyidi)
 *  prompt'a `[güven:85, resmi, teyit:2]` etiketiyle geçer; AI düşük güvenli tek kaynağı
 *  yüksek puanlamaz, teyitli/resmi olayları öne çıkarır.
 *  `extraInstruction` ile çağıran, seçim kriterine mod-özel yönerge ekleyebilir
 *  (ör. son dakika radarında "yalnızca gerçekten acil olayları seç"). */
export async function discoverTopics(
  items: { title: string; link: string; trust?: number; sourceType?: string; confirmed?: number }[],
  maxTopics = 5,
  extraInstruction?: string,
): Promise<DiscoveredTopic[]> {
  const ai = await getClient();
  // Feed başlıkları dış kaynaklı (güvenilmez) metin → prompt'a gömmeden önce temizle.
  // Güven bağlamı varsa (kaynak güveni/türü/teyit) başlığa köşeli etiket ekle.
  const list = items.slice(0, 120)
    .map((i, n) => {
      const parts: string[] = [];
      if (typeof i.trust === 'number') parts.push(`güven:${Math.round(i.trust)}`);
      const label = sourceTypeLabel(i.sourceType);
      if (label) parts.push(label);
      if (typeof i.confirmed === 'number' && i.confirmed >= 2) parts.push(`teyit:${i.confirmed}`);
      const tag = parts.length ? ` [${parts.join(', ')}]` : '';
      return `${n + 1}. ${sanitizeForPrompt(i.title, 300)}${tag} — ${sanitizeForPrompt(i.link, 500)}`;
    })
    .join('\n');
  const extra = extraInstruction ? `\n\nEK YÖNERGE: ${extraInstruction}` : '';
  const res = await withRetry(() => ai.models.generateContent({
    model: AI_MODEL,
    contents: `Aşağıda Çanakkale yerel haber başlıkları var; bazılarında köşeli parantezde kaynak güven bağlamı (güven puanı 0-100, kaynak türü, "teyit:N" = N ayrı kaynakça doğrulanmış) yer alır. Benzer olanları kümeleyip en fazla ${maxTopics} AYRI, güncel ve haber değeri yüksek KONU çıkar. Aynı olayın farklı kaynaklardaki tekrarlarını TEK konuda birleştir. Reklam/ilan/spam olanları ele. Her konu için hangi Çanakkale ilçesiyle ilgili olduğunu (district) ve konunun Çanakkale ile ilgili olup olmadığını (isLocal) belirt.${extra}\n\n${list}`,
    config: {
      systemInstruction: 'Sen Çanakkale Network haber ajansının editörüsün. Haber akışından günün en önemli, özgün konularını seçersin. Kaynak güvenini dikkate al: DÜŞÜK güvenli TEK kaynaktan gelen doğrulanmamış iddiaları yüksek puanlama; birden çok kaynakça teyit edilen (teyit:2+) ya da resmi kaynaklı olayları öne çıkar. Çanakkale ile ilgisi olmayan (ulusal/alakasız) konuları isLocal=false işaretle. Türkçe.',
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING, description: 'konu kısa etiketi' },
            headline: { type: Type.STRING, description: 'önerilen haber başlığı' },
            newsworthiness: { type: Type.NUMBER, description: '0-100 haber değeri' },
            category: { type: Type.STRING, description: 'Gündem, Asayiş, Spor, Eğitim, Ekonomi, Kültür-Sanat vb.' },
            district: { type: Type.STRING, description: 'İlgili Çanakkale ilçesi (Merkez, Ayvacık, Bayramiç, Biga, Çan, Eceabat, Ezine, Gelibolu, Gökçeada, Lapseki, Yenice) — belirsizse boş' },
            isLocal: { type: Type.BOOLEAN, description: 'Konu Çanakkale ili ile ilgili mi? Ulusal/alakasızsa false' },
            sourceLinks: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'konuyu destekleyen kaynak linkleri' },
          },
          required: ['topic', 'headline', 'newsworthiness', 'category', 'district', 'isLocal', 'sourceLinks'],
        },
      },
    },
  }));
  const arr = parseAiJson<DiscoveredTopic[]>(res, 'array');
  return arr.sort((a, b) => b.newsworthiness - a.newsworthiness).slice(0, maxTopics);
}

/** Metinleri Vertex/AI Studio embedding modeliyle vektöre çevirir (çoklu-kaynak kümeleme için).
 *  Batch destekli; hata TOLERANSLI değildir (çağıran try/catch ile sarıp kümelemeyi atlar).
 *  Dönüş: her metin için number[] (başarısız/boş öğe için []). */
export async function embedText(texts: string[], taskType = 'SEMANTIC_SIMILARITY'): Promise<number[][]> {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  const ai = await getClient();
  const out: number[][] = [];
  const CHUNK = 100; // model başına instance sınırına karşı güvenli parça boyutu
  for (let i = 0; i < texts.length; i += CHUNK) {
    const batch = texts.slice(i, i + CHUNK).map((t) => sanitizeForPrompt(t, 2000) || ' ');
    const res = await withRetry(() => ai.models.embedContent({
      model: EMBED_MODEL,
      contents: batch,
      config: { taskType },
    }));
    const embs = res.embeddings ?? [];
    for (let j = 0; j < batch.length; j++) {
      const v = embs[j]?.values;
      out.push(Array.isArray(v) ? v : []);
    }
  }
  return out;
}

export type FactCheck = {
  confidence: number;
  verifiedSummary: string;
  caveats: string;
  groundingLinks: string[];
  /** Bağımsız (farklı domain) kaynak sayısı — çoklu-kaynak teyidi göstergesi */
  sourceCount: number;
  /** Kaynaklar arası çelişkiler (varsa) */
  contradictions: string[];
};

/** Grounding uri/domain'inden gerçek bağımsız domain'i çıkarır; yönlendirme (redirect)
 *  ve genel Google barındırma domain'lerini eler (hepsi tek "kaynak" gibi sayılmasın). */
function independentDomain(uri: string | undefined): string | null {
  if (!uri) return null;
  try {
    const h = new URL(uri).hostname.replace(/^www\./, '').toLowerCase();
    // Vertex grounding redirect'i + Google genel barındırma → gerçek kaynak değil
    if (/(^|\.)vertexaisearch\.cloud\.google\.com$/.test(h)) return null;
    if (/(^|\.)googleusercontent\.com$/.test(h)) return null;
    if (/(^|\.)google\.com$/.test(h) && /grounding|redirect/.test(uri)) return null;
    return h;
  } catch {
    return null;
  }
}

/** Konuyu Google Search grounding ile doğrula → güven skoru + doğrulanmış özet + bağımsız
 *  kaynak sayısı + çelişkiler. <2 bağımsız domain teyit edebiliyorsa güven tavanı 0.5'e
 *  çekilir (tek kaynaklı iddia yüksek güven alamaz). */
export async function factCheckTopic(topic: string, headline: string): Promise<FactCheck> {
  const ai = await getClient();
  const res = await withRetry(() => ai.models.generateContent({
    model: AI_MODEL,
    contents: `Şu Çanakkale haber konusunu güncel web kaynaklarıyla DOĞRULA:\nKonu: ${topic}\nBaşlık: ${headline}\n\nBirden çok BAĞIMSIZ kaynağı karşılaştır. Kaynaklar arasında çelişki varsa açıkça yaz ve güveni düşür. SADECE şu JSON'u döndür (başka metin yok):\n{"confidence": 0 ile 1 arası sayı, "verifiedSummary": "doğrulanmış kısa özet", "caveats": "şüphe/uyarı ya da boş", "sourceCount": doğrulayan bağımsız kaynak sayısı (tam sayı), "contradictions": ["kaynaklar arası çelişki maddeleri; yoksa boş dizi"]}`,
    config: {
      systemInstruction: 'Sen titiz bir haber doğrulama editörüsün. Yalnızca kaynaklarca desteklenen bilgiyi doğrularsın; farklı bağımsız kaynakları karşılaştırır, çeliştiklerinde contradictions listesine yazar ve güveni düşürürsün. Türkçe.',
      tools: [{ googleSearch: {} }],
    },
  }));
  const text = res.text ?? '';
  const links: string[] = [];
  const domains = new Set<string>();
  const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (Array.isArray(chunks)) {
    for (const c of chunks) {
      const uri = c?.web?.uri;
      if (typeof uri === 'string') links.push(uri);
      // Vertex domain alanı (varsa) en güvenilir; yoksa uri host'undan çıkar
      const dom = (typeof c?.web?.domain === 'string' && c.web.domain) ? c.web.domain.replace(/^www\./, '').toLowerCase() : independentDomain(uri);
      if (dom) domains.add(dom);
    }
  }
  let parsed: { confidence?: number; verifiedSummary?: string; caveats?: string; sourceCount?: number; contradictions?: unknown } = {};
  const jm = text.match(/\{[\s\S]*\}/);
  if (jm) { try { parsed = JSON.parse(jm[0]); } catch { /* metin JSON değil */ } }
  // Ayrıştırma başarısız/eksikse güven=0 (0.5 DEĞİL) → doğrulanmamış konu yazıma geçmesin; 0-1'e clamp
  const rawConf = typeof parsed.confidence === 'number' && !Number.isNaN(parsed.confidence) ? parsed.confidence : 0;
  let confidence = Math.min(1, Math.max(0, rawConf));
  // Bağımsız domain sayısı: gerçek domain sinyali VARSA ve <2 ise güven tavanı 0.5
  // (domain sinyali hiç yoksa — ör. redirect-only — mevcut davranışı bozmadan geç).
  const domainCount = domains.size;
  if (domainCount >= 1 && domainCount < 2) confidence = Math.min(confidence, 0.5);
  const modelCount = typeof parsed.sourceCount === 'number' && parsed.sourceCount >= 0 ? Math.floor(parsed.sourceCount) : undefined;
  const sourceCount = domainCount > 0 ? domainCount : (modelCount ?? (links.length > 0 ? 1 : 0));
  const contradictions = Array.isArray(parsed.contradictions)
    ? parsed.contradictions.filter((c): c is string => typeof c === 'string' && c.trim().length > 0).map((c) => c.trim()).slice(0, 5)
    : [];
  return {
    confidence,
    verifiedSummary: parsed.verifiedSummary || text.slice(0, 500),
    caveats: parsed.caveats || '',
    groundingLinks: links,
    sourceCount,
    contradictions,
  };
}

/** Doğrulanmış konudan özgün, nesnel haber metni yaz. */
export async function writeArticleFromTopic(headline: string, verifiedSummary: string, category: string): Promise<ArticleDraft> {
  const ai = await getClient();
  const res = await withRetry(() => ai.models.generateContent({
    model: AI_MODEL,
    contents: `Aşağıdaki doğrulanmış bilgiden yayına hazır, ÖZGÜN (kopya değil) bir haber metni yaz.\nBaşlık fikri: ${headline}\nKategori: ${category}\nDoğrulanmış bilgi:\n${verifiedSummary}`,
    config: {
      systemInstruction: 'Sen Çanakkale Network muhabirisin. Nesnel, doğrulanabilir, abartısız gazetecilik diliyle 3-5 paragraf haber yazarsın. Asılsız iddiaları kesin sunmaz, "iddia edildi/bildirildi" gibi ifadeler kullanırsın. Gövde metninde EN AZ BİR kaynağa açık atıf yap (ör. "yetkililerin açıklamasına göre", "... kaynaklara göre"). Türkçe.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'net, abartısız başlık' },
          body: { type: Type.STRING, description: '3-5 paragraf, <p> etiketli HTML gövde' },
        },
        required: ['title', 'body'],
      },
    },
  }));
  const draft = parseAiJson<ArticleDraft>(res);
  if (!draft.body || !draft.body.trim() || !draft.title || !draft.title.trim()) {
    throw new Error('AI boş başlık/gövde üretti (yayına uygun değil)');
  }
  return draft;
}

/* ── Haftalık panorama: sitede yayınlanmış haberlerden kuşbakışı değerlendirme yazısı ── */
export type WeeklyRoundupInput = {
  title: string;
  summary: string | null;
  category: string | null;
  views: number;
};

export type WeeklyRoundup = {
  title: string;
  body: string; // HTML gövde
  summary: string;
  tags: string[];
  seoTitle: string;
  metaDescription: string;
};

/** Son 7 günün yayınlanmış haberlerinden "Çanakkale'de Bu Hafta" tarzı, tema tema ilerleyen
 *  akıcı bir haftalık değerlendirme yazısı üretir (tek AI çağrısı). */
export async function writeWeeklyRoundup(articles: WeeklyRoundupInput[]): Promise<WeeklyRoundup> {
  const ai = await getClient();
  // Haber başlık/özetleri site içeriği olsa da tek tip hijyen uygula (token şişmesine karşı sınırla)
  const list = articles.slice(0, 60)
    .map((a, n) => {
      const cat = a.category ? `[${sanitizeForPrompt(a.category, 60)}] ` : '';
      const sum = a.summary ? ` — ${sanitizeForPrompt(a.summary, 300)}` : '';
      return `${n + 1}. ${cat}${sanitizeForPrompt(a.title, 300)}${sum} (${a.views} görüntülenme)`;
    })
    .join('\n');
  const res = await withRetry(() => ai.models.generateContent({
    model: AI_MODEL,
    contents: `Aşağıda Çanakkale Network haber sitesinde SON 7 GÜNDE yayınlanan haberler var. Bunlardan "Çanakkale'de Bu Hafta" tarzı, haftaya kuşbakışı bakan bir değerlendirme yazısı yaz.\n\nKurallar:\n- Öne çıkan olayları TEMA TEMA grupla (ör. asayiş, üniversite, spor, etkinlikler) ve akıcı bir köşe yazısı üslubuyla anlat.\n- Kaynak haberlere BAŞLIKLARIYLA atıf yap (ör. "Haftanın en çok konuşulan gelişmesi '...' başlıklı haberimizdi").\n- Yeni bilgi UYDURMA; yalnızca verilen başlık/özetlerdeki bilgiyi kullan.\n- Gövde <p> (gerekirse tema başlıkları için <h3>) etiketli HTML olsun.\n\nHaberler:\n${list}`,
    config: {
      systemInstruction: 'Sen Çanakkale Network haber sitesinin deneyimli köşe yazarı/editörüsün. Haftalık panorama yazıları sıcak, akıcı ama abartısız ve nesneldir. Tüm çıktılar Türkçe.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'Yazının başlığı (ör. "Çanakkale\'de Bu Hafta: ...")' },
          body: { type: Type.STRING, description: 'Tema tema ilerleyen, <p>/<h3> etiketli HTML gövde' },
          summary: { type: Type.STRING, description: '2-3 cümlelik spot/özet' },
          tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: '5-8 anahtar etiket' },
          seoTitle: { type: Type.STRING, description: 'SEO uyumlu, ~60 karakter başlık' },
          metaDescription: { type: Type.STRING, description: 'Arama motoru için ~155 karakter meta açıklama' },
        },
        required: ['title', 'body', 'summary', 'tags', 'seoTitle', 'metaDescription'],
      },
    },
  }));
  const parsed = parseAiJson<WeeklyRoundup>(res);
  if (!parsed.title?.trim() || !parsed.body?.trim()) {
    throw new Error('AI boş başlık/gövde üretti (haftalık panorama yayına uygun değil)');
  }
  return {
    ...parsed,
    seoTitle: truncateAtWord(parsed.seoTitle || '', 70),
    metaDescription: truncateAtWord(parsed.metaDescription || '', 160),
    tags: clampTags(parsed.tags),
  };
}

/** Habere uygun "temsili" başlık görseli üret (Imagen) → base64 data URI. */
export async function generateArticleImage(prompt: string): Promise<string | null> {
  const ai = await getClient();
  try {
    const res = await ai.models.generateImages({
      model: IMAGE_MODEL,
      prompt: `Haber başlık görseli, temsili, fotogerçekçi, Çanakkale/Türkiye bağlamı: ${prompt}. Görselde metin ve logo olmasın.`,
      config: { numberOfImages: 1, aspectRatio: '16:9' },
    });
    const bytes = res.generatedImages?.[0]?.image?.imageBytes;
    return bytes ? `data:image/png;base64,${bytes}` : null;
  } catch (e) {
    console.error('[ai] generateArticleImage', e);
    return null;
  }
}
