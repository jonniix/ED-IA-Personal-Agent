export default function SummaryNarrative({
  pvSizeKw, pvProdKWh, loadKWh, selfUsePct,
  selfUseValueCHF, exportValueCHF, annualBenefitCHF,
  paybackYears, netCostCHF
}) {
  const pct = (v) => `${Math.round(v*100)/100}%`;
  const fmt = (v) => new Intl.NumberFormat('it-CH', { style:'currency', currency:'CHF' }).format(v || 0);

  return (
    <section style={{ marginTop: 16 }}>
      <h3>Riepilogo</h3>
      <p>
        La proposta prevede un impianto fotovoltaico da <strong>{pvSizeKw} kW</strong>, con una produzione stimata
        di <strong>{pvProdKWh?.toLocaleString('it-CH')}</strong> kWh/anno a fronte di un consumo annuo del cliente pari a
        <strong> {loadKWh?.toLocaleString('it-CH')}</strong> kWh. In base al profilo di utilizzo stimato, la copertura dei
        consumi con energia solare raggiunge circa <strong>{pct(selfUsePct)}</strong>, massimizzando l’autoconsumo e riducendo
        gli acquisti di energia dalla rete.
      </p>
      <p>
        Dal punto di vista economico, il beneficio annuo atteso è pari a <strong>{fmt(annualBenefitCHF)}</strong>,
        composto da <strong>{fmt(selfUseValueCHF)}</strong> di risparmio diretto sull’energia autoconsumata e
        <strong> {fmt(exportValueCHF)}</strong> derivanti dall’energia immessa in rete. Considerati incentivi e oneri,
        il costo netto stimato dell’investimento è <strong>{fmt(netCostCHF)}</strong>.
      </p>
      <p>
        L’orizzonte di ammortamento è stimato in circa <strong>{paybackYears} anni</strong>, assumendo prezzi dell’energia
        e condizioni d’esercizio in linea con gli attuali. Oltre al ritorno economico, l’impianto riduce l’impronta
        ambientale e rende l’abitazione più resiliente rispetto alla volatilità dei prezzi energetici.
      </p>
    </section>
  );
}
