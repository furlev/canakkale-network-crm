import { describe, it, expect } from 'vitest';
import { normalizeDistrict, getDistrict, districtName } from '@/lib/districts';

describe('normalizeDistrict', () => {
  it('slug birebir', () => {
    expect(normalizeDistrict('merkez')).toBe('merkez');
    expect(normalizeDistrict('biga')).toBe('biga');
  });

  it('Türkçe adı ASCII-fold ile eşler', () => {
    expect(normalizeDistrict('Çan')).toBe('can');
    expect(normalizeDistrict('Gökçeada')).toBe('gokceada');
    expect(normalizeDistrict('Bayramiç')).toBe('bayramic');
  });

  it('çekimli/gömülü metinden ilçe kökü çıkarır', () => {
    expect(normalizeDistrict("Biga'da")).toBe('biga');
    expect(normalizeDistrict('çanakkale merkez')).toBe('merkez');
  });

  it('büyük/küçük harf duyarsız (tr-TR)', () => {
    expect(normalizeDistrict('EZINE')).toBe('ezine');
    expect(normalizeDistrict('gelibolu')).toBe('gelibolu');
  });

  it('bilinmeyen/boş → null', () => {
    expect(normalizeDistrict('İstanbul')).toBeNull();
    expect(normalizeDistrict('')).toBeNull();
    expect(normalizeDistrict(null)).toBeNull();
    expect(normalizeDistrict(undefined)).toBeNull();
  });
});

describe('getDistrict / districtName', () => {
  it('geçerli slug → district objesi + ad', () => {
    const d = getDistrict('merkez');
    expect(d?.name).toBe('Merkez');
    expect(typeof d?.lat).toBe('number');
    expect(districtName('can')).toBe('Çan');
  });

  it('geçersiz → null', () => {
    expect(getDistrict('yok')).toBeNull();
    expect(districtName(null)).toBeNull();
  });
});
