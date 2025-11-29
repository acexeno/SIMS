/**
 * reCAPTCHA utility for frontend
 * Handles reCAPTCHA v2 (visible checkbox) site key configuration and token generation
 */

// Get reCAPTCHA site key from environment or use default
// In production, set this via environment variables or config
// Use a function to check dynamically since window.RECAPTCHA_SITE_KEY may be set after module load
export const getRecaptchaSiteKey = () => {
  return import.meta.env.VITE_RECAPTCHA_SITE_KEY || 
    (typeof window !== 'undefined' ? window.RECAPTCHA_SITE_KEY : null) || 
    'YOUR_RECAPTCHA_SITE_KEY_HERE';
};

// For backward compatibility, export as constant that checks dynamically
export const RECAPTCHA_SITE_KEY = getRecaptchaSiteKey();

// Store the initialization promise to prevent multiple simultaneous initializations
let initPromise = null;

/**
 * Initialize reCAPTCHA v2 by loading the Google script if not already loaded
 */
export const initializeRecaptcha = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve();
  }

  // Check if script is already loaded
  if (window.grecaptcha) {
    return Promise.resolve();
  }

  // If initialization is already in progress, return the existing promise
  if (initPromise) {
    return initPromise;
  }

  // Check if script tag already exists
  const existingScript = document.querySelector('script[src*="recaptcha"]');
  if (existingScript) {
    initPromise = new Promise((resolve) => {
      if (window.grecaptcha) {
        initPromise = null;
        resolve();
      } else {
        const checkExisting = setInterval(() => {
          if (window.grecaptcha) {
            clearInterval(checkExisting);
            initPromise = null;
            resolve();
          }
        }, 100);
        
        existingScript.onload = () => {
          clearInterval(checkExisting);
          initPromise = null;
          resolve();
        };
      }
    });
    return initPromise;
  }

  // Load the reCAPTCHA v2 script (explicit mode for v2)
  const siteKey = getRecaptchaSiteKey();
  console.log('[reCAPTCHA] Loading v2 script with Site Key:', siteKey ? `${siteKey.substring(0, 10)}...` : 'NOT SET');
  
  initPromise = new Promise((resolve, reject) => {
    // Create unique callback name with a more persistent identifier
    const callbackName = `onRecaptchaLoad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Set up global callback for when script loads - make it safe to call multiple times
    let callbackCalled = false;
    let callbackResolved = false;
    
    // Define callback function BEFORE creating script to avoid race conditions
    window[callbackName] = () => {
      if (callbackCalled) {
        console.log('[reCAPTCHA] Callback already called, ignoring duplicate call');
        return; // Prevent multiple calls
      }
      callbackCalled = true;
      console.log('[reCAPTCHA] v2 Script loaded and ready via callback');
      
      // Clean up callback after a longer delay to ensure reCAPTCHA has finished
      setTimeout(() => {
        if (window[callbackName]) {
          delete window[callbackName];
        }
      }, 10000); // Increased to 10 seconds to ensure reCAPTCHA has finished
      
      if (!callbackResolved) {
        callbackResolved = true;
        if (initPromise) {
          initPromise = null;
        }
        resolve();
      }
    };
    
    // Ensure callback is available on window before script loads
    // Use a small delay to ensure window object is ready
    setTimeout(() => {
      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=explicit&onload=${callbackName}`;
      script.async = true;
      script.defer = true;
    
      script.onload = () => {
        // Wait a bit for grecaptcha to be available
        const checkInterval = setInterval(() => {
          if (window.grecaptcha) {
            clearInterval(checkInterval);
            console.log('[reCAPTCHA] Successfully initialized!');
            // Call the callback if it hasn't been called yet by reCAPTCHA itself
            if (!callbackCalled && window[callbackName] && typeof window[callbackName] === 'function') {
              try {
                window[callbackName]();
              } catch (e) {
                console.error('[reCAPTCHA] Error calling callback:', e);
                // Fallback: resolve anyway if grecaptcha is available
                if (!callbackResolved) {
                  callbackResolved = true;
                  if (initPromise) {
                    initPromise = null;
                  }
                  resolve();
                }
              }
            } else if (callbackCalled) {
              // Callback was already called by reCAPTCHA, just ensure we're resolved
              if (!callbackResolved) {
                callbackResolved = true;
                if (initPromise) {
                  initPromise = null;
                }
                resolve();
              }
            } else {
              // Callback was deleted or not found, but grecaptcha is ready
              console.warn('[reCAPTCHA] Callback not found but grecaptcha is ready');
              if (!callbackResolved) {
                callbackResolved = true;
                if (initPromise) {
                  initPromise = null;
                }
                resolve();
              }
            }
          }
        }, 100);
        
        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          if (window.grecaptcha) {
            console.log('[reCAPTCHA] Successfully initialized (timeout)!');
            if (!callbackCalled && window[callbackName] && typeof window[callbackName] === 'function') {
              try {
                window[callbackName]();
              } catch (e) {
                console.error('[reCAPTCHA] Error calling callback (timeout):', e);
                if (!callbackResolved) {
                  callbackResolved = true;
                  if (initPromise) {
                    initPromise = null;
                  }
                  resolve();
                }
              }
            } else if (!callbackResolved) {
              // grecaptcha is ready but callback wasn't called
              callbackResolved = true;
              if (initPromise) {
                initPromise = null;
              }
              resolve();
            }
          } else {
            console.error('[reCAPTCHA] Failed to initialize - grecaptcha not ready after 5 seconds');
            if (window[callbackName]) {
              delete window[callbackName];
            }
            initPromise = null;
            reject(new Error('reCAPTCHA failed to load'));
          }
        }, 5000);
      };
      
      script.onerror = (error) => {
        console.error('[reCAPTCHA] Script loading error:', error);
        if (window[callbackName]) {
          delete window[callbackName];
        }
        initPromise = null;
        reject(error);
      };
      
      document.head.appendChild(script);
      console.log('[reCAPTCHA] Script tag added to document head with callback:', callbackName);
    }, 0); // Use setTimeout with 0ms to ensure callback is set before script loads
  });
  
  return initPromise;
};

