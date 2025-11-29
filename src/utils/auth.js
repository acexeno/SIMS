/**
 * Centralized auth utilities: token decoding, proactive refresh with single-flight,
 * authorized fetch with retry, and simple state helpers.
 * Security: never persists credentials beyond tokens; clears storage on failure.
 */
import { API_BASE } from './apiBase'

let refreshInFlight = null
let last401Ts = 0
let refreshAttempts = 0
const MAX_REFRESH_ATTEMPTS = 3
const REFRESH_COOLDOWN = 2000 // 2 seconds cooldown between refresh attempts

/**
 * Decode exp claim from a JWT without verifying signature.
 * @param {string} token
 * @returns {number} seconds since epoch or 0 when unavailable
 */
export const decodeJwtExp = (token) => {
  try {
    const part = token.split('.')[1]
    if (!part) return 0
    let b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    const payload = JSON.parse(atob(b64))
    return Number(payload.exp || 0)
  } catch {
    return 0
  }
}

/**
 * Determine if access token is expired with a 2-minute safety buffer.
 * @param {string} token
 * @returns {boolean}
 */
export const isTokenExpired = (token) => {
  const exp = decodeJwtExp(token)
  if (!exp) return false
  // Add 2-minute buffer before expiry to refresh proactively (reduced from 5 minutes)
  return Date.now() >= (exp * 1000) - (2 * 60 * 1000)
}

/**
 * Check if refresh token is expired (no buffer applied).
 * @param {string} token
 * @returns {boolean}
 */
export const isRefreshTokenExpired = (token) => {
  const exp = decodeJwtExp(token)
  if (!exp) return true
  // No buffer for refresh tokens - they should be valid until actual expiry
  return Date.now() >= (exp * 1000)
}

/**
 * Attempt to refresh access token using refresh token.
 * Clears tokens and emits auth:login-required on failure.
 * @returns {Promise<string|null>}
 */
async function doRefresh() {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) {
    console.log('No refresh token available')
    return null
  }
  
  // Check if refresh token is also expired
  if (isRefreshTokenExpired(refreshToken)) {
    console.log('Refresh token is expired')
    // Refresh token is also expired, user needs to log in again
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    // Dispatch event to notify app that user needs to log in
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('auth:login-required'))
    }
    return null
  }
  
  try {
    console.log('Attempting token refresh...')
    const res = await fetch(`${API_BASE}/index.php?endpoint=refresh`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    })
    
    const data = await res.json().catch(() => ({}))
    
    if (res.ok && data && data.success && data.token) {
      console.log('Token refresh successful')
      localStorage.setItem('token', data.token)
      if (data.refresh_token) {
        localStorage.setItem('refresh_token', data.refresh_token)
      }
      // Token refreshed successfully
      return data.token
    } else {
      console.log('Token refresh failed:', data.error || 'Unknown error')
      // Token refresh failed - likely due to invalid refresh token or secret change
      // Clear invalid tokens
      localStorage.removeItem('token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
      // Dispatch event to notify app that user needs to log in
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('auth:login-required'))
      }
      return null
    }
  } catch (error) {
    console.error('Token refresh error:', error)
    // Token refresh error
    // Clear tokens on network error
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    // Dispatch event to notify app that user needs to log in
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('auth:login-required'))
    }
  }
  return null
}

/**
 * Ensure a valid access token is available, optionally forcing refresh.
 * Coalesces parallel refresh attempts to reduce load.
 * @param {boolean} [force=false]
 * @returns {Promise<string|null>}
 */
export const ensureValidToken = async (force = false) => {
  const current = localStorage.getItem('token')
  if (!force && current && !isTokenExpired(current)) return current
  
  // If no current token and no refresh token, return null
  if (!current && !localStorage.getItem('refresh_token')) {
    // No tokens available for refresh
    return null
  }
  
  // Prevent too many refresh attempts
  if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
    // Too many refresh attempts, clearing tokens
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    refreshAttempts = 0
    return null
  }
  
  // Implement cooldown to prevent rapid refresh attempts
  const now = Date.now()
  if (now - last401Ts < REFRESH_COOLDOWN && refreshAttempts > 0) {
    // Refresh cooldown active, waiting...
    await new Promise(resolve => setTimeout(resolve, REFRESH_COOLDOWN - (now - last401Ts)))
  }
  
  if (!refreshInFlight) {
    refreshAttempts++
    // Attempting token refresh
    refreshInFlight = doRefresh().finally(() => {
      // allow a slight delay to coalesce parallel callers
      setTimeout(() => { refreshInFlight = null }, 100)
    })
  }
  const fresh = await refreshInFlight
  
  // If refresh failed, return null instead of the old token
  if (!fresh) {
    // Token refresh failed
    return null
  }
  
  // Reset attempts on successful refresh
  refreshAttempts = 0
  // Token refresh successful
  return fresh
}

