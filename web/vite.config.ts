import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'ห้องซ้อม — เครื่องมือฝึกดนตรี',
        short_name: 'ห้องซ้อม',
        lang: 'th',
        description: 'แยกไลน์ดนตรี ฝึกเล่น แกะเพลง ฝึกร้องเพลง ฝึกหู เมโทรนอม จูนเนอร์ และบันทึกเวลาซ้อม',
        start_url: '/',
        display: 'standalone',
        theme_color: '#15131e',
        background_color: '#15131e',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
