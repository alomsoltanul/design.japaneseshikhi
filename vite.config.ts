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
    },
  },
})