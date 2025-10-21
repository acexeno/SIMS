// vite.config.js
import { defineConfig } from "file:///C:/xampp/htdocs/capstone2/node_modules/vite/dist/node/index.js";
import react from "file:///C:/xampp/htdocs/capstone2/node_modules/@vitejs/plugin-react/dist/index.mjs";
var vite_config_default = defineConfig({
  // Use relative base so built assets work under subpaths (e.g., /capstone2/backend/public)
  base: "./",
  root: ".",
  plugins: [react()],
  build: {
    outDir: "backend/public",
    emptyOutDir: false,
    assetsDir: "assets"
  },
  server: {
    port: 5175,
    host: true,
    proxy: {
      // Proxy API requests to XAMPP Apache backend (default port 80)
      "/api": {
        target: "http://localhost/capstone2",
        // If Apache uses a different port, e.g., 8080, use 'http://localhost:8080/capstone2'
        changeOrigin: true,
        secure: false
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFx4YW1wcFxcXFxodGRvY3NcXFxcY2Fwc3RvbmUyXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFx4YW1wcFxcXFxodGRvY3NcXFxcY2Fwc3RvbmUyXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi94YW1wcC9odGRvY3MvY2Fwc3RvbmUyL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIC8vIFVzZSByZWxhdGl2ZSBiYXNlIHNvIGJ1aWx0IGFzc2V0cyB3b3JrIHVuZGVyIHN1YnBhdGhzIChlLmcuLCAvY2Fwc3RvbmUyL2JhY2tlbmQvcHVibGljKVxuICBiYXNlOiAnLi8nLFxuICByb290OiAnLicsXG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6ICdiYWNrZW5kL3B1YmxpYycsXG4gICAgZW1wdHlPdXREaXI6IGZhbHNlLFxuICAgIGFzc2V0c0RpcjogJ2Fzc2V0cycsXG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDUxNzUsXG4gICAgaG9zdDogdHJ1ZSxcbiAgICBwcm94eToge1xuICAgICAgLy8gUHJveHkgQVBJIHJlcXVlc3RzIHRvIFhBTVBQIEFwYWNoZSBiYWNrZW5kIChkZWZhdWx0IHBvcnQgODApXG4gICAgICAnL2FwaSc6IHtcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdC9jYXBzdG9uZTInLCAvLyBJZiBBcGFjaGUgdXNlcyBhIGRpZmZlcmVudCBwb3J0LCBlLmcuLCA4MDgwLCB1c2UgJ2h0dHA6Ly9sb2NhbGhvc3Q6ODA4MC9jYXBzdG9uZTInXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcbiAgICAgIH1cbiAgICB9LFxuICB9XG59KSJdLAogICJtYXBwaW5ncyI6ICI7QUFBcVEsU0FBUyxvQkFBb0I7QUFDbFMsT0FBTyxXQUFXO0FBR2xCLElBQU8sc0JBQVEsYUFBYTtBQUFBO0FBQUEsRUFFMUIsTUFBTTtBQUFBLEVBQ04sTUFBTTtBQUFBLEVBQ04sU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLGFBQWE7QUFBQSxJQUNiLFdBQVc7QUFBQSxFQUNiO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUE7QUFBQSxNQUVMLFFBQVE7QUFBQSxRQUNOLFFBQVE7QUFBQTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBLE1BQ1Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
