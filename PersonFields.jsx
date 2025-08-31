import { useStore } from '../../state/store';

export default function PersonFields() {
  //state: leggi/aggiorna draft dallo store
  const draft = useStore(s => s.draft);
  const setDraft = useStore(s => s.setDraft);

  return (
    // ...existing JSX code...
  );
}