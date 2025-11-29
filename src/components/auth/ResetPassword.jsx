import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../utils/apiBase';
import PasswordInput from '../common/PasswordInput';

const ResetPassword = ({ onSuccess }) => {
  const [formData, setFormData] = useState({ 
    password: '', 
    confirmPassword: '' 
  });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');
  const [passwordRequirements, setPasswordRequirements] = useState({
    min_length: 8,
    max_length: null, // No maximum limit - allows stronger passwords and passphrases
    require_uppercase: true,
    require_lowercase: true,
    require_numbers: true,
    require_special: true
  });

  // Fetch password requirements on component mount
  useEffect(() => {
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

  useEffect(() => {
    // Get token from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setError('Invalid or missing reset token');
    }
  }, []);

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

    // Validate password using dynamic requirements
    const passwordLength = formData.password.length;
    const passwordErrors = [];
    
    if (passwordLength < passwordRequirements.min_length) {
      passwordErrors.push(`Password must be at least ${passwordRequirements.min_length} characters long`);
    }
    
    if (passwordRequirements.max_length && passwordLength > passwordRequirements.max_length) {
      passwordErrors.push(`Password must be no more than ${passwordRequirements.max_length} characters long`);
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
      setError(passwordErrors.join(', '));
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (!token) {
      setError('Invalid reset token');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/index.php?endpoint=reset_password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: token,
          password: formData.password 
        })
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        setInfo('Password reset successfully! You can now log in with your new password.');
        setTimeout(() => {
          if (onSuccess) onSuccess();
        }, 2000);
      } else {
        setError(data.error || 'Failed to reset password');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-red-100">
              <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Invalid Reset Link
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              This password reset link is invalid or has expired.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Reset Your Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your new password below
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
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                New Password
              </label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                placeholder="Enter your new password"
                value={formData.password}
                onChange={handleChange}
              />
              <div className="mt-2 text-xs text-gray-600">
                <p className="mb-1">Password requirements:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>{passwordRequirements.min_length}{passwordRequirements.max_length ? `-${passwordRequirements.max_length}` : '+'} characters</li>
                  {passwordRequirements.require_numbers && <li>Must contain number</li>}
                  {passwordRequirements.require_uppercase && <li>Must contain 1 capital letter</li>}
                  {passwordRequirements.require_lowercase && <li>Must contain 1 lowercase letter</li>}
                  {passwordRequirements.require_special && <li>Must contain special symbol</li>}
                </ul>
              </div>
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm New Password
              </label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                placeholder="Confirm your new password"
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
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
