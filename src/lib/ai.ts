import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import prisma from '@/lib/prisma';

/**
 * Claude (Sonnet 4.6) entegrasyonu. Anahtar önce ANTHROPIC_API_KEY ortam
 * değişkeninden, yoksa Ayarlar'daki 'ai' bölümünden okunur. Anahtar yoksa
 * yardımcılar AiNotConfiguredError fırlatır — çağıran kibarca 400 döndürür.
 */

export const AI_MODEL = 'claude-sonnet-4-6';

export class AiNotConfiguredError extends Error {
  constructor() {
    super('AI yapılandırılmamış. Ayarlar → API bölümünden Claude API anahtarınızı girin (ya da ANTHROPIC_API_KEY ortam değişkenini ayarlayın).');
    this.name = 'AiNotConfiguredError';
  }
}

let cachedKey: string | null | undefined;

async function resolveKey(): Promise<string | null> {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
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

async function getClient(): Promise<Anthropic> {
  const key = await resolveKey();
  if (!key) throw new AiNotConfiguredError();
  return new Anthropic({ apiKey: key });
}

export async function aiEnabled(): Promise<boolean> {
  return (await resolveKey()) !== null;
}

/* ── İhbar analizi: özet + öncelik + kategori + haber değeri ── */
const tipAnalysisSchema = z.object({
  summary: z.string().describe('İhbarın 1-2 cümlelik Türkçe özeti'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).describe('Önerilen öncelik'),
  category: z.string().describe('Önerilen haber kategorisi, ör. Gündem, Asayiş, Spor, Sağlık'),
  newsworthy: z.boolean().describe('Haber değeri taşıyor mu'),
  reasoning: z.string().describe('Öncelik ve haber değeri için kısa gerekçe'),
});
export type TipAnalysis = z.infer<typeof tipAnalysisSchema>;

export async function analyzeTip(subject: string, content: string): Promise<TipAnalysis> {
  const client = await getClient();
  const res = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    output_config: { format: zodOutputFormat(tipAnalysisSchema), effort: 'low' },
    system: 'Sen Çanakkale Network haber ajansının editör asistanısın. Gelen ihbarları gazetecilik açısından değerlendirip önceliklendirirsin. Çıktıların Türkçe olmalı.',
    messages: [{
      role: 'user',
      content: `Aşağıdaki ihbarı değerlendir.\n\nKonu: ${subject}\n\nİçerik:\n${content}`,
    }],
  });
  if (!res.parsed_output) throw new Error('AI yanıtı çözümlenemedi');
  return res.parsed_output;
}

/* ── İhbardan haber taslağı üret ── */
const draftSchema = z.object({
  title: z.string().describe('Dikkat çekici, abartısız haber başlığı'),
  body: z.string().describe('2-4 paragraflık, nesnel, gazetecilik diliyle yazılmış haber metni'),
});
export type ArticleDraft = z.infer<typeof draftSchema>;

export async function draftArticleFromTip(subject: string, content: string, source: string): Promise<ArticleDraft> {
  const client = await getClient();
  const res = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    output_config: { format: zodOutputFormat(draftSchema), effort: 'medium' },
    system: 'Sen Çanakkale Network haber sitesinin muhabirisin. İhbarlardan nesnel, doğrulanabilir dille haber taslağı yazarsın. Asılsız iddiaları kesin bilgi gibi sunmaz, "iddia edildi/öne sürüldü" gibi ifadeler kullanırsın. Çıktı Türkçe.',
    messages: [{
      role: 'user',
      content: `Aşağıdaki ihbardan yayına hazır bir haber taslağı yaz.\n\nKonu: ${subject}\nKaynak: ${source}\n\nİçerik:\n${content}`,
    }],
  });
  if (!res.parsed_output) throw new Error('AI yanıtı çözümlenemedi');
  return res.parsed_output;
}

/* ── Serbest metin özeti (bülten, rapor yorumu vb.) ── */
export async function summarizeText(prompt: string, system?: string): Promise<string> {
  const client = await getClient();
  const stream = client.messages.stream({
    model: AI_MODEL,
    max_tokens: 2048,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low' },
    system: system || 'Sen yardımcı bir Türkçe editör asistanısın.',
    messages: [{ role: 'user', content: prompt }],
  });
  const msg = await stream.finalMessage();
  return msg.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('\n').trim();
}
