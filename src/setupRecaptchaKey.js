/**
 * Ensure window.RECAPTCHA_SITE_KEY is populated at runtime without inline scripts.
 * Falls back to the known production key when the environment variable is missing.
 */
const FALLBACK_SITE_KEY = '6LfVeQAsAAAAAMqw5OZ0mbNLGTBXtrWydNCW30VC';

const envSiteKey = typeof import.meta !== 'undefined'
  ? (import.meta.env?.VITE_RECAPTCHA_SITE_KEY || '').trim()
  : '';

const siteKey = envSiteKey || FALLBACK_SITE_KEY;

if (typeof window !== 'undefined' && siteKey) {
  const currentKey = window.RECAPTCHA_SITE_KEY;
  const needsUpdate =
    !currentKey ||
    currentKey === 'YOUR_RECAPTCHA_SITE_KEY_HERE' ||
    currentKey.trim() === '';

  if (needsUpdate) {
    Object.defineProperty(window, 'RECAPTCHA_SITE_KEY', {
      value: siteKey,
      writable: false,
      configurable: false
    });
    console.log('[setupRecaptchaKey] reCAPTCHA site key initialized from bundle');
  }
}

