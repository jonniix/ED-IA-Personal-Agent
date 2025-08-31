import { useStore } from '../../state/store';

export default function OfferView({ offerRef, onNew, onEdit }) {
  //state: leggi offerta dallo store
  const offer = useStore(s => s.offers.find(o => o.offerRef === offerRef));

  // ...existing code...
}