/**
 * Render reCAPTCHA v2 widget in a container element
 * @param {string|HTMLElement} container - Container element ID or element
 * @param {Function} callback - Callback function called when user successfully completes reCAPTCHA
 * @param {Object} options - Additional options (theme, size, etc.)
 * @returns {number} - Widget ID
 */
export const renderRecaptcha = (container, callback, options = {}) => {
  if (!window.grecaptcha) {
    throw new Error('reCAPTCHA is not initialized. Call initializeRecaptcha() first.');
  }

  // Check if render method exists
  if (!window.grecaptcha.render || typeof window.grecaptcha.render !== 'function') {
    throw new Error('reCAPTCHA render method is not available. Wait for script to fully load.');
  }

  // Merge user-provided callbacks with defaults
  const siteKey = getRecaptchaSiteKey();
  const defaultOptions = {
    sitekey: siteKey,
    callback: callback,
    'expired-callback': options['expired-callback'] || (() => {
      console.log('[reCAPTCHA] Token expired');
    }),
    'error-callback': options['error-callback'] || (() => {
      console.error('[reCAPTCHA] Error occurred');
    }),
    theme: options.theme || 'light',
    size: options.size || 'normal',
  };

  return window.grecaptcha.render(container, defaultOptions);
};

/**
 * Get reCAPTCHA v2 token from a widget
 * @param {number} widgetId - The widget ID returned from renderRecaptcha
 * @returns {string|null} - The reCAPTCHA token or null if not verified
 */
export const getRecaptchaToken = (widgetId) => {
  if (!window.grecaptcha) {
    return null;
  }
  return window.grecaptcha.getResponse(widgetId);
};

/**
 * Reset reCAPTCHA v2 widget
 * @param {number} widgetId - The widget ID returned from renderRecaptcha
 */
export const resetRecaptcha = (widgetId) => {
  if (window.grecaptcha && widgetId !== null && widgetId !== undefined) {
    window.grecaptcha.reset(widgetId);
  }
};

/**
 * Execute reCAPTCHA v3 (for backward compatibility)
 * @deprecated Use renderRecaptcha for v2 instead
 * @param {string} action - The action name (e.g., 'login', 'register', 'contact')
 * @returns {Promise<string>} - The reCAPTCHA token
 */
export const executeRecaptcha = async (action = 'submit') => {
  console.warn('[reCAPTCHA] executeRecaptcha is deprecated. Use renderRecaptcha for v2.');
  try {
    await initializeRecaptcha();
    
    if (!window.grecaptcha) {
      throw new Error('reCAPTCHA is not ready');
    }

    // For v2, we need to render a widget first, but this function is for v3
    // Return null to indicate v2 should be used instead
    return null;
  } catch (error) {
    console.error('reCAPTCHA initialization error:', error);
    throw error;
  }
};

/**
 * Check if reCAPTCHA is properly configured
 * Checks dynamically to handle cases where window.RECAPTCHA_SITE_KEY is set after module load
 */
export const isRecaptchaConfigured = () => {
  const siteKey = getRecaptchaSiteKey();
  const isConfigured = siteKey && 
         siteKey !== 'YOUR_RECAPTCHA_SITE_KEY_HERE' &&
         siteKey.trim() !== '';
  
  // Debug logging
  if (typeof window !== 'undefined') {
    console.log('[reCAPTCHA] Configuration check:', {
      siteKey: siteKey ? `${siteKey.substring(0, 10)}...` : 'NOT SET',
      isConfigured: isConfigured,
      envVar: import.meta.env.VITE_RECAPTCHA_SITE_KEY ? `${import.meta.env.VITE_RECAPTCHA_SITE_KEY.substring(0, 10)}...` : 'NOT SET',
      windowKey: window.RECAPTCHA_SITE_KEY ? `${window.RECAPTCHA_SITE_KEY.substring(0, 10)}...` : 'NOT SET'
    });
  }
  
  return isConfigured;
};

