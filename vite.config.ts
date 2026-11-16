import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GÜVENLİK: Buraya hiçbir API anahtarı eklemeyin. `define` ile eklenen her değer
// yayınlanan JavaScript dosyasına düz metin olarak gömülür ve herkes görebilir.
// Gemini anahtarı yalnız sunucudaki /api/gemini ara katmanında tutulur.
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
