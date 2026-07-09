import { describe, it, expect } from 'vitest';
import { honeypotTriggered, submittedTooFast } from '@/lib/bot';

describe('honeypotTriggered', () => {
  it('dolu string → true (bot)', () => {
    expect(honeypotTriggered('http://spam.example')).toBe(true);
    expect(honeypotTriggered('x')).toBe(true);
  });

  it('boş/whitespace/eksik → false (insan)', () => {
    expect(honeypotTriggered('')).toBe(false);
    expect(honeypotTriggered('   ')).toBe(false);
    expect(honeypotTriggered(undefined)).toBe(false);
    expect(honeypotTriggered(null)).toBe(false);
    expect(honeypotTriggered(123)).toBe(false);
  });
});

describe('submittedTooFast', () => {
  it('çok hızlı gönderim → true', () => {
    const now = Date.now();
    expect(submittedTooFast(now - 500, 2000)).toBe(true); // 0.5sn < 2sn
  });

  it('yeterli süre geçmiş → false', () => {
    const now = Date.now();
    expect(submittedTooFast(now - 5000, 2000)).toBe(false); // 5sn > 2sn
  });

  it('eksik/geçersiz zaman damgası → false (sinyal yok, geçir)', () => {
    expect(submittedTooFast(undefined)).toBe(false);
    expect(submittedTooFast(null)).toBe(false);
    expect(submittedTooFast(0)).toBe(false);
    expect(submittedTooFast(-100)).toBe(false);
    expect(submittedTooFast('abc')).toBe(false);
  });

  it('gelecekteki zaman damgası (elapsed<0) → true (şüpheli)', () => {
    const future = Date.now() + 10000;
    expect(submittedTooFast(future, 2000)).toBe(true);
  });
});
