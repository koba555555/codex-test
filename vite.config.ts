import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: '工事日誌PWA',
        short_name: '工事日誌',
        description: '土木施工管理向けの工事日誌アプリ',
        theme_color: '#0f172a',
        background_color: '#f1f5f9',
        display: 'standalone',
        lang: 'ja',
        start_url: '/',
        icons: [{ src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,json}']
      }
    })
  ]
});
