// IndexedDB implementation for offers and PDFs

const DB_NAME = 'PV_Offers_DB';
const DB_VERSION = 1;
const OFFERS_STORE = 'offers';
const PDFS_STORE = 'pdfs';

// Initialize IndexedDB
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create offers store
      if (!db.objectStoreNames.contains(OFFERS_STORE)) {
        const offersStore = db.createObjectStore(OFFERS_STORE, { keyPath: 'offerRef' });
        offersStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      
      // Create PDFs store  
      if (!db.objectStoreNames.contains(PDFS_STORE)) {
        db.createObjectStore(PDFS_STORE, { keyPath: 'offerRef' });
      }
    };
  });
}

// Save offer to IndexedDB
export async function saveOfferToDB(offer) {
  try {
    const db = await initDB();
    const transaction = db.transaction([OFFERS_STORE], 'readwrite');
    const store = transaction.objectStore(OFFERS_STORE);
    await store.put(offer);
    return true;
  } catch (error) {
    console.error('Error saving offer to DB:', error);
    return false;
  }
}

// Get offer from IndexedDB
export async function getOfferFromDB(offerRef) {
  try {
    const db = await initDB();
    const transaction = db.transaction([OFFERS_STORE], 'readonly');
    const store = transaction.objectStore(OFFERS_STORE);
    return await store.get(offerRef);
  } catch (error) {
    console.error('Error getting offer from DB:', error);
    return null;
  }
}

// List all offers from IndexedDB (sorted by date descending)
export async function listOffersFromDB() {
  try {
    const db = await initDB();
    const transaction = db.transaction([OFFERS_STORE], 'readonly');
    const store = transaction.objectStore(OFFERS_STORE);
    const index = store.index('createdAt');
    
    return new Promise((resolve, reject) => {
      const offers = [];
      const request = index.openCursor(null, 'prev'); // descending order
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          offers.push(cursor.value);
          cursor.continue();
        } else {
          resolve(offers);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error listing offers from DB:', error);
    return [];
  }
}

// Delete offer from IndexedDB
export async function deleteOfferFromDB(offerRef) {
  try {
    const db = await initDB();
    const transaction = db.transaction([OFFERS_STORE, PDFS_STORE], 'readwrite');
    
    // Delete from both stores
    await transaction.objectStore(OFFERS_STORE).delete(offerRef);
    await transaction.objectStore(PDFS_STORE).delete(offerRef);
    
    return true;
  } catch (error) {
    console.error('Error deleting offer from DB:', error);
    return false;
  }
}

// Save PDF blob to IndexedDB
export async function savePdfToDB(offerRef, blob) {
  try {
    const db = await initDB();
    const transaction = db.transaction([PDFS_STORE], 'readwrite');
    const store = transaction.objectStore(PDFS_STORE);
    await store.put({ offerRef, blob });
    return true;
  } catch (error) {
    console.error('Error saving PDF to DB:', error);
    return false;
  }
}

// Get PDF blob from IndexedDB
export async function getPdfFromDB(offerRef) {
  try {
    const db = await initDB();
    const transaction = db.transaction([PDFS_STORE], 'readonly');
    const store = transaction.objectStore(PDFS_STORE);
    const result = await store.get(offerRef);
    return result ? result.blob : null;
  } catch (error) {
    console.error('Error getting PDF from DB:', error);
    return null;
  }
}

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
