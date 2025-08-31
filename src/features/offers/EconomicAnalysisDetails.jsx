import React from "react";

export default function EconomicAnalysisDetails({ data = {} }) {
  const {
    netCostCHF = 0,
    incentivesCHF = 0,
    annualBenefitCHF = 0,
    selfUseValueCHF = 0,
    exportValueCHF = 0,
    paybackYears = "—",
  } = data;

  const fmt = (v) => new Intl.NumberFormat("it-CH", { style: "currency", currency: "CHF" }).format(v || 0);

  return (
    <section>
      <h3>Analisi economica (dettaglio)</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr><td>Incentivi</td><td style={{ textAlign: "right" }}>{fmt(incentivesCHF)}</td></tr>
          <tr><td>Costo netto stimato</td><td style={{ textAlign: "right" }}>{fmt(netCostCHF)}</td></tr>
          <tr><td>Risparmio da autoconsumo (annuo)</td><td style={{ textAlign: "right" }}>{fmt(selfUseValueCHF)}</td></tr>
          <tr><td>Valore energia immessa (annuo)</td><td style={{ textAlign: "right" }}>{fmt(exportValueCHF)}</td></tr>
          <tr><td><strong>Beneficio annuo complessivo</strong></td><td style={{ textAlign: "right" }}><strong>{fmt(annualBenefitCHF)}</strong></td></tr>
          <tr><td>Ammortamento stimato</td><td style={{ textAlign: "right" }}>{paybackYears} anni</td></tr>
        </tbody>
      </table>
    </section>
  );
}
