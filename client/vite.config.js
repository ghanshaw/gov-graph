import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 9000,
    strictPort: true,
    proxy: {
      '/graphql': 'http://localhost:9001',
      '/pdf': 'http://localhost:9001',
    },
  },
})
