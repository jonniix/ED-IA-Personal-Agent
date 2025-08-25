// PDF export utility using html2pdf.js

export async function exportOfferToPdf(element, filename = 'offerta.pdf') {
  // Check if html2pdf is available
  if (typeof window.html2pdf === 'undefined') {
    throw new Error('html2pdf.js non è caricato correttamente');
  }

  const opt = {
    margin: [10, 10, 10, 10],
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  
  try {
    const worker = window.html2pdf().set(opt).from(element);
    const blob = await worker.outputPdf('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    return blob;
  } catch (error) {
    console.error('Errore durante esportazione PDF:', error);
    throw error;
  }
}
