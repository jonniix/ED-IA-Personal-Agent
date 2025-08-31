import React from "react";

export default function EnergyPerformance({ data = {} }) {
  const {
    pvProdKWh = 0,
    loadKWh = 0,
    selfUsePct = 0,
    autoconsumataKWh = Math.min(pvProdKWh || 0, loadKWh || 0),
  } = data;

  const pct = (v) => `${Math.round((v || 0) * 100) / 100}%`;
  const kwh = (v) => (v || 0).toLocaleString("it-CH");

  return (
    <section>
      <h3>Rendimento energetico stimato</h3>
      <ul>
        <li><strong>Produzione FV annua:</strong> {kwh(pvProdKWh)} kWh</li>
        <li><strong>Consumo annuo cliente:</strong> {kwh(loadKWh)} kWh</li>
        <li><strong>Autoconsumo:</strong> {kwh(autoconsumataKWh)} kWh ({pct(selfUsePct)})</li>
      </ul>
    </section>
  );
}
