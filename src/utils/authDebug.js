/**
 * Auth Debug Helper
 * Run this in the browser console to debug authentication issues
 */

// Clear all auth data
function clearAuthData() {
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  console.log('Auth data cleared. Please log in again.');
}

// Check current auth state
function checkAuthState() {
  const token = localStorage.getItem('token');
  const refreshToken = localStorage.getItem('refresh_token');
  const user = localStorage.getItem('user');
  
  console.log('Current Auth State:');
  console.log('Token:', token ? `${token.substring(0, 20)}...` : 'None');
  console.log('Refresh Token:', refreshToken ? `${refreshToken.substring(0, 20)}...` : 'None');
  console.log('User:', user ? JSON.parse(user) : 'None');
  
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const isExpired = payload.exp < Date.now() / 1000;
      console.log('Token expired:', isExpired);
      console.log('Token expires at:', new Date(payload.exp * 1000));
    } catch (e) {
      console.log('Token decode error:', e.message);
    }
  }
}

// Test API connection
async function testApiConnection() {
  try {
    const response = await fetch('/api/index.php?endpoint=verify', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    console.log('API Test Response:', response.status, response.statusText);
    const data = await response.json();
    console.log('API Test Data:', data);
  } catch (error) {
    console.log('API Test Error:', error);
  }
}

// Export functions to global scope
if (typeof window !== 'undefined') {
  window.clearAuthData = clearAuthData;
  window.checkAuthState = checkAuthState;
  window.testApiConnection = testApiConnection;
  
  console.log('Auth debug helpers loaded. Use:');
  console.log('- clearAuthData() to clear auth data');
  console.log('- checkAuthState() to check current auth state');
  console.log('- testApiConnection() to test API connection');
}

