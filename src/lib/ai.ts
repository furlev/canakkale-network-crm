import { GoogleGenAI, Type } from '@google/genai';
import prisma from '@/lib/prisma';

/**
 * Google Gemini (2.5 Flash) entegrasyonu. Anahtar önce GEMINI_API_KEY ortam
 * değişkeninden, yoksa Ayarlar'daki 'ai' bölümünden okunur. Anahtar yoksa
 * yardımcılar AiNotConfiguredError fırlatır — çağıran kibarca 400 döndürür.
 */

export const AI_MODEL = 'gemini-3.5-flash';

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
    cachedKey = (parsed && typeof parsed.apiKey === 'string' && parsed.apiKey) ? parsed.apiKey : null;
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
        console.error('[ai] GOOGLE_VERTEX_CREDENTIALS_JSON çözümlenemedi');
      }
    }
    return new GoogleGenAI(opts);
  }
  const key = await resolveKey();
  if (!key) throw new AiNotConfiguredError();
  return new GoogleGenAI({ apiKey: key });
}

export async function aiEnabled(): Promise<boolean> {
  if (VERTEX_PROJECT) return true;
  return (await resolveKey()) !== null;
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
  const res = await ai.models.generateContent({
    model: AI_MODEL,
    contents: `Aşağıdaki ihbarı gazetecilik açısından değerlendir.\n\nKonu: ${subject}\n\nİçerik:\n${content}`,
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
  return JSON.parse(res.text ?? '{}') as TipAnalysis;
}

/* ── İhbardan haber taslağı üret ── */
export type ArticleDraft = { title: string; body: string };

export async function draftArticleFromTip(subject: string, content: string, source: string): Promise<ArticleDraft> {
  const ai = await getClient();
  const res = await ai.models.generateContent({
    model: AI_MODEL,
    contents: `Aşağıdaki ihbardan yayına hazır bir haber taslağı yaz.\n\nKonu: ${subject}\nKaynak: ${source}\n\nİçerik:\n${content}`,
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
  return JSON.parse(res.text ?? '{}') as ArticleDraft;
}

/* ── Haber/makale analizi: SEO + özet + etiket + sosyal medya ── */
export type ArticleAnalysis = {
  summary: string;
  metaDescription: string;
  seoTitle: string;
  category: string;
  tags: string[];
  socialPost: string;
};

export async function analyzeArticle(title: string, content: string): Promise<ArticleAnalysis> {
  const ai = await getClient();
  const res = await ai.models.generateContent({
    model: AI_MODEL,
    contents: `Aşağıdaki haberi analiz et.\n\nBaşlık: ${title}\n\nİçerik:\n${content}`,
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
        },
        required: ['summary', 'metaDescription', 'seoTitle', 'category', 'tags', 'socialPost'],
      },
    },
  });
  return JSON.parse(res.text ?? '{}') as ArticleAnalysis;
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
