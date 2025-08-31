import React from "react";
import formatDate from "../../lib/format";

export default function CustomerData({ offer, customer }) {
  const name = customer?.name || customer?.displayName || customer?.ragioneSociale || "—";
  const addr = [customer?.address, customer?.zip, customer?.city].filter(Boolean).join(", ");
  const email = customer?.email || "—";
  const phone = customer?.phone || "—";
  const date = formatDate(offer?.date);

  return (
    <section>
      <h3>Dati cliente</h3>
      <p><strong>Cliente:</strong> {name}</p>
      {addr && <p><strong>Indirizzo:</strong> {addr}</p>}
      <p><strong>Email:</strong> {email} — <strong>Tel:</strong> {phone}</p>
      <p><strong>Data offerta:</strong> {date}</p>
    </section>
  );
}
