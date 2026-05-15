import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'API Vendor App',
        short_name: 'Vendor',
        theme_color: '#F4A623',
        background_color: '#F4A623',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/api-logo-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/api-logo-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})
