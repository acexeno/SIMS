// Determines the correct API base path at runtime.
// Export as a STRING so template literals like `${API_BASE}/index.php?endpoint=...` work.
export const API_BASE = (() => {
  const isDev = ((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV)
    || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')));
  // In dev, route through Vite proxy -> Apache using /api; in production, routes go through root
  return isDev ? '/api' : '';
})();

// Helper function to determine if we're in development or production
const isDevelopment = () => {
  const viteDev = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV);
  const hostDev = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));
  return !!(viteDev || hostDev);
};

// Helper function to get the correct API endpoint format
export const getApiEndpoint = (endpoint, params = {}) => {
  if (isDevelopment()) {
    // In development, use the Vite proxy to avoid CORS; this hits /capstone2/api on Apache
    const baseUrl = `/api/${endpoint}.php`;
    if (Object.keys(params).length === 0) {
      return baseUrl;
    }
    const queryString = new URLSearchParams(params).toString();
    return `${baseUrl}?${queryString}`;
  } else {
    // In production, use endpoint routing through root index.php
    const baseUrl = `/index.php?endpoint=${endpoint}`;
    if (Object.keys(params).length === 0) {
      return baseUrl;
    }
    const queryString = new URLSearchParams(params).toString();
    return `${baseUrl}&${queryString}`;
  }
};