/**
 * Perform an authenticated fetch, retrying once after token refresh on 401.
 * Adds token in header and as query param for servers that drop Authorization.
 * @param {RequestInfo} url
 * @param {RequestInit & {suppressUnauthorizedEvent?: boolean}} options
 * @param {boolean} [retry=true]
 * @returns {Promise<Response>}
 */
export const authorizedFetch = async (url, options = {}, retry = true) => {
  const suppressUnauthorizedEvent = !!options.suppressUnauthorizedEvent
  // Do not forward our custom option to fetch headers
  if ('suppressUnauthorizedEvent' in options) {
    const { suppressUnauthorizedEvent: _omit, ...rest } = options
    options = rest
  }
  
  // Get current token
  let token = await ensureValidToken(false)
  
  // If no token available, return a 401 response immediately
  if (!token) {
    console.warn('No valid token available for request to:', url)
    const response = new Response(JSON.stringify({ error: 'No valid token available' }), {
      status: 401,
      statusText: 'Unauthorized',
      headers: { 'Content-Type': 'application/json' }
    })
    return response
  }
  
  const withAuth = (tkn) => ({
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(tkn ? { 
        Authorization: `Bearer ${tkn}`, 
        'X-Auth-Token': tkn,
        'Accept': 'application/json'
      } : {}),
    },
  })

  // As a fallback for servers that drop Authorization headers, also pass token in query for same API base URLs
  // BUT NOT for refresh endpoint which expects refresh token in body
  const appendTokenInQuery = (u, tkn) => {
    try {
      if (!tkn) return u
      // Don't append token to query for refresh endpoint - it expects refresh token in body
      if (typeof u === 'string' && u.includes('endpoint=refresh')) {
        return u
      }
      // Append token for:
      // 1. API routes (/api or /backend/api)
      // 2. Production index.php routes (/index.php?endpoint=...)
      if (
        typeof u === 'string' && (
          u.startsWith('/api') || u.includes('/api/') ||
          u.startsWith('/backend/api') || u.includes('/backend/api/') ||
          u.includes('/index.php?endpoint=') || u.includes('index.php?endpoint=')
        )
      ) {
        // Remove any existing token parameter to avoid duplicates
        const sep = u.includes('?') ? '&' : '?'
        // Remove existing token parameter if present
        const cleanUrl = u.replace(/[?&]token=[^&]*/g, '').replace(/\?$/, '')
        return `${cleanUrl}${sep}token=${encodeURIComponent(tkn)}`
      }
    } catch {}
    return u
  }

  const urlWithQueryToken = appendTokenInQuery(url, token)

  let res = await fetch(urlWithQueryToken, withAuth(token))
  
  if (res.status === 401 && retry) {
    console.log('Received 401, attempting token refresh for:', url)
    last401Ts = Date.now()
    
    // Force refresh the token
    const newToken = await ensureValidToken(true)
    if (newToken && newToken !== token) {
      console.log('Got new token, retrying request')
      // Got new token, retrying request with the fresh token
      const retryUrl = appendTokenInQuery(url, newToken)
      const retryResponse = await fetch(retryUrl, withAuth(newToken))
      if (retryResponse.ok) {
        console.log('Retry successful with new token')
        res = retryResponse
      } else {
        console.log('Retry failed even with new token, status:', retryResponse.status)
        res = retryResponse
      }
    } else {
      console.log('Token refresh failed or no new token available')
      // Token refresh failed - no new token available
    }
  }
  
  // If still unauthorized after refresh attempt, broadcast (let app decide next steps)
  if (res.status === 401) {
    console.warn('Still unauthorized after refresh attempt for URL:', url)
    if (!suppressUnauthorizedEvent) {
      try {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('auth:unauthorized'))
        }
      } catch {}
    }
  }
  return res
}

// Reset authentication state
/** Reset auth tokens and in-memory refresh state. */
export const resetAuthState = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('refresh_token')
  refreshInFlight = null
  last401Ts = 0
  refreshAttempts = 0
  // Authentication state reset
}

// Check if user is authenticated
/**
 * Return true if either access or refresh token exists.
 * Note: presence does not guarantee validity.
 */
export const isAuthenticated = () => {
  const token = localStorage.getItem('token')
  const refreshToken = localStorage.getItem('refresh_token')
  return !!(token || refreshToken)
}

// Wait for authentication to be ready
/**
 * Wait briefly for a valid token (e.g., after login) up to maxWait ms.
 * @param {number} [maxWait=5000]
 * @returns {Promise<string|null>}
 */
export const waitForAuth = async (maxWait = 5000) => {
  const startTime = Date.now()
  while (Date.now() - startTime < maxWait) {
    const token = await ensureValidToken()
    if (token) {
      return token
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return null
}
