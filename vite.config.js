import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:80',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/capstone2/api')
      }
    }
  },
  build: {
    outDir: 'host',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        // Ensure CSS is extracted to a separate file
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    }
  }
})
