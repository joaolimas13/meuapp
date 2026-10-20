import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vite = servidor de desenvolvimento + empacotador. Os plugins ligam React e Tailwind.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    fs: { allow: ['..'] },
    // Em desenvolvimento, /api vai para o backend (evita problemas de CORS).
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  // `npm run preview` também encaminha /api.
  preview: { port: 4173, proxy: { '/api': 'http://127.0.0.1:8787' } },
})
