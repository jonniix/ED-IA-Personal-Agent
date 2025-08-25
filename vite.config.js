import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/pv-event-toolkit/', // <-- Sostituisci pv-event-toolkit con il tuo REPO_NAME se diverso
  plugins: [react()],
})
