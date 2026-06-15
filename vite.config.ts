import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    proxy: {
      '/api/voicevox': {
        target: 'http://127.0.0.1:50021',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/voicevox/, ''),
      },
      // Dev only: forward /api/* to the Vercel functions server (`vercel dev`).
      // Set VITE_API_PROXY=http://localhost:3009 to run the SPA on vite while
      // the serverless content-factory routes run under vercel dev.
      ...(process.env.VITE_API_PROXY
        ? { '/api': { target: process.env.VITE_API_PROXY, changeOrigin: true } }
        : {}),
    },
  },
})