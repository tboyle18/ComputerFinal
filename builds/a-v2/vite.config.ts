import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'supabase': ['@supabase/supabase-js'],
          'router': ['react-router-dom'],
          'store': ['zustand']
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: false
  }
})
