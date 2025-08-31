import React, { useMemo } from 'react';
import { useStore } from '../../store';

//perf: memoizza la riga item per evitare re-render inutili
const ItemRow = React.memo(function ItemRow({ item }) {
  return (
    <tr>
      <td>{item.qty}</td>
      <td>{item.label}</td>
      <td>{item.unitPrice}</td>
      <td>{item.qty * item.unitPrice}</td>
    </tr>
  );
});

export default function OfferView({ offerRef, onNew, onEdit }) {
  const offer = useStore((s) => s.offers.find((o) => o.offerRef === offerRef));
  //perf: memoizza la lista items per evitare calcoli ripetuti
  const itemRows = useMemo(() => (offer.items || []).map(item => item), [offer.items]);

  // ...existing code...
  return (
    // ...existing code...
    <table>
      <tbody>
        {itemRows.map((item, idx) => (
          <ItemRow key={idx} item={item} />
        ))}
      </tbody>
    </table>
    // ...existing code...
  );
}