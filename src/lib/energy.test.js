import { describe, it, expect } from 'vitest';
import { calcSelfConsumptionPct } from './energy';

describe('calcSelfConsumptionPct', () => {
  it('usa il consumo come denominatore', () => {
    // consumo 4000, produzione 5000 => autoconsumo stimato 4000 => 100%
    expect(calcSelfConsumptionPct(4000, 5000)).toBe(100);
  });
  it('clampa e non supera il 100%', () => {
    // consumo 3000, produzione 5000, autoconsumata 5000 => clamp a 3000 => 100%
    expect(calcSelfConsumptionPct(3000, 5000, 5000)).toBe(100);
  });
  it('gestisce consumo zero', () => {
    expect(calcSelfConsumptionPct(0, 5000, 1000)).toBe(0);
  });
  it('valore intermedio', () => {
    // consumo 6000, produzione 4000 => used 4000 => 66.66...
    const v = calcSelfConsumptionPct(6000, 4000);
    expect(Math.round(v)).toBe(67);
  });
});
