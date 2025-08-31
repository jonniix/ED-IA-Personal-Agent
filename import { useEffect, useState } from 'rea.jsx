import { useEffect, useState } from 'react';
import { listOffers, getOffer, deleteOffer, getPdf } from '../../lib/db.dexie';

export default function ArchiveView({ onSelectOffer }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadOffers(); }, []);
  const loadOffers = async () => {
    try {
      const offerList = await listOffers();
      setOffers(offerList);
    } catch (error) {
      console.error('Errore nel caricamento offerte:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOffer = async (offerRef) => {
    if (window.confirm('Sei sicuro di voler eliminare questa offerta?')) {
      try {
        await deleteOffer(offerRef);
        await loadOffers();
      } catch (e) {
        alert('Errore eliminazione offerta');
      }
    }
  };

  const handleDownloadJson = async (offerRef) => {
    try {
      const offer = await getOffer(offerRef);
      const dataStr = JSON.stringify(offer, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      const exportFileDefaultName = `prg/${offerRef}.json`;
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (error) {
      console.error('Errore nel download JSON:', error);
      alert('Errore nel download del file JSON');
    }
  };

  const handleDownloadPdf = async (offerRef) => {
    try {
      const pdfBlob = await getPdf(offerRef);
      if (!pdfBlob) {
        alert('Nessun PDF trovato per questa offerta');
        return;
      }
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `prg-pdf/${offerRef}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Errore nel download PDF:', error);
      alert('Errore nel download del file PDF');
    }
  };

  return (
    <div>
      <h1>Archivio Offerte</h1>
      {loading ? (
        <p>Caricamento in corso...</p>
      ) : (
        <ul>
          {offers.map(offer => (
            <li key={offer.id}>
              <span>{offer.title}</span>
              <button onClick={() => onSelectOffer(offer)}>Seleziona</button>
              <button onClick={() => handleDeleteOffer(offer.id)}>Elimina</button>
              <button onClick={() => handleDownloadJson(offer.id)}>Scarica JSON</button>
              <button onClick={() => handleDownloadPdf(offer.id)}>Scarica PDF</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}