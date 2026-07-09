import { describe, it, expect } from 'vitest';
import { computeQualityScore } from '@/lib/draft-quality';

describe('computeQualityScore', () => {
  it('boş girdi → düşük ama tanımlı skor (originality nötr 0.6 → 9 puan)', () => {
    const s = computeQualityScore({});
    expect(s).toBe(9); // 0.6 * 15 = 9
  });

  it('tam güvenli taslak → yüksek skor', () => {
    const s = computeQualityScore({
      confidence: 1,
      sourceCount: 3,
      fieldFullness: 1,
      originalityScore: 100,
      hasContradiction: false,
    });
    // 40 + 25 + 20 + 15 = 100
    expect(s).toBe(100);
  });

  it('çelişki bayrağı -20 ceza uygular', () => {
    const base = computeQualityScore({ confidence: 1, sourceCount: 3, fieldFullness: 1, originalityScore: 100 });
    const withContradiction = computeQualityScore({
      confidence: 1, sourceCount: 3, fieldFullness: 1, originalityScore: 100, hasContradiction: true,
    });
    expect(base - withContradiction).toBe(20);
  });

  it('kaynak sayısı 3\'te doyar (4+ ek puan getirmez)', () => {
    const three = computeQualityScore({ sourceCount: 3 });
    const ten = computeQualityScore({ sourceCount: 10 });
    expect(three).toBe(ten);
  });

  it('0-100 aralığında sınırlanır ve tam sayıdır', () => {
    const s = computeQualityScore({ confidence: 5 as number, sourceCount: 99, fieldFullness: 3 as number, originalityScore: 200 });
    expect(s).toBeLessThanOrEqual(100);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(s)).toBe(true);
  });

  it('düşük güven + çelişki 0\'ın altına inmez', () => {
    const s = computeQualityScore({ confidence: 0, sourceCount: 0, fieldFullness: 0, originalityScore: 0, hasContradiction: true });
    expect(s).toBe(0);
  });
});
