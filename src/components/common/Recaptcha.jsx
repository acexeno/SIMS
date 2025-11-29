/**
 * reCAPTCHA v3 component wrapper
 * Automatically executes reCAPTCHA when form is submitted
 */
import React, { useEffect, useRef, useState } from 'react';
import { initializeRecaptcha, isRecaptchaConfigured } from '../../utils/recaptcha';

const Recaptcha = ({ onTokenGenerated, action = 'submit', children }) => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const tokenRef = useRef(null);

  useEffect(() => {
    if (!isRecaptchaConfigured()) {
      console.warn('reCAPTCHA is not configured. Please set VITE_RECAPTCHA_SITE_KEY');
      setError('reCAPTCHA is not configured');
      setIsReady(false);
      return;
    }

    // Initialize reCAPTCHA
    initializeRecaptcha()
      .then(() => {
        setIsReady(true);
        setError(null);
      })
      .catch((err) => {
        console.error('Failed to initialize reCAPTCHA:', err);
        setError('Failed to load reCAPTCHA');
        setIsReady(false);
      });
  }, []);

  // Expose token generation function via ref or callback
  const generateToken = async () => {
    if (!isReady || !window.grecaptcha || !window.grecaptcha.ready) {
      throw new Error('reCAPTCHA is not ready');
    }

    try {
      const { getRecaptchaSiteKey } = await import('../../utils/recaptcha');
      const siteKey = getRecaptchaSiteKey();
      if (!siteKey || siteKey === 'YOUR_RECAPTCHA_SITE_KEY_HERE') {
        throw new Error('reCAPTCHA site key is not configured');
      }

      const token = await new Promise((resolve, reject) => {
        window.grecaptcha.ready(() => {
          window.grecaptcha
            .execute(siteKey, { action })
            .then(resolve)
            .catch(reject);
        });
      });

      tokenRef.current = token;
      if (onTokenGenerated) {
        onTokenGenerated(token);
      }
      return token;
    } catch (err) {
      console.error('reCAPTCHA execution error:', err);
      throw err;
    }
  };

  // Expose generateToken via children render prop pattern
  if (typeof children === 'function') {
    return children({ generateToken, isReady, error });
  }

  // For simple usage, just render children
  return (
    <>
      {children}
      {error && (
        <div className="text-xs text-yellow-600 mt-1">
          Warning: reCAPTCHA verification may not work properly
        </div>
      )}
    </>
  );
};

export default Recaptcha;

