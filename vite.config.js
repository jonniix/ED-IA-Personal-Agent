import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Base path strategy
// - default keeps current behavior: '/ED-IA-Personal-Agent/'
// - override via VITE_BASE_PATH or BASE_PATH environment variable
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = env.VITE_BASE_PATH || process.env.BASE_PATH || '/ED-IA-Personal-Agent/'
  return {
    base,
    plugins: [react()],
  }
})

