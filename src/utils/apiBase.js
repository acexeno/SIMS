// Determines the correct API base at runtime for both dev and production builds.
// In dev (Vite), BASE_URL is '/', and we rely on the dev proxy for '/api'.
// In production when hosted at '/capstone2/dist/', BASE_URL is '/capstone2/dist/' and API lives at '/capstone2/api'.
export const API_BASE = (() => {
  const base = (import.meta && import.meta.env && import.meta.env.BASE_URL) || '/';
  // If Vite injected a project subpath (e.g., '/capstone2/dist/'), use it
  const fromBase = base.match(/^\/(.+?)\/dist\/$/);
  if (fromBase) {
    return `/${fromBase[1]}/api`;
  }
  // If base is './', derive project root from the current URL path
  if (base === './' && typeof window !== 'undefined') {
    const path = window.location.pathname || '/';
    // e.g., '/capstone2/dist/' or '/capstone2/dist/index.html'
    const m = path.match(/^(.*)\/dist(?:\/.+|\/)??$/);
    if (m && m[1]) {
      return `${m[1]}/api`;
    }
  }
  // Fallback: root-level api
  return '/api';
})();
