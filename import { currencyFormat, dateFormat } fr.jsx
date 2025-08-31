import { currencyFormat, dateFormat } from '../../lib/format';

export default function ArchiveView({ onSelectOffer }) {
  const offers = useStore((s) => s.offers);

  return (
    <div>
      {offers.map((offer) => (
        <div key={offer.id} onClick={() => onSelectOffer(offer)}>
          <h2>{offer.title}</h2>
          <p>{currencyFormat(offer.price)}</p>
          <p>{dateFormat(offer.createdAt)}</p>
        </div>
      ))}
    </div>
  );
}