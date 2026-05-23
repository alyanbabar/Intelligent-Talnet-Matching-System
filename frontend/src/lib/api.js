// Thin wrapper around fetch that adds the JWT auth header automatically
// and parses JSON. All API calls in the app should go through this module
// so swapping the base URL or auth scheme is a one-file change.

import { getToken, clearAuth } from './auth'

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000').replace(/\/$/, '')

class ApiError extends Error {
  constructor(message, { status, payload } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

async function request(path, { method = 'GET', body, params, auth = true } = {}) {
  const url = new URL(`${BASE_URL}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, v)
      }
    }
  }

  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (networkError) {
    // The most common cause is the backend not running. Surface a clear message.
    throw new ApiError(
      'Could not reach the backend. Is it running on ' + BASE_URL + '?',
      { status: 0 },
    )
  }

  // Token expired or invalid? Drop it so the next render kicks the user to login.
  if (response.status === 401 && auth) {
    clearAuth()
  }

  // 204 No Content has no body
  if (response.status === 204) return null

  let payload = null
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      payload = await response.json()
    } catch {
      payload = null
    }
  } else {
    payload = await response.text()
  }

  if (!response.ok) {
    const message =
      (payload && typeof payload === 'object' && payload.error) ||
      (typeof payload === 'string' && payload) ||
      `Request failed with status ${response.status}`
    throw new ApiError(message, { status: response.status, payload })
  }

  return payload
}

export const api = {
  get: (path, params, opts) => request(path, { method: 'GET', params, ...opts }),
  post: (path, body, opts) => request(path, { method: 'POST', body, ...opts }),
  put: (path, body, opts) => request(path, { method: 'PUT', body, ...opts }),
  delete: (path, opts) => request(path, { method: 'DELETE', ...opts }),
}

export { ApiError, BASE_URL }
