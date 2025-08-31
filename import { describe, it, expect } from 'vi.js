import { describe, it, expect } from 'vitest';
import { computeItemTotal, computeOfferTotals } from './price';

describe('computeItemTotal', () => {
  it('returns 0 if qty is 0', () => {
    expect(computeItemTotal({ qty: 0, unitPrice: 100 })).toBe(0);
  });
  it('returns 0 if unitPrice is 0', () => {
    expect(computeItemTotal({ qty: 2, unitPrice: 0 })).toBe(0);
  });
  it('calculates total correctly', () => {
    expect(computeItemTotal({ qty: 3, unitPrice: 50 })).toBe(150);
  });
  it('handles negative qty', () => {
    expect(computeItemTotal({ qty: -2, unitPrice: 10 })).toBe(-20);
  });
  it('handles decimal unitPrice', () => {
    expect(computeItemTotal({ qty: 2, unitPrice: 12.5 })).toBe(25);
  });
});

describe('computeOfferTotals', () => {
  it('calculates subtotal, tax, discount, total', () => {
    const items = [
      { qty: 2, unitPrice: 100 },
      { qty: 1, unitPrice: 50 }
    ];
    const result = computeOfferTotals({ items, taxPercent: 10, discount: 5 });
    expect(result.subtotal).toBe(250);
    expect(result.discount).toBe(12.5);
    expect(result.tax).toBeCloseTo(23.75, 2);
    expect(result.total).toBeCloseTo(261.25, 2);
  });
  it('handles zero discount', () => {
    const items = [{ qty: 1, unitPrice: 100 }];
    const result = computeOfferTotals({ items, taxPercent: 8, discount: 0 });
    expect(result.subtotal).toBe(100);
    expect(result.discount).toBe(0);
    expect(result.tax).toBe(8);
    expect(result.total).toBe(108);
  });
  it('handles zero tax', () => {
    const items = [{ qty: 2, unitPrice: 50 }];
    const result = computeOfferTotals({ items, taxPercent: 0, discount: 10 });
    expect(result.subtotal).toBe(100);
    expect(result.discount).toBe(10);
    expect(result.tax).toBe(0);
    expect(result.total).toBe(90);
  });
  it('handles empty items', () => {
    const result = computeOfferTotals({ items: [], taxPercent: 5, discount: 5 });
    expect(result.subtotal).toBe(0);
    expect(result.discount).toBe(0);
    expect(result.tax).toBe(0);
    expect(result.total).toBe(0);
  });
  it('rounds correctly', () => {
    const items = [{ qty: 1, unitPrice: 99.99 }];
    const result = computeOfferTotals({ items, taxPercent: 7.7, discount: 2.5 });
    expect(result.subtotal).toBeCloseTo(99.99, 2);
    expect(result.discount).toBeCloseTo(2.49975, 2);
    expect(result.tax).toBeCloseTo(7.522, 2);
    expect(result.total).toBeCloseTo(105.013, 2);
  });
});
