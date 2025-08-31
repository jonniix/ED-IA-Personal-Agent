import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

function assetUrl(p) {
  // costruisce URL rispettando il base di Vite senza duplicarlo
  return new URL(p.replace(/^\/+/, ''), import.meta.env.BASE_URL).toString();
}

const src = assetUrl('vendor/html2pdf.bundle.min.js');
const s = document.createElement('script');
s.src = src;
s.async = true;
document.head.appendChild(s);

export function exportPdf(elementId) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Nessun elemento trovato con l'ID: ${elementId}`);
    return;
  }

  html2canvas(element)
    .then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF();
      const imgWidth = 190;
      const pageHeight = pdf.internal.pageSize.height;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save("download.pdf");
    })
    .catch((error) => {
      console.error("Errore durante l'esportazione in PDF:", error);
    });
}