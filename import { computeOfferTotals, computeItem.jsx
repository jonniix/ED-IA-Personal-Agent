import { computeOfferTotals, computeItemTotal } from '../../lib/price';
import { currencyFormat, dateFormat } from '../../lib/format';
import { useStore } from '../../store';

export default function OfferView({ offerRef, onNew, onEdit }) {
  const offer = useStore((s) => s.offers.find((o) => o.offerRef === offerRef));
  const { subtotal, tax, discount, total } = computeOfferTotals({
    items: offer.items,
    taxPercent: offer.taxPercent,
    discount: offer.discountPct
  });

  return (
    <div>
      <h1>Offer Details</h1>
      <p>Offer Ref: {offer.offerRef}</p>
      <p>Subtotal: {currencyFormat(subtotal)}</p>
      <p>Tax: {currencyFormat(tax)}</p>
      <p>Discount: {currencyFormat(discount)}</p>
      <p>Total: {currencyFormat(total)}</p>
      <p>Created At: {dateFormat(offer.createdAt)}</p>
      {/* ...existing code... */}
    </div>
  );
}