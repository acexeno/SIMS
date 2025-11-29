/**
 * Login component: supports password login and Gmail-based OTP fallback.
 * Behavior: stores JWTs on success and fetches profile for a complete user object.
 */
import React, { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../utils/apiBase';
import PasswordInput from '../common/PasswordInput';
import { isRecaptchaConfigured, initializeRecaptcha, renderRecaptcha, getRecaptchaToken, resetRecaptcha } from '../../utils/recaptcha';

const Login = ({ onLogin, onSwitchToRegister }) => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [recaptchaVerified, setRecaptchaVerified] = useState(false);
  const [requiresPostLoginOtp, setRequiresPostLoginOtp] = useState(false);
  const [postLoginEmail, setPostLoginEmail] = useState('');
  const recaptchaWidgetId = useRef(null);
  const recaptchaContainerRef = useRef(null);

  // Initialize reCAPTCHA v2 on component mount and render widget
  useEffect(() => {
    console.log('[Login] Component mounted, checking reCAPTCHA configuration...');
    if (!isRecaptchaConfigured()) {
      console.warn('[Login] reCAPTCHA is NOT configured. Please set VITE_RECAPTCHA_SITE_KEY in .env file');
      return;
    }

    // Track if initialization is in progress to prevent multiple attempts
    let isInitializing = false;
    let initTimeout = null;
    let containerCheckInterval = null;

    // Wait for the container to be available, then initialize
    const initRecaptcha = () => {
      // Prevent multiple simultaneous initialization attempts
      if (isInitializing) {
        return;
      }

      // If widget already rendered, don't initialize again
      if (recaptchaWidgetId.current !== null) {
        return;
      }

      // Wait for container to be available in DOM
      const checkContainer = (attempts = 0) => {
        if (recaptchaContainerRef.current) {
          // Container is available, proceed with initialization
          isInitializing = true;
          console.log('[Login] reCAPTCHA container found, initializing v2...');
          initializeRecaptcha()
            .then(() => {
              // Wait for grecaptcha.render to be available
              const waitForRender = (renderAttempts = 0) => {
                // Check again if widget was already rendered by another attempt
                if (recaptchaWidgetId.current !== null) {
                  isInitializing = false;
                  return;
                }

                if (window.grecaptcha && window.grecaptcha.render && typeof window.grecaptcha.render === 'function') {
                  // Double-check container and widget ID before rendering
                  if (recaptchaContainerRef.current && recaptchaWidgetId.current === null) {
                    try {
                      const widgetId = renderRecaptcha(
                        recaptchaContainerRef.current,
                        (token) => {
                          // Callback when user successfully completes reCAPTCHA
                          console.log('[Login] reCAPTCHA verified successfully');
                          setRecaptchaVerified(true);
                        },
                        { 
                          theme: 'light', 
                          size: 'normal',
                          'expired-callback': () => {
                            // Handle token expiration
                            console.log('[Login] reCAPTCHA token expired');
                            setRecaptchaVerified(false);
                          },
                          'error-callback': () => {
                            // Handle errors
                            console.error('[Login] reCAPTCHA error occurred');
                            setRecaptchaVerified(false);
                          }
                        }
                      );
                      recaptchaWidgetId.current = widgetId;
                      isInitializing = false;
                      console.log('[Login] reCAPTCHA widget rendered with ID:', widgetId);
                    } catch (err) {
                      isInitializing = false;
                      // Only log error if it's not the "already rendered" error
                      if (!err.message || !err.message.includes('already been rendered')) {
                        console.error('[Login] Failed to render reCAPTCHA widget:', err);
                      } else {
                        console.warn('[Login] reCAPTCHA widget already rendered, skipping...');
                      }
                    }
                  } else {
                    isInitializing = false;
                    if (!recaptchaContainerRef.current) {
                      console.warn('[Login] reCAPTCHA container ref is null, cannot render widget');
                    }
                  }
                } else if (renderAttempts < 50) {
                  // Retry up to 5 seconds (50 attempts * 100ms)
                  setTimeout(() => waitForRender(renderAttempts + 1), 100);
                } else {
                  isInitializing = false;
                  console.error('[Login] reCAPTCHA render method not available after waiting');
                }
              };
              waitForRender();
            })
            .catch(err => {
              isInitializing = false;
              console.error('[Login] Failed to initialize reCAPTCHA:', err);
            });
        } else if (attempts < 100) {
          // Retry checking for container up to 10 seconds (100 attempts * 100ms)
          containerCheckInterval = setTimeout(() => checkContainer(attempts + 1), 100);
        } else {
          console.warn('[Login] reCAPTCHA container not found after waiting, widget may not render');
        }
      };

      checkContainer();
    };

    // Wait a bit for DOM to be ready, then initialize
    initTimeout = setTimeout(() => {
      initRecaptcha();
    }, 300);

    // Cleanup function to prevent memory leaks
    return () => {
      if (initTimeout) {
        clearTimeout(initTimeout);
      }
      if (containerCheckInterval) {
        clearTimeout(containerCheckInterval);
      }
      isInitializing = false;
    };
  }, [forgotPasswordMode, requiresPostLoginOtp]);

  // Reset reCAPTCHA when switching between modes
  useEffect(() => {
    if (recaptchaWidgetId.current !== null && window.grecaptcha) {
      resetRecaptcha(recaptchaWidgetId.current);
      setRecaptchaVerified(false);
    }
  }, [otpMode, forgotPasswordMode]);

  // Reset reCAPTCHA on successful login (cleanup)
  const resetRecaptchaAfterSuccess = () => {
    if (recaptchaWidgetId.current !== null && window.grecaptcha) {
      resetRecaptcha(recaptchaWidgetId.current);
      setRecaptchaVerified(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
    setInfo('');
    
    // Reset reCAPTCHA if user changes username/email (new login attempt)
    if ((e.target.name === 'username' || e.target.name === 'password') && recaptchaVerified) {
      // Clear reCAPTCHA verification when user starts typing a different username
      // This ensures each login attempt requires fresh verification
      if (e.target.name === 'username' && e.target.value !== formData.username) {
        setRecaptchaVerified(false);
        if (recaptchaWidgetId.current !== null && window.grecaptcha) {
          resetRecaptcha(recaptchaWidgetId.current);
        }
      }
    }
  };

  // Submit handler: routes to password or OTP flow based on `otpMode`
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    
    try {
      // Handle post-login OTP verification first (no reCAPTCHA needed)
      if (requiresPostLoginOtp) {
        // Post-login OTP verification path (after password verification)
        // Note: reCAPTCHA already verified during password login, so not required here
        if (!otpCode || otpCode.length !== 6) {
          setLoading(false);
          setError('Please enter the 6-digit verification code.');
          return;
        }
        
        const otpPayload = { 
          email: postLoginEmail, 
          purpose: 'login_verify', 
          code: otpCode 
        };
        
        const res = await fetch(`${API_BASE}/index.php?endpoint=otp_verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(otpPayload)
        });
        const data = await res.json();
        if (res.ok && data.success && data.token) {
          // Reset reCAPTCHA after successful OTP verification
          resetRecaptchaAfterSuccess();
          
          localStorage.setItem('token', data.token);
          if (data.refresh_token) {
            localStorage.setItem('refresh_token', data.refresh_token);
          }
          
          // Small delay to ensure tokens persist before profile fetch
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Fetch user profile after login to get full user info
          try {
            const profileRes = await fetch(`${API_BASE}/index.php?endpoint=profile`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${data.token}`
              }
            });
            if (profileRes.ok) {
              const profileData = await profileRes.json();
              if (profileData.success) {
                onLogin(profileData.user);
                return;
              }
            }
            // If profile fetch fails, fall back to basic user payload
            onLogin(data.user);
          } catch {
            // Suppress error, fallback
            onLogin(data.user);
          }
        } else {
          // Reset reCAPTCHA on failed OTP verification
          if (recaptchaWidgetId.current !== null && window.grecaptcha) {
            resetRecaptcha(recaptchaWidgetId.current);
            setRecaptchaVerified(false);
          }
          setError(data.error || 'Verification code is incorrect or expired');
        }
        setLoading(false);
        return;
      }
      
      // Front-end required fields check to satisfy empty-fields test case
      const usernameEmpty = !formData.username || !formData.username.trim();
      const passwordEmpty = !otpMode && (!formData.password || !formData.password.trim());
      if (usernameEmpty || passwordEmpty) {
        setLoading(false);
        setError('Email and Password are required');
        return;
      }
      
      // Get reCAPTCHA v2 token from widget (only for password login or standalone OTP login)
      let recaptchaToken = null;
      if (isRecaptchaConfigured() && recaptchaWidgetId.current !== null) {
        try {
          recaptchaToken = getRecaptchaToken(recaptchaWidgetId.current);
          if (!recaptchaToken) {
            setLoading(false);
            setError('Please complete the reCAPTCHA verification');
            return;
          }
        } catch (recaptchaError) {
          console.error('reCAPTCHA error:', recaptchaError);
          setLoading(false);
          setError('reCAPTCHA verification failed. Please try again.');
          return;
        }
      } else if (isRecaptchaConfigured()) {
        // reCAPTCHA is configured but widget not rendered - allow login without it for now
        // (Widget might not have loaded yet, but we don't want to block login)
        console.warn('[Login] reCAPTCHA is configured but widget not rendered, proceeding without verification');
      }

      if (!otpMode) {
        // Password login path
        const loginPayload = { ...formData };
        if (recaptchaToken) {
          loginPayload.recaptcha_token = recaptchaToken;
        }
        const res = await fetch(`${API_BASE}/index.php?endpoint=login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loginPayload),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          // Check if OTP verification is required
          if (data.requires_otp && data.email) {
            // Show OTP input screen
            setRequiresPostLoginOtp(true);
            setPostLoginEmail(data.email);
            setInfo(data.message || 'Verification code sent to your email. Please check your inbox.');
            setError('');
            // Reset reCAPTCHA for OTP verification step
            resetRecaptchaAfterSuccess();
            return;
          }
          
          // If no OTP required, proceed with normal login flow
          localStorage.setItem('token', data.token);
          if (data.refresh_token) {
            localStorage.setItem('refresh_token', data.refresh_token);
          }
          
          // Small delay to ensure tokens persist before profile fetch
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Reset reCAPTCHA after successful login
          resetRecaptchaAfterSuccess();
          
          // Fetch user profile after login to get full user info
          try {
            const profileRes = await fetch(`${API_BASE}/index.php?endpoint=profile`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${data.token}`
              }
            });
            if (profileRes.ok) {
              const profileData = await profileRes.json();
              if (profileData.success) {
                onLogin(profileData.user);
                return;
              }
            }
            // If profile fetch fails, fall back to basic user payload
            onLogin(data.user);
          } catch {
            // Suppress error, fallback
            onLogin(data.user);
          }
        } else {
          // Reset reCAPTCHA on failed login
          if (recaptchaWidgetId.current !== null && window.grecaptcha) {
            resetRecaptcha(recaptchaWidgetId.current);
            setRecaptchaVerified(false);
          }
          // Map backend error messages to exact test-case strings
          const err = (data && (data.error || data.message)) || '';
          if (/invalid password|wrong password/i.test(err)) {
            setError('Invalid credentials');
          } else if (/not found|no account|does not exist|unregistered/i.test(err)) {
            setError('Account does not exist');
          } else {
            setError('Invalid credentials');
          }
        }
      } else {
        // OTP verify path (standalone login with email + 6-digit code)
        const emailForVerify = (formData.username || '').trim();
        const isGmailForVerify = /^[^@]+@gmail\.com$/i.test(emailForVerify);
        if (!emailForVerify || !emailForVerify.includes('@')) {
          setError('Please enter your email address to use OTP login.');
          return;
        }
        if (!isGmailForVerify) {
          setError('Only Gmail addresses are allowed for OTP.');
          return;
        }
        if (!otpCode) {
          setError('Enter the 6-digit code sent to your email.');
          return;
        }
        const otpPayload = { email: formData.username, purpose: 'login', code: otpCode };
        if (recaptchaToken) {
          otpPayload.recaptcha_token = recaptchaToken;
        }
        const res = await fetch(`${API_BASE}/index.php?endpoint=otp_verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(otpPayload)
        });
        const data = await res.json();
        if (res.ok && data.success && data.token) {
          // Reset reCAPTCHA after successful OTP login
          resetRecaptchaAfterSuccess();
          
          localStorage.setItem('token', data.token);
          if (data.refresh_token) {
            localStorage.setItem('refresh_token', data.refresh_token);
          }
          onLogin(data.user);
        } else {
          // Reset reCAPTCHA on failed OTP verification
          if (recaptchaWidgetId.current !== null && window.grecaptcha) {
            resetRecaptcha(recaptchaWidgetId.current);
            setRecaptchaVerified(false);
          }
          setError(data.error || 'OTP verification failed');
        }
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  // Send OTP code for login via email (Gmail-only policy)
  const handleSendCode = async () => {
    setError('');
    setInfo('');
    const emailForRequest = (formData.username || '').trim();
    const isGmailForRequest = /^[^@]+@gmail\.com$/i.test(emailForRequest);
    if (!emailForRequest || !emailForRequest.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!isGmailForRequest) {
      setError('Only Gmail addresses are allowed for OTP.');
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/index.php?endpoint=otp_request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.username, purpose: 'login' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOtpSent(true);
        setInfo('Verification code sent. Please check your email.');
      } else {
        setError(data.error || 'Failed to send code');
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  // Handle forgot password request
  const handleForgotPassword = async () => {
    setError('');
    setInfo('');
    const emailForReset = (formData.username || '').trim();
    if (!emailForReset || !emailForReset.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    
    // Check if it's a Gmail account
    const isGmail = /^[^@]+@gmail\.com$/i.test(emailForReset);
    if (!isGmail) {
      setError('Only Gmail accounts are allowed for password reset.');
      return;
    }
    
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/index.php?endpoint=forgot_password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailForReset })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResetEmailSent(true);
        setInfo('Password reset instructions sent to your Gmail.');
      } else {
        setError(data.error || 'Failed to send reset instructions');
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Welcome back to SIMS
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                {otpMode ? 'Gmail Address' : forgotPasswordMode ? 'Gmail Address' : 'Username or Email'}
              </label>
              <input
                id="username"
                name="username"
                type={otpMode ? 'email' : 'text'}
                autoComplete={otpMode ? 'email' : 'username'}
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                placeholder={otpMode ? 'Enter your Gmail address' : forgotPasswordMode ? 'Enter your Gmail address' : 'Enter your username or email'}
                value={formData.username}
                onChange={handleChange}
              />
            </div>
            {!otpMode && !forgotPasswordMode && !requiresPostLoginOtp && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
            )}
            {requiresPostLoginOtp && (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-md">
                  <p className="text-sm font-medium">Verification code sent!</p>
                  <p className="text-xs mt-1">Please check your email ({postLoginEmail}) and enter the 6-digit code below.</p>
                </div>
                <div>
                  <label htmlFor="postLoginOtpCode" className="block text-sm font-medium text-gray-700">
                    Enter Verification Code
                  </label>
                  <input
                    id="postLoginOtpCode"
                    name="postLoginOtpCode"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0,6))}
                  />
                </div>
              </div>
            )}
            {otpMode && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={loading}
                    className={`px-3 py-2 text-sm font-medium rounded-md text-white ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    {otpSent ? 'Resend Code' : 'Send Code'}
                  </button>
                  {info && (
                    <span className="text-xs text-gray-600">{info}</span>
                  )}
                </div>
                {otpSent && (
                  <div>
                    <label htmlFor="otpCode" className="block text-sm font-medium text-gray-700">
                      Enter 6-digit Code
                    </label>
                    <input
                      id="otpCode"
                      name="otpCode"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                      placeholder="123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0,6))}
                    />
                  </div>
                )}
              </div>
            )}
            {forgotPasswordMode && (
              <div className="space-y-3">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">
                    Enter your Gmail address and we'll send you instructions to reset your password.
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    Only Gmail accounts are supported for password reset.
                  </p>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={loading}
                    className={`px-4 py-2 text-sm font-medium rounded-md text-white ${
                      loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {loading ? 'Sending...' : 'Send Reset Instructions'}
                  </button>
                  {info && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
                      {info}
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* reCAPTCHA v2 Widget Container - only show for initial password login, not for post-login OTP */}
            {!forgotPasswordMode && !requiresPostLoginOtp && isRecaptchaConfigured() && (
              <div className="flex justify-center">
                <div ref={recaptchaContainerRef} id="recaptcha-container"></div>
              </div>
            )}
          </div>
          <div className="space-y-3">
            {!forgotPasswordMode && (
              <button
                type="submit"
                disabled={loading || (otpMode && !otpSent) || (isRecaptchaConfigured() && recaptchaWidgetId.current !== null && !recaptchaVerified && !requiresPostLoginOtp) || (requiresPostLoginOtp && (!otpCode || otpCode.length !== 6))}
                className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                  loading || (isRecaptchaConfigured() && recaptchaWidgetId.current !== null && !recaptchaVerified && !requiresPostLoginOtp) || (requiresPostLoginOtp && (!otpCode || otpCode.length !== 6))
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                }`}
                title={
                  (isRecaptchaConfigured() && recaptchaWidgetId.current !== null && !recaptchaVerified && !requiresPostLoginOtp) 
                    ? 'Please complete the reCAPTCHA verification first' 
                    : (requiresPostLoginOtp && (!otpCode || otpCode.length !== 6))
                    ? 'Please enter the 6-digit verification code'
                    : ''
                }
              >
                {loading 
                  ? (requiresPostLoginOtp ? 'Verifying...' : otpMode ? 'Verifying...' : 'Signing in...') 
                  : (requiresPostLoginOtp ? 'Verify & Sign in' : otpMode ? 'Verify & Sign in' : 'Sign in')
                }
              </button>
            )}
            {!forgotPasswordMode && !requiresPostLoginOtp && (
              <div className="text-center space-y-2">
                <button
                  type="button"
                  onClick={() => { setOtpMode(!otpMode); setError(''); setInfo(''); setOtpSent(false); setOtpCode(''); }}
                  className="text-sm text-green-600 hover:text-green-500"
                >
                  {otpMode ? 'Use password instead' : 'Use OTP instead'}
                </button>
                <div>
                  <button
                    type="button"
                    onClick={() => { setForgotPasswordMode(true); setError(''); setInfo(''); setOtpMode(false); setOtpSent(false); setOtpCode(''); }}
                    className="text-sm text-gray-600 hover:text-gray-500"
                  >
                    Forgot your password?
                  </button>
                </div>
              </div>
            )}
            {requiresPostLoginOtp && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { 
                    setRequiresPostLoginOtp(false); 
                    setPostLoginEmail(''); 
                    setError(''); 
                    setInfo(''); 
                    setOtpCode(''); 
                    setFormData({ username: formData.username, password: '' });
                  }}
                  className="text-sm text-gray-600 hover:text-gray-500"
                >
                  Back to password
                </button>
              </div>
            )}
            {forgotPasswordMode && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setForgotPasswordMode(false); setError(''); setInfo(''); setResetEmailSent(false); }}
                  className="text-sm text-green-600 hover:text-green-500"
                >
                  Back to login
                </button>
              </div>
            )}
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="font-medium text-green-600 hover:text-green-500"
              >
                Register here
              </button>
            </p>
          </div>
          {/* reCAPTCHA v2 Footer - Required by Google Terms of Service */}
          {isRecaptchaConfigured() && (
            <div className="text-xs text-gray-500 text-center mt-4">
              <p>
                This site is protected by reCAPTCHA and the Google{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                  Privacy Policy
                </a>
                {' '}and{' '}
                <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                  Terms of Service
                </a>
                {' '}apply.
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default Login; 