/**
 * Calcola energia autoconsumata (kWh) secondo regola 75%/65% del consumo,
 * clampata a produzione FV e consumo.
 * @param {number} consumoKWh - kWh annui del cliente (load)
 * @param {number} produzioneKWh - kWh annui FV (PV)
 * @param {boolean} hasHeatPump - true se pompa di calore presente
 * @param {object} [factors] - { withHP: 0.75, withoutHP: 0.65 }
 * @returns {number} kWh autoconsumati
 */
export function calcAutoconsumataKWh(consumoKWh, produzioneKWh, hasHeatPump, factors = { withHP: 0.75, withoutHP: 0.65 }) {
  const load = Math.max(0, Number(consumoKWh) || 0);
  const pv = Math.max(0, Number(produzioneKWh) || 0);
  const coverage = hasHeatPump ? factors.withHP : factors.withoutHP;
  const candidate = load * coverage;
  // Non superare produzione né consumo
  return Math.max(0, Math.min(candidate, pv, load));
}

/**
 * Calcola % autoconsumo su consumo, clampando autoconsumataKWh se passato.
 * @param {number} consumoKWh
 * @param {number} produzioneKWh
 * @param {boolean} hasHeatPump
 * @param {number} [autoconsumataKWh]
 * @returns {number} percentuale 0..100
 */
export function calcSelfConsumptionPctByLoad(consumoKWh, produzioneKWh, hasHeatPump, autoconsumataKWh) {
  const load = Math.max(0, Number(consumoKWh) || 0);
  const pv = Math.max(0, Number(produzioneKWh) || 0);

  let used;
  if (typeof autoconsumataKWh === 'number' && !Number.isNaN(autoconsumataKWh)) {
    // clamp se viene passato esplicitamente
    used = Math.max(0, Math.min(autoconsumataKWh, load, pv));
  } else {
    used = calcAutoconsumataKWh(load, pv, hasHeatPump);
  }

  return load > 0 ? (used / load) * 100 : 0;
}

/**
 * Calcola % di autoconsumo riferita al CONSUMO del cliente.
 * @param {number} consumoKWh - kWh annui del cliente (load)
 * @param {number} produzioneKWh - kWh annui FV (PV)
 * @param {number} [autoconsumataKWh] - kWh FV autoconsumati (se già calcolati altrove)
 * @returns {number} percentuale 0..100
 */
export function calcSelfConsumptionPct(consumoKWh, produzioneKWh, autoconsumataKWh) {
  const load = Number(consumoKWh) || 0;
  const pv = Number(produzioneKWh) || 0;

  let used;
  if (typeof autoconsumataKWh === 'number' && !Number.isNaN(autoconsumataKWh)) {
    used = Math.max(0, Math.min(autoconsumataKWh, load));
  } else {
    // stima semplice: autoconsumo = min(produzione, consumo)
    used = Math.max(0, Math.min(load, pv));
  }
  return load > 0 ? (used / load) * 100 : 0;
}
