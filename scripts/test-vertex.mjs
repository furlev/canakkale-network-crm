/** Yeni proje Vertex + ADC canlı testi: metin + grounding + Imagen. */
import { GoogleGenAI } from '@google/genai';
const project = process.env.GOOGLE_VERTEX_PROJECT || 'project-089008bc-3f59-4485-a22';
const location = process.env.GOOGLE_CLOUD_LOCATION || 'global';
const ai = new GoogleGenAI({ vertexai: true, project, location });
console.log(`Vertex: project=${project} location=${location}\n`);

let ok = 0, fail = 0;

// 1) Düz metin
try {
  const r = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: 'Tek kısa cümleyle Çanakkale Boğazı nedir?',
    config: { thinkingConfig: { thinkingBudget: 0 } },
  });
  console.log('[1] metin ✓', (r.text || '').trim().slice(0, 90)); ok++;
} catch (e) { console.error('[1] metin ✗', e?.message || e); fail++; }

// 2) Google Search grounding
try {
  const r = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: 'Çanakkale bugün hava durumu nasıl? Kısa yanıt.',
    config: { tools: [{ googleSearch: {} }] },
  });
  const chunks = r.candidates?.[0]?.groundingMetadata?.groundingChunks?.length || 0;
  console.log(`[2] grounding ✓ (kaynak parça: ${chunks})`, (r.text || '').trim().slice(0, 70)); ok++;
} catch (e) { console.error('[2] grounding ✗', e?.message || e); fail++; }

// 3) Imagen görsel
try {
  const r = await ai.models.generateImages({
    model: process.env.GOOGLE_IMAGE_MODEL || 'imagen-3.0-generate-002',
    prompt: 'Çanakkale Boğazı manzarası, temsili, fotogerçekçi. Metin ve logo olmasın.',
    config: { numberOfImages: 1, aspectRatio: '16:9' },
  });
  const bytes = r.generatedImages?.[0]?.image?.imageBytes;
  console.log(`[3] Imagen ✓ (${bytes ? Math.round(bytes.length / 1024) + ' KB base64' : 'boş'})`); ok++;
} catch (e) { console.error('[3] Imagen ✗', e?.message || e); fail++; }

console.log(`\nSonuç: ${ok} başarılı, ${fail} hata`);
process.exit(fail > 0 ? 1 : 0);
