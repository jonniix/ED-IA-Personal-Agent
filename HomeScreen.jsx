import { useStore } from '../../state/store';

export default function HomeScreen({ setRoute, company }) {
  //state: leggi offerte/bozza dallo store se serve
  const offers = useStore(s => s.offers);
  const draft = useStore(s => s.draft);

  return (
    // ...existing JSX code...
  );
}