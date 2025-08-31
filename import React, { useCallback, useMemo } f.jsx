import React, { useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

//perf: memoizza la riga offerta per evitare re-render inutili
const OfferRow = React.memo(function OfferRow({ offer, onSelectOffer, onDownloadJson, onDownloadPdf, onDeleteOffer }) {
  return (
    <Card key={offer.offerRef}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{offer.offerRef}</h3>
          <p className="text-sm text-zinc-500">
            {new Date(offer.createdAt).toLocaleDateString('it-CH')} ·
            {/* ...existing code... */}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="subtle" size="sm" onClick={() => onSelectOffer(offer)} ariaLabel={t('btn.open_last_offer')}>{t('btn.open_last_offer')}</Button>
          <Button variant="subtle" size="sm" onClick={() => onDownloadJson(offer.offerRef)} ariaLabel="Scarica JSON">Scarica JSON</Button>
          <Button variant="subtle" size="sm" onClick={() => onDownloadPdf(offer.offerRef)} ariaLabel="Scarica PDF">Scarica PDF</Button>
          <Button variant="subtle" size="sm" onClick={() => onDeleteOffer(offer.offerRef)} ariaLabel={t('btn.cancel')}>{t('btn.cancel')}</Button>
        </div>
      </div>
    </Card>
  );
});

export default function ArchiveView({ onSelectOffer }) {
  // ...existing code...
  //perf: memoizza la lista offerte per evitare calcoli ripetuti
  const offerRows = useMemo(() => offers.map(offer => offer), [offers]);

  //perf: memoizza gli handler per evitare re-render delle righe
  const handleSelectOffer = useCallback((offer) => onSelectOffer(offer), [onSelectOffer]);
  const handleDownloadJsonMemo = useCallback(handleDownloadJson, []);
  const handleDownloadPdfMemo = useCallback(handleDownloadPdf, []);
  const handleDeleteOfferMemo = useCallback(handleDeleteOffer, []);

  // ...existing code...
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      {/* ...existing code... */}
      {offers.length === 0 ? (
        <Card>
          <div className="text-center py-8 text-zinc-500">{t('msg.no_offers')}</div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {offerRows.map((offer) => (
            <OfferRow
              key={offer.offerRef}
              offer={offer}
              onSelectOffer={handleSelectOffer}
              onDownloadJson={handleDownloadJsonMemo}
              onDownloadPdf={handleDownloadPdfMemo}
              onDeleteOffer={handleDeleteOfferMemo}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}