import { describe, it, expect } from 'vitest';
import { computeInvoiceTotals, type InvoiceItemLike } from '@/lib/invoice-pdf';

const item = (quantity: number, unitPrice: number, vatRate: number): InvoiceItemLike => ({
  description: 'x',
  quantity,
  unitPrice,
  vatRate,
});

describe('computeInvoiceTotals', () => {
  it('boş kalem listesi → sıfır', () => {
    expect(computeInvoiceTotals([])).toEqual({ subtotal: 0, vatTotal: 0, discount: 0, amount: 0 });
  });

  it('tek kalem %20 KDV', () => {
    const r = computeInvoiceTotals([item(2, 100, 20)]);
    expect(r.subtotal).toBe(200);
    expect(r.vatTotal).toBe(40);
    expect(r.amount).toBe(240);
    expect(r.discount).toBe(0);
  });

  it('çoklu kalem farklı KDV oranları', () => {
    const r = computeInvoiceTotals([item(1, 100, 20), item(3, 50, 10)]);
    // subtotal = 100 + 150 = 250 ; vat = 20 + 15 = 35
    expect(r.subtotal).toBe(250);
    expect(r.vatTotal).toBe(35);
    expect(r.amount).toBe(285);
  });

  it('indirim KDV dahil genel toplamdan düşülür', () => {
    const r = computeInvoiceTotals([item(1, 100, 20)], 30);
    // 100 + 20 - 30 = 90
    expect(r.discount).toBe(30);
    expect(r.amount).toBe(90);
  });

  it('indirim toplamı aşarsa amount negatif olmaz (0 tabanı)', () => {
    const r = computeInvoiceTotals([item(1, 100, 0)], 500);
    expect(r.amount).toBe(0);
  });

  it('negatif indirim yok sayılır', () => {
    const r = computeInvoiceTotals([item(1, 100, 0)], -50);
    expect(r.discount).toBe(0);
    expect(r.amount).toBe(100);
  });

  it('2 ondalık yuvarlama', () => {
    const r = computeInvoiceTotals([item(3, 33.33, 18)]);
    // subtotal = 99.99 ; vat = 99.99 * 0.18 = 17.9982 → 18.00
    expect(r.subtotal).toBe(99.99);
    expect(r.vatTotal).toBe(18);
  });

  it('geçersiz/NaN girdiler 0 sayılır (çökmez)', () => {
    const r = computeInvoiceTotals([
      { description: 'x', quantity: NaN as unknown as number, unitPrice: 10, vatRate: 20 },
    ]);
    expect(r.subtotal).toBe(0);
    expect(r.amount).toBe(0);
  });
});
