import { defineConfig, loadEnv } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readCloudConfig } from './src/auth/config.ts';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const cloud = readCloudConfig(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
  let output = 'dist';
  return {
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'supabase', test: /node_modules\/@supabase\// },
              { name: 'react', test: /node_modules\/(react|react-dom|scheduler)\// },
              { name: 'storage', test: /node_modules\/(dexie|dexie-react-hooks)\// },
            ],
          },
        },
      },
    },
    plugins: [
      {
        name: 'sotien-csp',
        apply: 'build',
        configResolved(config) {
          output = config.build.outDir;
        },
        closeBundle() {
          const template = readFileSync(resolve('public/_headers'), 'utf8');
          writeFileSync(
            resolve(output, '_headers'),
            cloud
              ? template.replace("connect-src 'self'", `connect-src 'self' ${cloud.url}`)
              : template,
          );
        },
      },
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['icons/*.png', 'icons/icon.svg'],
        manifest: {
          id: '/',
          name: 'Sổ tiền — Tài chính cá nhân',
          short_name: 'Sổ tiền',
          description: 'Quản lý tiền trên thiết bị, kể cả khi offline.',
          lang: 'vi',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#f5f7f6',
          theme_color: '#0e655b',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            {
              src: '/icons/maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          clientsClaim: true,
          globPatterns: ['**/*.{js,css,html,png,webp,svg,woff2}'],
          navigateFallback: '/index.html',
          cleanupOutdatedCaches: true,
          navigateFallbackDenylist: [/^\/api\//],
        },
      }),
    ],
  };
});
