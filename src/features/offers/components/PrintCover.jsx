import React from 'react';
import formatDate from '../../../lib/format';
import { company, publicUrl } from '../../../lib/company';

export default function PrintCover({ title, offer, customer }) {
  const logoSrc = publicUrl('/logo.png');
  const num = offer?.code || offer?.id || '—';
  const when = formatDate(offer?.date);
  const custName = customer?.name || customer?.displayName || customer?.ragioneSociale || '—';
  const custAddr = [customer?.address, customer?.zip, customer?.city].filter(Boolean).join(', ');

  return (
    <div className="print-cover" style={{ display:'grid', gridTemplateColumns:'120px 1fr', gap:16, alignItems:'center' }}>
      <img src={logoSrc} alt="Logo" style={{ width:120, height:'auto', objectFit:'contain' }} />
      <div>
        <h1>{title}</h1>
        <h2>{company.name}</h2>
        <div className="kv"><strong>Indirizzo:</strong> {company.address}</div>
        <div className="kv"><strong>P.IVA:</strong> {company.vat}</div>
        <div className="kv"><strong>Email:</strong> {company.email} — <strong>Tel:</strong> {company.phone}</div>
        <div className="kv"><strong>Numero offerta:</strong> {num}</div>
        <div className="kv"><strong>Data:</strong> {when}</div>
        <div className="kv"><strong>Cliente:</strong> {custName}{custAddr ? ` — ${custAddr}` : ''}</div>
      </div>
    </div>
  );
}
