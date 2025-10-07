import React, { useState } from 'react';
import { validateNoEmoji } from '../../utils/validation';
import { API_BASE } from '../../utils/apiBase';

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
  };

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
      const { confirmPassword, ...toSend } = formData;
      const payload = {
        first_name: toSend.firstName,
        last_name: toSend.lastName,
        username: toSend.username,
        email: toSend.email,
        password: toSend.password,
        otp_code: otpCode
      };
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
        onRegister();
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  // Password strength meter (simple): length, mixed case, number, special
  const passwordStrength = React.useMemo(() => {
    const p = formData.password || '';
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    const labels = ['Weak', 'Fair', 'Good', 'Strong'];
    return { score, label: labels[Math.max(0, score - 1)] || 'Very weak' };
  }, [formData.password]);

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
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
              />
              <div className="mt-1 h-2 w-full bg-gray-200 rounded">
                <div
                  className={`h-2 rounded ${passwordStrength.score >= 3 ? 'bg-green-600' : passwordStrength.score === 2 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, passwordStrength.score * 25)}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-1">Strength: {passwordStrength.label}</p>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleChange}
              />
            </div>
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                loading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
              }`}
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
        </form>
      </div>
    </div>
  );
};

export default Register; 