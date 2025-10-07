import React, { useState } from 'react';
import { API_BASE } from '../../utils/apiBase';

const Login = ({ onLogin, onSwitchToRegister }) => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
    setInfo('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    try {
      if (!otpMode) {
        // Password login
        const res = await fetch(`${API_BASE}/index.php?endpoint=login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          localStorage.setItem('token', data.token);
          if (data.refresh_token) {
            localStorage.setItem('refresh_token', data.refresh_token);
          }
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
            // If not ok or not success, fallback
            onLogin(data.user);
          } catch {
            // Suppress error, fallback
            onLogin(data.user);
          }
        } else {
          setError(data.error || 'Login failed');
        }
      } else {
        // OTP verify login
        if (!formData.username || !formData.username.includes('@')) {
          setError('Please enter your email address to use OTP login.');
          return;
        }
        if (!otpCode) {
          setError('Enter the 6-digit code sent to your email.');
          return;
        }
        const res = await fetch(`${API_BASE}/index.php?endpoint=otp_verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.username, purpose: 'login', code: otpCode })
        });
        const data = await res.json();
        if (res.ok && data.success && data.token) {
          localStorage.setItem('token', data.token);
          if (data.refresh_token) {
            localStorage.setItem('refresh_token', data.refresh_token);
          }
          onLogin(data.user);
        } else {
          setError(data.error || 'OTP verification failed');
        }
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async () => {
    setError('');
    setInfo('');
    if (!formData.username || !formData.username.includes('@')) {
      setError('Please enter a valid email address.');
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
                {otpMode ? 'Email Address' : 'Username or Email'}
              </label>
              <input
                id="username"
                name="username"
                type={otpMode ? 'email' : 'text'}
                autoComplete={otpMode ? 'email' : 'username'}
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                placeholder={otpMode ? 'Enter your email address' : 'Enter your username or email'}
                value={formData.username}
                onChange={handleChange}
              />
            </div>
            {!otpMode && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                />
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
          </div>
          <div className="space-y-3">
            <button
              type="submit"
              disabled={loading || (otpMode && !otpSent)}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                loading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
              }`}
            >
              {loading ? (otpMode ? 'Verifying...' : 'Signing in...') : (otpMode ? 'Verify & Sign in' : 'Sign in')}
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => { setOtpMode(!otpMode); setError(''); setInfo(''); setOtpSent(false); setOtpCode(''); }}
                className="text-sm text-green-600 hover:text-green-500"
              >
                {otpMode ? 'Use password instead' : 'Use OTP instead'}
              </button>
            </div>
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
        </form>
      </div>
    </div>
  );
};

export default Login; 