import React from "react";

export default function ProposalDetails({ offer = {}, analysis = {} }) {
  const pvSizeKw = analysis.pvSizeKw ?? offer.pvSizeKw ?? "—";
  const modules = offer.modules ?? offer.moduli ?? "—";
  const inverter = offer.inverter ?? "—";
  const roof = offer.roof ?? offer.tetto ?? "";
  return (
    <section>
      <h3>Dettagli proposta</h3>
      <ul>
        <li><strong>Potenza impianto:</strong> {pvSizeKw} kW</li>
        <li><strong>Moduli:</strong> {modules}</li>
        <li><strong>Inverter:</strong> {inverter}</li>
        {roof && <li><strong>Copertura/Tetto:</strong> {roof}</li>}
      </ul>
    </section>
  );
}
