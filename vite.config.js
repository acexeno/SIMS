import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Use relative base so built assets work under subpaths (e.g., /capstone2/backend/public)
  base: './',
  root: '.',
  plugins: [react()],
  build: {
    outDir: 'backend/public',
    emptyOutDir: false,
    assetsDir: 'assets',
  },
  server: {
    port: 5175,
    host: true,
    proxy: {
      // Proxy API requests to XAMPP Apache backend (default port 80)
      '/api': {
        target: 'http://localhost/capstone2', // If Apache uses a different port, e.g., 8080, use 'http://localhost:8080/capstone2'
        changeOrigin: true,
        secure: false,
      }
    },
  }
})