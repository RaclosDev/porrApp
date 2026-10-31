/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('@tanstack')) return 'data-vendor';
          if (id.includes('@react-oauth')) return 'auth-vendor';
          if (id.includes('react-hot-toast')) return 'toast-vendor';
          if (id.includes('html2canvas')) return 'html2canvas';
          if (id.includes('zustand')) return 'store-vendor';

          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/react-router-dom/') ||
            id.includes('/node_modules/scheduler/')
          ) {
            return 'react-core';
          }
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon-paper.png',
        'apple-touch-icon-paper.png',
        'icon-paper-192.png',
        'icon-paper-512.png',
        'maskable-paper-512.png',
      ],
      manifest: {
        name: 'PorrApp · Porras de fútbol',
        short_name: 'PorrApp',
        description:
          'La porra de toda la vida, pero bien hecha: crea porras de tus competiciones y compite con tus amigos.',
        lang: 'es',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        categories: ['sports', 'entertainment'],
        icons: [
          { src: '/icon-paper-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-paper-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/maskable-paper-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        importScripts: ['/sw-cleanup.js'],
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        globPatterns: ['**/*.{js,css,html,ico,svg}'],
        // html2canvas solo se carga con import() al compartir la clasificación: se baja al usarlo.
        globIgnores: ['**/updates/**', '**/og-image.jpg', '**/assets/html2canvas-*.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /^\/assets\/html2canvas-[\w-]+\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'lazy-chunks-cache',
              expiration: { maxEntries: 2 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }) =>
              url.hostname.includes('flagcdn.com') || url.hostname.includes('espncdn.com'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'cdn-images-cache-v2',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // API_PROXY_TARGET permite usar otra API (p. ej. la de producción en modo demo).
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
      },
      // Permite probar la imagen de invitación contra el backend local.
      '/join': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    exclude: ['node_modules/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.d.ts', 'src/main.tsx'],
      reporter: ['text-summary', 'html', 'json-summary'],
      thresholds: { lines: 52, statements: 50, functions: 46, branches: 42 },
    },
  },
});
