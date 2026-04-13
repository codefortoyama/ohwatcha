import { defineConfig } from 'vite'

// Proxy /api to the remote Directus to avoid CORS during development.
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'https://cms.ohwatcha.evolinq.link',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
