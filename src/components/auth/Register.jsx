/**
 * Register component: validates PII, enforces strong password, and OTP-gated registration.
 * UX: Shows simple strength meter and OTP resend cooldown/expiry.
 */
import React, { useState, useEffect, useRef } from 'react';
import { validateNoEmoji } from '../../utils/validation';
import { API_BASE } from '../../utils/apiBase';
import PasswordInput from '../common/PasswordInput';
import { isRecaptchaConfigured, initializeRecaptcha, renderRecaptcha, getRecaptchaToken, resetRecaptcha } from '../../utils/recaptcha';

const Register = ({ onRegister, onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [info, setInfo] = useState('');
  const [cooldownSec, setCooldownSec] = useState(0);
  const [expiresAt, setExpiresAt] = useState(null);
  const [recaptchaVerified, setRecaptchaVerified] = useState(false);
  const recaptchaWidgetId = useRef(null);
  const recaptchaContainerRef = useRef(null);
  const [passwordRequirements, setPasswordRequirements] = useState({
    min_length: 8,
    max_length: null, // No maximum limit - allows stronger passwords and passphrases
    require_uppercase: true,
    require_lowercase: true,
    require_numbers: true,
    require_special: true
  });

  // Fetch password requirements on component mount
  React.useEffect(() => {
    const fetchPasswordRequirements = async () => {
      try {
        const response = await fetch(`${API_BASE}/index.php?endpoint=password_requirements`);
        const data = await response.json();
        if (data.success && data.requirements) {
          setPasswordRequirements(data.requirements);
        }
      } catch (error) {
        console.error('Failed to fetch password requirements:', error);
        // Keep default requirements if fetch fails
      }
    };
    
    fetchPasswordRequirements();
  }, []);

  // Initialize reCAPTCHA v2 on component mount and render widget
  useEffect(() => {
    console.log('[Register] Component mounted, checking reCAPTCHA configuration...');
    if (!isRecaptchaConfigured()) {
      console.warn('[Register] reCAPTCHA is NOT configured. Please set VITE_RECAPTCHA_SITE_KEY in .env file');
      return;
    }

    // Track if initialization is in progress to prevent multiple attempts
    let isInitializing = false;
    let initTimeout = null;

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

      if (recaptchaContainerRef.current) {
        isInitializing = true;
        console.log('[Register] reCAPTCHA is configured, initializing v2...');
        initializeRecaptcha()
          .then(() => {
            // Wait for grecaptcha.render to be available
            const waitForRender = (attempts = 0) => {
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
                        console.log('[Register] reCAPTCHA verified successfully');
                        setRecaptchaVerified(true);
                      },
                      { 
                        theme: 'light', 
                        size: 'normal',
                        'expired-callback': () => {
                          // Handle token expiration
                          console.log('[Register] reCAPTCHA token expired');
                          setRecaptchaVerified(false);
                        },
                        'error-callback': () => {
                          // Handle errors
                          console.error('[Register] reCAPTCHA error occurred');
                          setRecaptchaVerified(false);
                        }
                      }
                    );
                    recaptchaWidgetId.current = widgetId;
                    isInitializing = false;
                    console.log('[Register] reCAPTCHA widget rendered with ID:', widgetId);
                  } catch (err) {
                    isInitializing = false;
                    // Only log error if it's not the "already rendered" error
                    if (!err.message || !err.message.includes('already been rendered')) {
                      console.error('[Register] Failed to render reCAPTCHA widget:', err);
                    } else {
                      console.warn('[Register] reCAPTCHA widget already rendered, skipping...');
                    }
                  }
                } else {
                  isInitializing = false;
                }
              } else if (attempts < 50) {
                // Retry up to 5 seconds (50 attempts * 100ms)
                setTimeout(() => waitForRender(attempts + 1), 100);
              } else {
                isInitializing = false;
                console.error('[Register] reCAPTCHA render method not available after waiting');
              }
            };
            waitForRender();
          })
          .catch(err => {
            isInitializing = false;
            console.error('[Register] Failed to initialize reCAPTCHA:', err);
          });
      }
    };

    // Wait a bit for DOM to be ready, then initialize
    initTimeout = setTimeout(() => {
      initRecaptcha();
    }, 200);

    // Cleanup function to prevent memory leaks
    return () => {
      if (initTimeout) {
        clearTimeout(initTimeout);
      }
      isInitializing = false;
    };
  }, []);

  // Input change handler: blocks emoji early to avoid invalid submission
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Check for emojis in the input
    const emojiError = validateNoEmoji(value, name === 'email' ? 'Email' : name === 'username' ? 'Username' : 'Name');
    if (emojiError) {
      setError(emojiError);
      return;
    }
    
    setFormData({ ...formData, [name]: value });
    setError('');
    
    // Reset reCAPTCHA if user changes email or username (new registration attempt)
    if ((name === 'email' || name === 'username') && recaptchaVerified) {
      // Clear reCAPTCHA verification when user starts typing a different email/username
      // This ensures each registration attempt requires fresh verification
      if ((name === 'email' && value !== formData.email) || 
          (name === 'username' && value !== formData.username)) {
        setRecaptchaVerified(false);
        if (recaptchaWidgetId.current !== null && window.grecaptcha) {
          resetRecaptcha(recaptchaWidgetId.current);
        }
      }
    }
  };

  // Submit handler: final validation and POST to backend register endpoint
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Final emoji check before submission
    const fieldsToCheck = [
      { name: 'firstName', label: 'First name' },
      { name: 'lastName', label: 'Last name' },
      { name: 'username', label: 'Username' },
      { name: 'email', label: 'Email' }
    ];
    
    for (const field of fieldsToCheck) {
      const error = validateNoEmoji(formData[field.name], field.label);
      if (error) {
        setError(error);
        return;
      }
    }
    
    // Email format validation per test case
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
    if (!emailOk) {
      setError('Invalid email format');
      return;
    }

    // Password strength requirement using dynamic configuration
    const passwordLength = (formData.password || '').length;
    const passwordErrors = [];
    
    if (passwordLength < passwordRequirements.min_length) {
      passwordErrors.push(`Password must be at least ${passwordRequirements.min_length} characters long`);
    }
    
    if (passwordRequirements.max_length && passwordLength > passwordRequirements.max_length) {
      passwordErrors.push(`Password must be no more than ${passwordRequirements.max_length} characters long (current: ${passwordLength})`);
    }
    
    if (passwordRequirements.require_uppercase && !/[A-Z]/.test(formData.password)) {
      passwordErrors.push('Password must contain at least one uppercase letter');
    }
    
    if (passwordRequirements.require_lowercase && !/[a-z]/.test(formData.password)) {
      passwordErrors.push('Password must contain at least one lowercase letter');
    }
    
    if (passwordRequirements.require_numbers && !/\d/.test(formData.password)) {
      passwordErrors.push('Password must contain at least one number');
    }
    
    if (passwordRequirements.require_special && !/[^A-Za-z0-9]/.test(formData.password)) {
      passwordErrors.push('Password must contain at least one special character');
    }
    
    if (passwordErrors.length > 0) {
      setError(passwordErrors.length === 1 ? passwordErrors[0] : 'Password must meet security requirements: ' + passwordErrors.join(', '));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!otpSent || otpCode.length !== 6) {
      setError('Please send OTP and enter the 6-digit code.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Get reCAPTCHA v2 token from widget
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
        // reCAPTCHA is configured but widget not rendered - require verification
        setLoading(false);
        setError('reCAPTCHA verification is required');
        return;
      }

      const { confirmPassword, ...toSend } = formData;
      const payload = {
        first_name: toSend.firstName,
        last_name: toSend.lastName,
        username: toSend.username,
        email: toSend.email,
        password: toSend.password,
        otp_code: otpCode
      };
      if (recaptchaToken) {
        payload.recaptcha_token = recaptchaToken;
      }
      const res = await fetch(`${API_BASE}/index.php?endpoint=register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('token', data.token);
        if (data.refresh_token) {
          localStorage.setItem('refresh_token', data.refresh_token);
        }
        // Reset reCAPTCHA after successful registration
        if (recaptchaWidgetId.current !== null && window.grecaptcha) {
          resetRecaptcha(recaptchaWidgetId.current);
          setRecaptchaVerified(false);
        }
        onRegister();
      } else {
        // Reset reCAPTCHA on failed registration
        if (recaptchaWidgetId.current !== null && window.grecaptcha) {
          resetRecaptcha(recaptchaWidgetId.current);
          setRecaptchaVerified(false);
        }
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  // Password strength meter (dynamic): uses backend requirements
  const passwordStrength = React.useMemo(() => {
    const p = formData.password || '';
    
    // If password exceeds max_length, it's invalid regardless of other checks
    if (passwordRequirements.max_length && p.length > passwordRequirements.max_length) {
      return { 
        score: 0, 
        label: 'Invalid',
        isValid: false,
        issue: `Password must be no more than ${passwordRequirements.max_length} characters`
      };
    }
    
    let score = 0;
    if (p.length >= passwordRequirements.min_length) score++;
    if (passwordRequirements.max_length && p.length <= passwordRequirements.max_length) score++;
    if (passwordRequirements.require_uppercase && /[A-Z]/.test(p)) score++;
    if (passwordRequirements.require_lowercase && /[a-z]/.test(p)) score++;
    if (passwordRequirements.require_numbers && /\d/.test(p)) score++;
    if (passwordRequirements.require_special && /[^A-Za-z0-9]/.test(p)) score++;
    
    const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const isValid = (
      p.length >= passwordRequirements.min_length &&
      (!passwordRequirements.max_length || p.length <= passwordRequirements.max_length) &&
      (!passwordRequirements.require_uppercase || /[A-Z]/.test(p)) &&
      (!passwordRequirements.require_lowercase || /[a-z]/.test(p)) &&
      (!passwordRequirements.require_numbers || /\d/.test(p)) &&
      (!passwordRequirements.require_special || /[^A-Za-z0-9]/.test(p))
    );
    
    return { 
      score, 
      label: labels[Math.min(score, 4)] || 'Very weak',
      isValid,
      issue: isValid ? null : 'Password does not meet all requirements'
    };
  }, [formData.password, passwordRequirements]);

  // Request OTP for register purpose and initialize cooldown timers
  const handleSendOtp = async () => {
    setError('');
    setInfo('');
    if (!formData.email || !formData.email.includes('@')) {
      setError('Enter a valid email first.');
      return;
    }
    try {
      setOtpSending(true);
      const res = await fetch(`${API_BASE}/index.php?endpoint=otp_request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, purpose: 'register' })
      });
      // Be tolerant to non-JSON outputs (e.g., stray whitespace/notices)
      let data;
      try {
        data = await res.clone().json();
      } catch (_) {
        const text = await res.text();
        try { data = JSON.parse(text); } catch (_) { data = { success: res.ok && /otp sent|verification code/i.test(text) }; }
      }

      if (res.ok && data && data.success) {
        setOtpSent(true);
        setInfo('Verification code sent. Check your email.');
        // Start cooldown & expiry timers if provided
        const cd = Number(data.cooldown_seconds || 60);
        const ttlMin = Number(data.ttl_minutes || 5);
        setCooldownSec(cd);
        setExpiresAt(Date.now() + ttlMin * 60 * 1000);
      } else {
        setError((data && data.error) || 'Failed to send verification code');
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setOtpSending(false);
    }
  };

  // Cooldown countdown
  React.useEffect(() => {
    if (!otpSent || cooldownSec <= 0) return;
    const t = setInterval(() => {
      setCooldownSec((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [otpSent, cooldownSec]);

  // Expiry countdown label
  const expiryLabel = React.useMemo(() => {
    if (!expiresAt) return '';
    const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    const mm = String(Math.floor(remaining / 60)).padStart(1, '0');
    const ss = String(remaining % 60).padStart(2, '0');
    return remaining > 0 ? `Code expires in ${mm}:${ss}` : 'Code expired. Please resend.';
  }, [expiresAt, Date.now()]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Join SIMS today
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          )}
          {info && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
              {info}
            </div>
          )}
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-1/2">
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  First Name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  required
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  placeholder="Enter your first name"
                  value={formData.firstName}
                  onChange={handleChange}
                />
              </div>
              <div className="w-1/2">
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Last Name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  required
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  placeholder="Enter your last name"
                  value={formData.lastName}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                placeholder="Choose a username"
                value={formData.username}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpSending || cooldownSec > 0}
                  className={`px-3 py-2 text-sm font-medium rounded-md text-white ${(otpSending || cooldownSec > 0) ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  {otpSent ? (cooldownSec > 0 ? `Resend (${cooldownSec}s)` : 'Resend Code') : 'Send Code'}
                </button>
                {otpSent && (
                  <input
                    id="otpCode"
                    name="otpCode"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    className="flex-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    placeholder="Enter 6-digit code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0,6))}
                  />
                )}
                {otpSent && (
                  <span className="text-xs text-gray-600">{expiryLabel}</span>
                )}
              </div>
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                showStrengthIndicator={true}
                strengthScore={passwordStrength.score}
                strengthLabel={passwordStrength.label}
              />
              <div className="mt-2 text-xs text-gray-600">
                <p className="mb-1">Password requirements:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li className={formData.password.length < passwordRequirements.min_length ? 'text-red-600' : formData.password.length >= passwordRequirements.min_length && (!passwordRequirements.max_length || formData.password.length <= passwordRequirements.max_length) ? 'text-green-600' : ''}>
                    {passwordRequirements.min_length}{passwordRequirements.max_length ? `-${passwordRequirements.max_length}` : '+'} characters
                    {passwordRequirements.max_length && formData.password.length > passwordRequirements.max_length && (
                      <span className="text-red-600 font-semibold"> (current: {formData.password.length})</span>
                    )}
                  </li>
                  <li className={passwordRequirements.require_numbers && !/\d/.test(formData.password) ? 'text-red-600' : passwordRequirements.require_numbers && /\d/.test(formData.password) ? 'text-green-600' : ''}>
                    Must contain number
                  </li>
                  <li className={passwordRequirements.require_uppercase && !/[A-Z]/.test(formData.password) ? 'text-red-600' : passwordRequirements.require_uppercase && /[A-Z]/.test(formData.password) ? 'text-green-600' : ''}>
                    Must contain 1 capital letter
                  </li>
                  <li className={passwordRequirements.require_special && !/[^A-Za-z0-9]/.test(formData.password) ? 'text-red-600' : passwordRequirements.require_special && /[^A-Za-z0-9]/.test(formData.password) ? 'text-green-600' : ''}>
                    Must contain special symbol
                  </li>
                </ul>
                {passwordStrength.issue && formData.password && (
                  <p className="mt-2 text-xs text-red-600 font-semibold">{passwordStrength.issue}</p>
                )}
              </div>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleChange}
              />
            </div>
            {/* reCAPTCHA v2 Widget Container */}
            {isRecaptchaConfigured() && (
              <div className="flex justify-center">
                <div ref={recaptchaContainerRef} id="recaptcha-container-register"></div>
              </div>
            )}
          </div>
          <div>
            <button
              type="submit"
              disabled={loading || (isRecaptchaConfigured() && !recaptchaVerified)}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                loading || (isRecaptchaConfigured() && !recaptchaVerified)
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
              }`}
              title={isRecaptchaConfigured() && !recaptchaVerified ? 'Please complete the reCAPTCHA verification first' : ''}
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="font-medium text-green-600 hover:text-green-500"
              >
                Sign in here
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

export default Register; 