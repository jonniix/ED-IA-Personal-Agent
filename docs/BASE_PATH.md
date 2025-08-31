# Configurazione Base Path (GitHub Pages)

La pubblicazione su GitHub Pages richiede che gli asset siano serviti con un base path del tipo:

`/NOME-REPO/`

In questo progetto il default rimane:

`/ED-IA-Personal-Agent/`

Puoi sovrascriverlo senza modificare il codice:

- Via `.env` Vite:
  - `VITE_BASE_PATH=/NOME-REPO/`
- Via variabile ambiente (CI/local):
  - `BASE_PATH=/NOME-REPO/`

Nota: il campo `homepage` di `package.json` non è utilizzato da Vite per il base path; fa fede `vite.config.js`.
