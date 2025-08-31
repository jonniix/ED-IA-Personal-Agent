import html2pdf from 'html2pdf.js';

// Genera HTML per PDF cliente
function renderOfferHtmlPdf(offer) {
  // ...extract customer, proposal, summary, analysis...
  return `
    <div class="section">
      <h2>Dati cliente</h2>
      <!-- ...dati cliente... -->
      <h2>Dettagli proposta</h2>
      <!-- ...dettagli proposta... -->
      <h2>Riassunto</h2>
      <!-- ...riassunto... -->
    </div>
    <div style="page-break-before: always;"></div>
    <div class="section">
      <h2>Analisi economica (dettaglio)</h2>
      <!-- ...analisi dettagliata... -->
    </div>
    <div class="section">
      <h2>Condizioni di pagamento e accettazione</h2>
      <p>Il pagamento è suddiviso come segue:</p>
      <ul>
        <li>40% all’ordine materiale</li>
        <li>40% alla posa impianto FV</li>
        <li>20% allacciamento e collaudi (incluso dossier finale completo di ogni documento)</li>
      </ul>
    </div>
  `;
}

export function exportCustomerCopy(element, offer) {
  const opt = {
    margin: 10,
    filename: `${offer?.code ?? 'offerta'}.pdf`,
    pagebreak: { mode: ['css', 'legacy'] },
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  };
  return html2pdf().from(element).set(opt).save();
}