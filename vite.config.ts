import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/agent-z-mark.png', 'icons/apple-touch-icon.png'],
        manifest: {
          name: 'Agent Z',
          short_name: 'Agent Z',
          description: '생각을 확장하고, 대화를 통해 나를 기억하는 AI',
          theme_color: '#11100f',
          background_color: '#fffaf4',
          display: 'standalone',
          start_url: './',
          scope: './',
          lang: 'ko',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
          ]
        },
        workbox: {
          navigateFallback: 'index.html',
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
          runtimeCaching: [
            {
              urlPattern: /\.wasm$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'agent-z-onnx-runtime',
                expiration: { maxEntries: 4, maxAgeSeconds: 31_536_000 }
              }
            }
          ]
        }
      })
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalized = id.replace(/\\/g, '/');
            if (normalized.includes('/node_modules/@firebase/auth/')) return 'firebase-auth';
            if (normalized.includes('/node_modules/@firebase/firestore/')) return 'firebase-firestore';
            if (normalized.includes('/node_modules/@firebase/functions/')) return 'firebase-functions';
            if (normalized.includes('/node_modules/@firebase/app/')) return 'firebase-app';
            if (normalized.includes('/node_modules/@firebase/')) return 'firebase-core';
            if (normalized.includes('/node_modules/firebase/')) return 'firebase-sdk';
            if (/\/node_modules\/(react|react-dom|scheduler)\//.test(normalized)) return 'react-vendor';
          }
        }
      }
    }
  };
});
