// Centralized auth utilities: token decoding, refresh with single-flight, and authorized fetch
import { API_BASE } from './apiBase'

let refreshInFlight = null
let last401Ts = 0

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

export const isTokenExpired = (token) => {
  const exp = decodeJwtExp(token)
  if (!exp) return false
  return Date.now() >= exp * 1000
}

async function doRefresh() {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) return null
  try {
    const res = await fetch(`${API_BASE}/index.php?endpoint=refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data && data.success && data.token) {
      localStorage.setItem('token', data.token)
      if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token)
      return data.token
    }
  } catch {
    // ignore
  }
  return null
}

export const ensureValidToken = async (force = false) => {
  const current = localStorage.getItem('token')
  if (!force && current && !isTokenExpired(current)) return current
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      // allow a slight delay to coalesce parallel callers
      setTimeout(() => { refreshInFlight = null }, 0)
    })
  }
  const fresh = await refreshInFlight
  return fresh
}

export const authorizedFetch = async (url, options = {}, retry = true) => {
  // If a recent 401 occurred, proactively force refresh to avoid another 401 burst
  if (Date.now() - last401Ts < 3000) {
    await ensureValidToken(true)
  }
  let token = await ensureValidToken(false)
  const withAuth = (tkn) => ({
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(tkn ? { Authorization: `Bearer ${tkn}`, 'X-Auth-Token': tkn } : {}),
    },
  })

  // As a fallback for servers that drop Authorization headers, also pass token in query for same API base URLs
  const appendTokenInQuery = (u, tkn) => {
    try {
      if (!tkn) return u
      // Only append for our backend API calls (supports absolute and relative URLs)
      if (typeof u === 'string' && (u.startsWith('/backend/api') || u.includes('/backend/api/'))) {
        const sep = u.includes('?') ? '&' : '?'
        return `${u}${sep}token=${encodeURIComponent(tkn)}`
      }
    } catch {}
    return u
  }

  const urlWithQueryToken = appendTokenInQuery(url, token)

  let res = await fetch(urlWithQueryToken, withAuth(token))
  if (res.status === 401 && retry) {
    last401Ts = Date.now()
    const newToken = await ensureValidToken(true)
    if (newToken && newToken !== token) {
      const retryUrl = appendTokenInQuery(url, newToken)
      res = await fetch(retryUrl, withAuth(newToken))
    }
  }
  // If still unauthorized after refresh attempt, broadcast (let app decide next steps)
  if (res.status === 401) {
    try {
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'))
      }
    } catch {}
  }
  return res
}
