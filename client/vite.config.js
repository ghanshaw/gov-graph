import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Hand-written data shared with the server (category structures) lives in server/seed/data.
  resolve: {
    alias: { '@data': fileURLToPath(new URL('../server/seed/data', import.meta.url)) },
  },
  server: {
    port: 9000,
    strictPort: true,
    fs: { allow: ['..'] },
    proxy: {
      '/graphql': 'http://localhost:9001',
      '/pdf': 'http://localhost:9001',
    },
  },
})
