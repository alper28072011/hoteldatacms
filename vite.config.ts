import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Dev sunucusu ayarları
  server: { 
    host: '0.0.0.0', 
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
    strictPort: true
  },
  // Prod (Önizleme/Yayın) sunucusu ayarları - Google Cloud genellikle bunu tetikler
  preview: {
    host: '0.0.0.0',
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
    strictPort: true,
    allowedHosts: true // Bulut ortamında host kısıtlamalarını aşmak için
  },
  plugins: [react(), tailwindcss()],
  resolve: { 
    alias: { '@/': path.resolve(__dirname, './') } 
  }
});
