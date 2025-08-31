import { useStore } from '../../state/store';

export default function CatalogEditor() {
  //state: leggi catalogo dallo store
  const catalog = useStore(s => s.catalog);
  const setCatalog = useStore(s => s.setCatalog);

  return (
    // ...existing JSX code...
  );
}