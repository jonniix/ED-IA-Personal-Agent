const DB_NAME = "pv_offers_db";
const DB_VER  = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Offerte
      if (!db.objectStoreNames.contains("offers")) {
        const store = db.createObjectStore("offers", { keyPath: "offerRef" });
        if (!store.indexNames.contains("createdAt")) {
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
      }
      // PDF
      if (!db.objectStoreNames.contains("pdfs")) {
        db.createObjectStore("pdfs", { keyPath: "offerRef" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// --- OFFERS ---
async function saveOfferToDB(offer) {
  try {
    if (!offer || !offer.offerRef) throw new Error("offerRef mancante");
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(["offers"], "readwrite");
      tx.oncomplete = () => resolve(true);
      tx.onerror    = () => reject(tx.error);
      tx.objectStore("offers").put(offer);
    });
  } catch (err) {
    console.error("[db] saveOfferToDB", err);
    throw err;
  }
}

async function getOfferFromDB(offerRef) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx  = db.transaction(["offers"], "readonly");
      const req = tx.objectStore("offers").get(offerRef);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => reject(req.error);
    });
  } catch (err) {
    console.error("[db] getOfferFromDB", err);
    return null;
  }
}

async function listOffersFromDB() {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const out = [];
      const tx  = db.transaction(["offers"], "readonly");
      const idx = tx.objectStore("offers").index("createdAt");
      // Ordine decrescente su createdAt
      const direction = "prev"; // usa la coda dell’indice
      const req = idx.openCursor(null, direction);
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          out.push(cursor.value);
          cursor.continue();
        } else {
          resolve(out);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("[db] listOffersFromDB", err);
    return [];
  }
}

async function deleteOfferFromDB(offerRef) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(["offers","pdfs"], "readwrite");
      tx.oncomplete = () => resolve(true);
      tx.onerror    = () => reject(tx.error);
      tx.objectStore("offers").delete(offerRef);
      tx.objectStore("pdfs").delete(offerRef);
    });
  } catch (err) {
    console.error("[db] deleteOfferFromDB", err);
    throw err;
  }
}

// --- PDFS ---
async function savePdfToDB(offerRef, blob) {
  try {
    if (!offerRef || !blob) throw new Error("Parametri PDF mancanti");
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(["pdfs"], "readwrite");
      tx.oncomplete = () => resolve(true);
      tx.onerror    = () => reject(tx.error);
      tx.objectStore("pdfs").put({ offerRef, blob });
    });
  } catch (err) {
    console.error("[db] savePdfToDB", err);
    throw err;
  }
}

async function getPdfFromDB(offerRef) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx  = db.transaction(["pdfs"], "readonly");
      const req = tx.objectStore("pdfs").get(offerRef);
      req.onsuccess = () => {
        const rec = req.result;
        resolve(rec ? rec.blob : null);
      };
      req.onerror   = () => reject(req.error);
    });
  } catch (err) {
    console.error("[db] getPdfFromDB", err);
    return null;
  }
}

export {
  saveOfferToDB,
  getOfferFromDB,
  listOffersFromDB,
  deleteOfferFromDB,
  savePdfToDB,
  getPdfFromDB
};
