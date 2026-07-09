import { describe, it, expect } from 'vitest';
import { textOriginalityScore } from '@/lib/ai';

const long = 'Çanakkale Boğazı feribot seferleri sabah erken saatlerde yoğun talep gördü bugün';
const other = 'Bayramiç yaylalarında kar kalınlığı arttı köy yolları ekiplerce açıldı akşam saatlerinde';

describe('textOriginalityScore', () => {
  it('kısa metin → null (sinyal yetersiz)', () => {
    expect(textOriginalityScore('kısa', 'metin')).toBeNull();
    expect(textOriginalityScore('bir iki üç', 'dört beş altı')).toBeNull();
  });

  it('birebir aynı metin → 0 (tamamen kopya)', () => {
    expect(textOriginalityScore(long, long)).toBe(0);
  });

  it('tamamen farklı metin → 100 (özgün)', () => {
    expect(textOriginalityScore(long, other)).toBe(100);
  });

  it('0-100 aralığında sayı döndürür', () => {
    const score = textOriginalityScore(long + ' ' + other, long);
    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThanOrEqual(0);
    expect(score!).toBeLessThanOrEqual(100);
  });

  it('HTML etiketleri sonucu etkilemez (temizlenir)', () => {
    const withTags = `<p>${long}</p>`;
    expect(textOriginalityScore(withTags, long)).toBe(0);
  });
});
