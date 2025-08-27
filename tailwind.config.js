/** @type {import('tailwindcss').Config} */
// tailwind.config.js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    // Se hai file React anche fuori da /src, aggiungi eventualmente:
    // "./*.{js,ts,jsx,tsx}",
    // Esclusione extra (se vuoi tenere pattern larghi):
    "!./node_modules/**"
  ],
  theme: { extend: {} },
  plugins: [],
}
