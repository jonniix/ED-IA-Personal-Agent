# PV Event Toolkit

Toolkit React + Vite + Tailwind per eventi FV.

## Requisiti

- Node.js 18+

## Setup

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
npm run preview
```

## Deploy manuale su GitHub Pages

```sh
npm run deploy
```

Oppure usa lo script Windows:

```sh
start_app.bat
```

## Deploy automatico (GitHub Actions)

- Workflow già incluso: `.github/workflows/pages.yml`
- Abilita Pages in Settings → Pages → “Build and deployment: GitHub Actions”.

## URL finale dell’app

[https://jonat.github.io/pv-event-toolkit/](https://jonat.github.io/pv-event-toolkit/) <!-- Aggiorna con GITHUB_USERNAME e REPO_NAME -->

## Note tecniche

- In sviluppo i service worker sono disattivati.
- In produzione saranno attivi solo se registrati con `import.meta.env.PROD`.

## Primo push su GitHub

```sh
git init
git add .
git commit -m "setup"
git branch -M main
git remote add origin git@github.com:jonat/pv-event-toolkit.git
git push -u origin main
```

Abilita GitHub Pages dalle impostazioni del repository.
