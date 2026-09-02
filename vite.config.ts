import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src'),
    },
  },
  plugins: [react()],
  server: {
    host: true,
    port: Number(process.env.WEB_PORT) || 5173,
    proxy: {
      '/api': `http://127.0.0.1:${process.env.PORT || 3001}`,
    },
  },
})
